// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {TokenizedAssetPlatform} from "../src/TokenizedAssetPlatform.sol";

contract DeployScript is Script {
    // Chainlink CRE forwarder for Ethereum Sepolia
    // https://docs.chain.link/cre/guides/workflow/using-evm-client/supported-networks-ts
    address constant FORWARDER = 0x15fC6ae953E024d975e77382eEeC56A9101f9F88;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        TokenizedAssetPlatform platform = new TokenizedAssetPlatform(FORWARDER);

        vm.stopBroadcast();

        console.log("TokenizedAssetPlatform deployed to:", address(platform));
        console.log("\nUpdate these files:");
        console.log("  asset-log-trigger-workflow/config.json  -> evms[0].assetAddress");
        console.log("  apps/web/.env  -> CONTRACT_ADDRESS + NEXT_PUBLIC_CONTRACT_ADDRESS");
    }
}
