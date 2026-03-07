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
 *        Created → Active → Ended → PendingClaim → Finalized → (done)
 *                                 → Cancelled  → (refunds)
 *        PendingClaim → Cancelled (on expireClaim after deadline)
 *
 *      Bids are sealed (only bidHash stored on-chain). The actual bid amount
 *      is encrypted off-chain and resolved by the Chainlink CRE solver.
 *      USDC escrow is locked on bid placement; losers reclaim after finalization.
 *
 *      RWA token (ERC-1155) is escrowed in this contract when auction is created,
 *      and transferred to the winner on finalization (claimWin).
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
    IERC1155 public immutable rwaToken; // MaskBidAsset (ERC-1155)

    enum AuctionState { Created, Active, Ended, PendingClaim, Finalized, Cancelled }

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
        uint256 claimDeadline;   // Deadline for winner to call claimWin (set on PendingClaim)
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

    event WinnerClaimRequired(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 winningBid,
        uint256 depositPaid,
        uint256 balanceDue,
        uint256 deadline
    );

    event WinClaimed(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 totalPaid
    );

    event ClaimExpired(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 forfeitedDeposit
    );

    /// @dev Test-only: emitted when start time is overridden for demo purposes
    event AuctionStartTimeUpdated(
        uint256 indexed auctionId,
        uint256 newStartTime
    );

    /// @dev Test-only: emitted when end time is overridden for demo purposes
    event AuctionEndTimeUpdated(
        uint256 indexed auctionId,
        uint256 newEndTime
    );

    // ================================================================
    // CONSTRUCTOR
    // ================================================================
    /**
     * @param _usdc USDC token address (6 decimals)
     * @param _rwaToken MaskBidAsset (ERC-1155) address
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
            bidCount: 0,
            claimDeadline: 0
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
     *         or via CRE _processReport. Sets state to PendingClaim — the winner
     *         must call claimWin() within 48 hours to complete the purchase.
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
     * @notice Winner calls this to complete the purchase after finalization.
     *         Pulls the remaining USDC (winningBid - deposit) from the winner,
     *         transfers the RWA token to the winner, and USDC to the seller.
     * @param auctionId The auction ID
     */
    function claimWin(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];

        require(auction.seller != address(0), "Auction does not exist");
        require(auction.state == AuctionState.PendingClaim, "Auction not in PendingClaim state");
        require(msg.sender == auction.winner, "Only winner can claim");
        require(block.timestamp <= auction.claimDeadline, "Claim deadline has passed");

        auction.state = AuctionState.Finalized;

        // Find winner's bid and mark as consumed
        uint256 depositAmount = 0;
        for (uint256 i = 0; i < auction.bidCount; i++) {
            Bid storage bid = auctionBids[auctionId][i];
            if (bid.bidder == auction.winner && !bid.refunded) {
                bid.refunded = true;
                depositAmount = bid.escrowAmount;
                break;
            }
        }

        // Pull remaining USDC from winner if winningBid > deposit
        uint256 remainingDue = auction.winningBid > depositAmount
            ? auction.winningBid - depositAmount
            : 0;

        if (remainingDue > 0) {
            usdc.safeTransferFrom(auction.winner, address(this), remainingDue);
        }

        // Transfer total USDC (deposit + remaining) to seller
        uint256 totalToSeller = depositAmount + remainingDue;
        if (totalToSeller > 0) {
            usdc.safeTransfer(auction.seller, totalToSeller);
        }

        // Transfer RWA token to winner
        rwaToken.safeTransferFrom(
            address(this), auction.winner,
            auction.tokenId, auction.tokenAmount, ""
        );

        emit WinClaimed(auctionId, auction.winner, totalToSeller);
        emit AuctionFinalized(auctionId, auction.winner, auction.winningBid);
    }

    /**
     * @notice Anyone can call this after the claim deadline passes to expire the pending claim.
     *         The winner's deposit is forfeited to the seller as compensation.
     *         The RWA token is returned to the seller.
     *         State is set to Cancelled so losing bidders can claimRefund.
     * @param auctionId The auction ID
     */
    function expireClaim(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];

        require(auction.seller != address(0), "Auction does not exist");
        require(auction.state == AuctionState.PendingClaim, "Auction not in PendingClaim state");
        require(block.timestamp > auction.claimDeadline, "Claim deadline has not passed");

        auction.state = AuctionState.Cancelled;

        // Forfeit winner's deposit to seller as compensation
        uint256 forfeitedDeposit = 0;
        for (uint256 i = 0; i < auction.bidCount; i++) {
            Bid storage bid = auctionBids[auctionId][i];
            if (bid.bidder == auction.winner && !bid.refunded) {
                bid.refunded = true;
                forfeitedDeposit = bid.escrowAmount;
                break;
            }
        }

        if (forfeitedDeposit > 0) {
            usdc.safeTransfer(auction.seller, forfeitedDeposit);
        }

        // Return RWA token to seller
        rwaToken.safeTransferFrom(
            address(this), auction.seller,
            auction.tokenId, auction.tokenAmount, ""
        );

        emit ClaimExpired(auctionId, auction.winner, forfeitedDeposit);
        emit AuctionCancelled(auctionId, msg.sender);
    }

    /**
     * @notice Claim USDC escrow refund as a losing bidder after auction is finalized or cancelled.
     *         Non-winners can also claim during PendingClaim state without waiting for winner.
     * @param auctionId The auction ID
     */
    function claimRefund(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];

        require(
            auction.state == AuctionState.Finalized ||
            auction.state == AuctionState.Cancelled ||
            auction.state == AuctionState.PendingClaim,
            "Auction not finalized, pending claim, or cancelled"
        );

        // Find the bidder's bid
        bool found = false;
        for (uint256 i = 0; i < auction.bidCount; i++) {
            Bid storage bid = auctionBids[auctionId][i];
            if (bid.bidder == msg.sender && !bid.refunded) {
                // Winner cannot claim refund in Finalized or PendingClaim states
                if (
                    (auction.state == AuctionState.Finalized || auction.state == AuctionState.PendingClaim)
                    && msg.sender == auction.winner
                ) {
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
    // TEST HELPERS (admin only — for demo/hackathon use)
    // ================================================================

    /**
     * @notice Set auction startTime to block.timestamp - 30 seconds (already started).
     *         Immediately activates the auction for bidding in demo/hackathon scenarios.
     */
    function setAuctionStartSoon(uint256 auctionId) external {
        Auction storage auction = auctions[auctionId];
        require(auction.seller != address(0), "Auction does not exist");
        require(
            auction.state == AuctionState.Created || auction.state == AuctionState.Active,
            "Cannot update ended or cancelled auction"
        );
        uint256 newStartTime = block.timestamp - 30;
        require(newStartTime < auction.endTime, "New start time must be before end time");
        auction.startTime = newStartTime;
        // Transition to Active since startTime is now in the past
        if (auction.state == AuctionState.Created) {
            auction.state = AuctionState.Active;
        }
        emit AuctionStartTimeUpdated(auctionId, newStartTime);
    }

    /**
     * @notice Set auction endTime to block.timestamp + 30 seconds.
     *         Useful for fast-forwarding an auction to nearly-ended state.
     */
    function setAuctionEndSoon(uint256 auctionId) external {
        Auction storage auction = auctions[auctionId];
        require(auction.seller != address(0), "Auction does not exist");
        require(
            auction.state == AuctionState.Created || auction.state == AuctionState.Active,
            "Cannot update ended or cancelled auction"
        );
        uint256 newEndTime = block.timestamp + 30;
        require(newEndTime > auction.startTime, "End time must be after start time");
        auction.endTime = newEndTime;
        emit AuctionEndTimeUpdated(auctionId, newEndTime);
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

        auction.state = AuctionState.PendingClaim;
        auction.winner = winner;
        auction.winningBid = winningBid;
        auction.claimDeadline = block.timestamp + 48 hours;

        // Find winner's deposit amount for the event
        uint256 depositPaid = 0;
        for (uint256 i = 0; i < auction.bidCount; i++) {
            if (auctionBids[auctionId][i].bidder == winner) {
                depositPaid = auctionBids[auctionId][i].escrowAmount;
                break;
            }
        }

        uint256 balanceDue = winningBid > depositPaid ? winningBid - depositPaid : 0;

        emit WinnerClaimRequired(
            auctionId,
            winner,
            winningBid,
            depositPaid,
            balanceDue,
            auction.claimDeadline
        );
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
