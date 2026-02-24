// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import {ReceiverTemplate} from "./interfaces/ReceiverTemplate.sol";

/**
 * @title MaskBidAsset
 * @dev A platform for real world assets (RWA).
 *      ERC-1155 standard is used to manage multiple asset types.
 *      Asset lifecycle: Register → Verify+Mint → Redeem
 *
 *      registerAsset: any KYC-verified user can register their own asset (issuer = msg.sender)
 *      verifyAndMint: admin-only, verifies and mints 1 RWA NFT to the issuer in one tx
 *      redeem:        token holders (including issuer) burn their token
 */
contract MaskBidAsset is ERC1155, AccessControl, ERC1155Burnable, ReceiverTemplate {
    using Strings for uint256;

    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    struct Asset {
        string name;
        string symbol;
        string assetType;
        address issuer;
        uint256 totalSupply;
        bool active;
        string uid;
    }

    struct UpdateMetadataCallData {
        uint256 assetId;
        string newUri;
    }

    mapping(uint256 => Asset) public assets;
    mapping(uint256 => address) public assetIssuers;
    uint256 private _nextAssetId = 1;

    // ─── Events ───────────────────────────────────────────────────────────────

    event AssetRegistered(
        uint256 indexed assetId,
        address indexed issuer,
        string name,
        string symbol,
        string assetType,
        string description,
        string serialNumber,
        uint256 reservePrice,
        uint256 requiredDeposit,
        uint256 auctionDuration
    );

    event AssetVerified(
        uint256 indexed assetId,
        bool indexed isValid,
        string verificationDetails
    );

    event TokensMinted(
        uint256 indexed assetId,
        uint256 indexed amount,
        address indexed to,
        string reason
    );

    event TokensRedeemed(
        uint256 indexed assetId,
        uint256 indexed amount,
        address indexed account,
        string settlementDetails
    );

    event TokensTransferred(uint256 indexed assetId, address indexed from, address indexed to, uint256 amount);
    event AssetUidUpdated(uint256 indexed assetId, string newUri);

    // KYC state
    mapping(address => bool) public kycVerified;
    event KYCStatusUpdated(address indexed user, bool indexed status);

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address forwardAddr) ERC1155("") ReceiverTemplate(forwardAddr) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // ─── CRE report handler ───────────────────────────────────────────────────

    function _processReport(bytes calldata report) internal override {
        (uint64 assetId, string memory _uid) = abi.decode(report, (uint64, string));
        require(assetId != 0, "invalid asset Id");
        updateSystemOfRecordMetadata(assetId, _uid);
    }

    // ─── Asset lifecycle ──────────────────────────────────────────────────────

    /**
     * @dev Register a new asset. Caller must be KYC-verified; they become the issuer.
     */
    function registerAsset(
        string memory name,
        string memory symbol,
        string memory assetType,
        string memory description,
        string memory serialNumber,
        uint256 reservePrice,
        uint256 requiredDeposit,
        uint256 auctionDuration
    ) public {
        require(isKYCVerified(msg.sender), "Not KYC verified");

        address issuer = msg.sender;
        uint256 assetId = _nextAssetId++;

        assets[assetId] = Asset({
            name: name,
            symbol: symbol,
            assetType: assetType,
            issuer: issuer,
            totalSupply: 0,
            active: false,
            uid: ""
        });

        assetIssuers[assetId] = issuer;
        _grantRole(ISSUER_ROLE, issuer);

        emit AssetRegistered(
            assetId,
            issuer,
            name,
            symbol,
            assetType,
            description,
            serialNumber,
            reservePrice,
            requiredDeposit,
            auctionDuration
        );
    }

    /**
     * @dev Verify an asset and mint 1 RWA NFT to the issuer in a single tx.
     *      Emits AssetVerified (index 0) and TokensMinted (index 2, after ERC1155 TransferSingle).
     *      Admin-only.
     */
    function verifyAndMint(uint256 assetId, string memory verificationDetails) public onlyRole(ADMIN_ROLE) {
        require(!assets[assetId].active, "Already verified");
        require(assetIssuers[assetId] != address(0), "Asset does not exist");

        assets[assetId].active = true;
        emit AssetVerified(assetId, true, verificationDetails);

        address issuer = assetIssuers[assetId];
        assets[assetId].totalSupply += 1;
        _mint(issuer, assetId, 1, "");

        emit TokensMinted(assetId, 1, issuer, "Initial RWA NFT");
    }

    /**
     * @dev Legacy verifyAsset — kept for backwards compat with existing scripts.
     */
    function verifyAsset(uint256 assetId, bool isValid, string memory verificationDetails) public {
        require(_isIssuerOrAdmin(assetId, msg.sender), "Not authorized to verify");
        assets[assetId].active = isValid;
        emit AssetVerified(assetId, isValid, verificationDetails);
    }

    /**
     * @dev Mint tokens for an asset. Requires issuer or admin, asset must be active.
     */
    function mint(address to, uint256 assetId, uint256 amount, string memory reason) public {
        require(_isIssuerOrAdmin(assetId, msg.sender), "Not authorized to mint");
        require(assets[assetId].active, "Asset is not active");
        require(to != address(0), "Invalid recipient");

        assets[assetId].totalSupply += amount;
        _mint(to, assetId, amount, "");

        emit TokensMinted(assetId, amount, to, reason);
    }

    /**
     * @dev Redeem (burn) tokens. Token holders or issuer/admin can call this.
     */
    function redeem(uint256 assetId, uint256 amount, string memory settlementDetails) public {
        require(assets[assetId].active, "Asset is not active");
        if (!_isIssuerOrAdmin(assetId, msg.sender)) {
            require(balanceOf(msg.sender, assetId) >= amount, "Insufficient balance");
        }

        assets[assetId].totalSupply -= amount;
        _burn(msg.sender, assetId, amount);

        emit TokensRedeemed(assetId, amount, msg.sender, settlementDetails);
    }

    // ─── Overrides ────────────────────────────────────────────────────────────

    function burn(address, uint256, uint256) public virtual override {
        revert("Use redeem function");
    }

    function burnBatch(address, uint256[] memory, uint256[] memory) public virtual override {
        revert("Use redeem function");
    }

    function _update(
        address from,
        address to,
        uint256[] memory assetIds,
        uint256[] memory amounts
    ) internal virtual override(ERC1155) {
        for (uint256 i = 0; i < assetIds.length; i++) {
            require(assets[assetIds[i]].active, "Asset is not active");
        }
        super._update(from, to, assetIds, amounts);

        if (from != address(0) && to != address(0)) {
            for (uint256 i = 0; i < assetIds.length; i++) {
                if (amounts[i] > 0) {
                    emit TokensTransferred(assetIds[i], from, to, amounts[i]);
                }
            }
        }
    }

    // ─── Metadata ─────────────────────────────────────────────────────────────

    function updateSystemOfRecordMetadata(uint256 assetId, string memory _uid) public {
        assets[assetId].uid = _uid;
        emit AssetUidUpdated(assetId, _uid);
    }

    function uid(uint256 assetId) public view returns (string memory) {
        return assets[assetId].uid;
    }

    // ─── KYC ──────────────────────────────────────────────────────────────────

    function setKYCStatus(address user, bool status) public onlyRole(ADMIN_ROLE) {
        kycVerified[user] = status;
        emit KYCStatusUpdated(user, status);
    }

    function isKYCVerified(address user) public view returns (bool) {
        return kycVerified[user];
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function totalSupply(uint256 id) public view returns (uint256) {
        return assets[id].totalSupply;
    }

    function _isIssuer(uint256 assetId, address account) internal view returns (bool) {
        return assetIssuers[assetId] == account;
    }

    function _isIssuerOrAdmin(uint256 assetId, address account) internal view returns (bool) {
        return _isIssuer(assetId, account) || hasRole(ADMIN_ROLE, account);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl, ReceiverTemplate)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
