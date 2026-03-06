import * as dotenv from "dotenv";
import { join } from "path";

dotenv.config({ path: join(process.cwd(), ".env") });

// ================================================
// Reset Tenderly Virtual TestNet block.timestamp
// to current real UTC time, clearing any accumulated
// offset from previous evm_increaseTime calls.
//
// Run this before using setAuctionStartSoon /
// setAuctionEndSoon to avoid 1-hour (or other)
// timestamp drift.
//
// Usage: npx tsx scripts/resetTimestamp.ts
// ================================================

async function resetTimestamp() {
  const rpcUrl = process.env.TENDERLY_VIRTUAL_TESTNET_RPC_URL;
  if (!rpcUrl) throw new Error("TENDERLY_VIRTUAL_TESTNET_RPC_URL not found in .env");

  const nowSeconds = Math.floor(Date.now() / 1000);
  const nowHex = `0x${nowSeconds.toString(16)}`;

  // Check current block timestamp before reset
  const blockRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_getBlockByNumber",
      params: ["latest", false],
      id: 1,
    }),
  });
  const blockData = await blockRes.json();
  const currentBlockTs = parseInt(blockData.result?.timestamp ?? "0", 16);
  const drift = currentBlockTs - nowSeconds;

  console.log(`Real UTC now  : ${nowSeconds} (${new Date(nowSeconds * 1000).toISOString()})`);
  console.log(`Block timestamp: ${currentBlockTs} (${new Date(currentBlockTs * 1000).toISOString()})`);
  console.log(`Drift          : ${drift}s (${(drift / 3600).toFixed(2)}h)`);

  if (Math.abs(drift) < 10) {
    console.log("Timestamp is already in sync. Nothing to do.");
    return;
  }

  // Set next block timestamp to current real time
  const resetRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "evm_setNextBlockTimestamp",
      params: [nowHex],
      id: 2,
    }),
  });
  const resetData = await resetRes.json();

  if (resetData.error) {
    throw new Error(`evm_setNextBlockTimestamp failed: ${JSON.stringify(resetData.error)}`);
  }

  // Mine a block so the new timestamp takes effect
  const mineRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "evm_mine",
      params: [],
      id: 3,
    }),
  });
  const mineData = await mineRes.json();

  if (mineData.error) {
    throw new Error(`evm_mine failed: ${JSON.stringify(mineData.error)}`);
  }

  console.log(`Reset complete. Next block.timestamp = ${nowSeconds} (${new Date(nowSeconds * 1000).toISOString()})`);
}

resetTimestamp().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
