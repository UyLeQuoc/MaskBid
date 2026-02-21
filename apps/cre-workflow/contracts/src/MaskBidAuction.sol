// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {ReceiverTemplate} from "./interfaces/ReceiverTemplate.sol";

/**
 * @title MaskBidAuction
 * @dev Decentralized sealed-bid auction for Real World Assets (RWAs).
 *
 *      Three actors:
 *        - Admin: platform management, emergency cancel, configure fees
 *        - Verifier: (inherited from TokenizedAssetPlatform) asset verification
 *        - User: auctioneer (creates auctions) & bidder (places bids)
 *
 *      Auction lifecycle:
 *        Created → Active → Ended → Finalized → (done)
 *                                 → Cancelled  → (refunds)
 *
 *      Bids are sealed (only bidHash stored on-chain). The actual bid amount
 *      is encrypted off-chain and resolved by the Chainlink CRE solver.
 *      USDC escrow is locked on bid placement; losers reclaim after finalization.
 *
 *      RWA token (ERC-1155) is escrowed in this contract when auction is created,
 *      and transferred to the winner on finalization.
 *
 *      CRE integration via ReceiverTemplate: the _processReport callback
 *      receives (auctionId, winner, winningBid) from the Confidential Enclave.
 */
contract MaskBidAuction is AccessControl, ReentrancyGuard, ERC1155Holder, ReceiverTemplate {
    using SafeERC20 for IERC20;

    // ================================================================
    // ROLES
    // ================================================================
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ================================================================
    // STATE
    // ================================================================
    IERC20 public immutable usdc;
    IERC1155 public immutable rwaToken; // TokenizedAssetPlatform (ERC-1155)

    enum AuctionState { Created, Active, Ended, Finalized, Cancelled }

    struct Auction {
        uint256 tokenId;         // RWA token ID from TokenizedAssetPlatform
        uint256 tokenAmount;     // Amount of ERC-1155 tokens being auctioned
        address seller;          // Auctioneer who deposited the token
        uint256 reservePrice;    // Minimum acceptable bid (USDC, 6 decimals)
        uint256 depositRequired; // USDC deposit required to place a bid
        uint256 startTime;       // Auction start (unix timestamp)
        uint256 endTime;         // Auction end (unix timestamp)
        AuctionState state;
        address winner;          // Set by CRE on finalization
        uint256 winningBid;      // Set by CRE on finalization
        uint256 bidCount;        // Number of sealed bids received
    }

    struct Bid {
        address bidder;
        bytes32 bidHash;         // keccak256(encrypted bid payload)
        uint256 escrowAmount;    // USDC deposited as escrow
        bool refunded;           // Whether the bidder has reclaimed escrow
    }

    // Storage
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(uint256 => Bid)) public auctionBids; // auctionId => bidIndex => Bid
    mapping(uint256 => mapping(address => bool)) public hasBid;     // auctionId => bidder => bool

    uint256 private _nextAuctionId = 1;

    // ================================================================
    // EVENTS
    // ================================================================
    event AuctionCreated(
        uint256 indexed auctionId,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 tokenAmount,
        uint256 reservePrice,
        uint256 depositRequired,
        uint256 startTime,
        uint256 endTime
    );

    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        bytes32 indexed bidHash,
        uint256 escrowAmount
    );

    event AuctionEnded(
        uint256 indexed auctionId,
        uint256 endTime
    );

    event AuctionFinalized(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 indexed winningBid
    );

    event AuctionCancelled(
        uint256 indexed auctionId,
        address indexed cancelledBy
    );

    event BidRefunded(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount
    );

    // ================================================================
    // CONSTRUCTOR
    // ================================================================
    /**
     * @param _usdc USDC token address (6 decimals)
     * @param _rwaToken TokenizedAssetPlatform (ERC-1155) address
     * @param _forwarderAddr Chainlink CRE forwarder address
     */
    constructor(
        address _usdc,
        address _rwaToken,
        address _forwarderAddr
    ) ReceiverTemplate(_forwarderAddr) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_rwaToken != address(0), "Invalid RWA token address");

        usdc = IERC20(_usdc);
        rwaToken = IERC1155(_rwaToken);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // ================================================================
    // AUCTION LIFECYCLE
    // ================================================================

    /**
     * @notice Create a new sealed-bid auction for an RWA token.
     *         The seller must have approved this contract for the ERC-1155 token.
     *         The token is escrowed in this contract until finalization or cancellation.
     * @param tokenId RWA token ID from TokenizedAssetPlatform
     * @param tokenAmount Amount of ERC-1155 tokens to auction
     * @param reservePrice Minimum bid in USDC (6 decimals)
     * @param depositRequired USDC deposit required per bid
     * @param startTime Auction start timestamp
     * @param endTime Auction end timestamp
     */
    function createAuction(
        uint256 tokenId,
        uint256 tokenAmount,
        uint256 reservePrice,
        uint256 depositRequired,
        uint256 startTime,
        uint256 endTime
    ) external nonReentrant returns (uint256) {
        require(tokenAmount > 0, "Token amount must be > 0");
        require(depositRequired > 0, "Deposit must be > 0");
        require(startTime >= block.timestamp, "Start time must be in the future");
        require(endTime > startTime, "End time must be after start time");
        require(endTime - startTime >= 1 hours, "Auction must last at least 1 hour");

        // Transfer the RWA token from seller into this contract (escrow)
        rwaToken.safeTransferFrom(msg.sender, address(this), tokenId, tokenAmount, "");

        uint256 auctionId = _nextAuctionId++;

        auctions[auctionId] = Auction({
            tokenId: tokenId,
            tokenAmount: tokenAmount,
            seller: msg.sender,
            reservePrice: reservePrice,
            depositRequired: depositRequired,
            startTime: startTime,
            endTime: endTime,
            state: AuctionState.Created,
            winner: address(0),
            winningBid: 0,
            bidCount: 0
        });

        emit AuctionCreated(
            auctionId, tokenId, msg.sender, tokenAmount,
            reservePrice, depositRequired, startTime, endTime
        );

        return auctionId;
    }

    /**
     * @notice Place a sealed bid on an active auction.
     *         Bidder must approve USDC for depositRequired amount first.
     * @param auctionId The auction to bid on
     * @param bidHash keccak256 hash of the encrypted bid payload
     */
    function placeBid(
        uint256 auctionId,
        bytes32 bidHash
    ) external nonReentrant {
        Auction storage auction = auctions[auctionId];

        require(auction.seller != address(0), "Auction does not exist");
        require(block.timestamp >= auction.startTime, "Auction not started");
        require(block.timestamp < auction.endTime, "Auction has ended");
        require(msg.sender != auction.seller, "Seller cannot bid");
        require(!hasBid[auctionId][msg.sender], "Already placed a bid");
        require(bidHash != bytes32(0), "Invalid bid hash");

        // Auto-activate auction on first interaction after start
        if (auction.state == AuctionState.Created && block.timestamp >= auction.startTime) {
            auction.state = AuctionState.Active;
        }

        require(
            auction.state == AuctionState.Active || auction.state == AuctionState.Created,
            "Auction not accepting bids"
        );

        // Transfer USDC escrow from bidder
        usdc.safeTransferFrom(msg.sender, address(this), auction.depositRequired);

        // Record bid
        uint256 bidIndex = auction.bidCount;
        auctionBids[auctionId][bidIndex] = Bid({
            bidder: msg.sender,
            bidHash: bidHash,
            escrowAmount: auction.depositRequired,
            refunded: false
        });

        hasBid[auctionId][msg.sender] = true;
        auction.bidCount++;

        emit BidPlaced(auctionId, msg.sender, bidHash, auction.depositRequired);
    }

    /**
     * @notice Mark an auction as ended. Anyone can call this once endTime has passed.
     *         This makes the auction eligible for CRE finalization.
     * @param auctionId The auction to end
     */
    function endAuction(uint256 auctionId) external {
        Auction storage auction = auctions[auctionId];

        require(auction.seller != address(0), "Auction does not exist");
        require(block.timestamp >= auction.endTime, "Auction not yet ended");
        require(
            auction.state == AuctionState.Active || auction.state == AuctionState.Created,
            "Auction already ended or finalized"
        );

        auction.state = AuctionState.Ended;

        emit AuctionEnded(auctionId, auction.endTime);
    }

    /**
     * @notice Finalize an auction by setting the winner. Can only be called by admin
     *         or via CRE _processReport. Transfers the RWA token to the winner and
     *         USDC escrow to the seller.
     * @param auctionId The auction to finalize
     * @param winner The winning bidder address
     * @param winningBid The winning bid amount in USDC
     */
    function finalizeAuction(
        uint256 auctionId,
        address winner,
        uint256 winningBid
    ) public onlyRole(ADMIN_ROLE) nonReentrant {
        _finalize(auctionId, winner, winningBid);
    }

    /**
     * @notice Claim USDC escrow refund as a losing bidder after auction is finalized.
     * @param auctionId The auction ID
     */
    function claimRefund(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];

        require(
            auction.state == AuctionState.Finalized || auction.state == AuctionState.Cancelled,
            "Auction not finalized or cancelled"
        );

        // Find the bidder's bid
        bool found = false;
        for (uint256 i = 0; i < auction.bidCount; i++) {
            Bid storage bid = auctionBids[auctionId][i];
            if (bid.bidder == msg.sender && !bid.refunded) {
                // Winner doesn't get a refund (their escrow is kept as partial payment)
                // unless the auction was cancelled
                if (auction.state == AuctionState.Finalized && msg.sender == auction.winner) {
                    revert("Winner cannot claim refund");
                }

                bid.refunded = true;
                usdc.safeTransfer(msg.sender, bid.escrowAmount);

                emit BidRefunded(auctionId, msg.sender, bid.escrowAmount);
                found = true;
                break;
            }
        }

        require(found, "No refundable bid found");
    }

    /**
     * @notice Cancel an auction. Only seller (before bids) or admin can cancel.
     *         If cancelled, all bidders can claim refunds and seller gets token back.
     * @param auctionId The auction ID
     */
    function cancelAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];

        require(auction.seller != address(0), "Auction does not exist");
        require(
            auction.state == AuctionState.Created ||
            auction.state == AuctionState.Active ||
            auction.state == AuctionState.Ended,
            "Cannot cancel finalized or already cancelled auction"
        );

        // Only seller (before any bids) or admin can cancel
        if (msg.sender == auction.seller) {
            require(auction.bidCount == 0, "Seller can only cancel before bids are placed");
        } else {
            require(hasRole(ADMIN_ROLE, msg.sender), "Not authorized to cancel");
        }

        auction.state = AuctionState.Cancelled;

        // Return the escrowed RWA token to the seller
        rwaToken.safeTransferFrom(
            address(this), auction.seller,
            auction.tokenId, auction.tokenAmount, ""
        );

        emit AuctionCancelled(auctionId, msg.sender);
    }

    // ================================================================
    // CRE INTEGRATION
    // ================================================================

    /**
     * @notice CRE callback to finalize an auction from the Confidential Enclave.
     *         Decodes (auctionId, winner, winningBid) from the report.
     */
    function _processReport(bytes calldata report) internal override {
        (uint256 auctionId, address winner, uint256 winningBid) =
            abi.decode(report, (uint256, address, uint256));

        _finalize(auctionId, winner, winningBid);
    }

    // ================================================================
    // INTERNAL
    // ================================================================

    function _finalize(
        uint256 auctionId,
        address winner,
        uint256 winningBid
    ) internal {
        Auction storage auction = auctions[auctionId];

        require(auction.seller != address(0), "Auction does not exist");
        require(
            auction.state == AuctionState.Ended ||
            auction.state == AuctionState.Active ||
            auction.state == AuctionState.Created,
            "Auction already finalized or cancelled"
        );
        require(winner != address(0), "Invalid winner address");
        require(hasBid[auctionId][winner], "Winner has not bid on this auction");

        auction.state = AuctionState.Finalized;
        auction.winner = winner;
        auction.winningBid = winningBid;

        // Transfer the escrowed RWA token to the winner
        rwaToken.safeTransferFrom(
            address(this), winner,
            auction.tokenId, auction.tokenAmount, ""
        );

        // Transfer the winner's USDC escrow to the seller
        // (The winner's deposit goes to the seller as partial/full payment)
        for (uint256 i = 0; i < auction.bidCount; i++) {
            Bid storage bid = auctionBids[auctionId][i];
            if (bid.bidder == winner && !bid.refunded) {
                bid.refunded = true; // Mark as consumed (not actually a refund)
                usdc.safeTransfer(auction.seller, bid.escrowAmount);
                break;
            }
        }

        emit AuctionFinalized(auctionId, winner, winningBid);
    }

    // ================================================================
    // VIEW FUNCTIONS
    // ================================================================

    function getAuction(uint256 auctionId) external view returns (Auction memory) {
        return auctions[auctionId];
    }

    function getBid(uint256 auctionId, uint256 bidIndex) external view returns (Bid memory) {
        return auctionBids[auctionId][bidIndex];
    }

    function getAuctionState(uint256 auctionId) external view returns (AuctionState) {
        return auctions[auctionId].state;
    }

    function getNextAuctionId() external view returns (uint256) {
        return _nextAuctionId;
    }

    // ================================================================
    // INTERFACE OVERRIDES
    // ================================================================

    function supportsInterface(bytes4 interfaceId)
        public view override(AccessControl, ERC1155Holder, ReceiverTemplate)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
