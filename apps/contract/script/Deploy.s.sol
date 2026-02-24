// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MaskBidAsset} from "../src/MaskBidAsset.sol";
import {MaskBidAuction} from "../src/MaskBidAuction.sol";

contract DeployScript is Script {
    // Chainlink CRE forwarder for Ethereum Sepolia
    // https://docs.chain.link/cre/guides/workflow/using-evm-client/supported-networks-ts
    address constant FORWARDER = 0x15fC6ae953E024d975e77382eEeC56A9101f9F88;

    // USDC on Sepolia (Circle's official test USDC)
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        MaskBidAsset platform = new MaskBidAsset(FORWARDER);
        MaskBidAuction auction = new MaskBidAuction(USDC, address(platform), FORWARDER);

        vm.stopBroadcast();

        console.log("MaskBidAsset deployed to:          ", address(platform));
        console.log("MaskBidAuction deployed to:        ", address(auction));
        console.log("\nUpdate these files:");
        console.log("  apps/contract/.env                                -> CONTRACT_ADDRESS, AUCTION_CONTRACT_ADDRESS");
        console.log("  apps/contract/.env.example                        -> CONTRACT_ADDRESS, AUCTION_CONTRACT_ADDRESS");
        console.log("  apps/web/.env + .env.example                      -> NEXT_PUBLIC_CONTRACT_ADDRESS, NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS");
        console.log("  apps/cre-workflow/asset-log-trigger-workflow/config.json -> evms[0].assetAddress");
        console.log("  apps/cre-workflow/auction-workflow/config.json    -> auctionAddress");
    }
}
