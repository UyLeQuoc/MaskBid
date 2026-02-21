import {
  cre,
  Runner,
  type Runtime,
  type NodeRuntime,
  type ConfidentialHTTPSendRequester,
  ConfidentialHTTPClient,
  consensusIdenticalAggregation,
  ok,
  getNetwork,
  hexToBase64,
  type HTTPSendRequester,
} from "@chainlink/cre-sdk";
import { z } from "zod";
import { bytesToHex, encodeAbiParameters, parseAbiParameters } from "viem";

// =============================================================================
// ZERO-KNOWLEDGE RWA AUCTION WORKFLOW
// Capability: Chainlink CRE ConfidentialHttp (Experimental)
// Pattern: The "Authorized Enclave" Pattern with On-Chain Settlement
// Goal: Prove bids remain encrypted, only decrypted by authorized solver
// triggered by secure hardware enclave, then submitted on-chain via Forwarder.
//
// Triggers:
//   1. Cron (scheduled) - polls for ended auctions every 5 minutes
//   2. HTTP (manual)    - immediate settlement trigger for a specific auction
// =============================================================================

const configSchema = z.object({
  schedule: z.string().optional(), // Cron schedule for auction resolution
  solverUrl: z.string(), // Secure solver endpoint
  auctionId: z.string().optional(), // Default auction ID (for HTTP trigger fallback)
  owner: z.string(), // Secret owner address
  supabaseUrl: z.string(), // Supabase REST API URL
  supabaseKey: z.string(), // Supabase service role key
  auctionContractAddress: z.string(), // MaskBidAuction contract address
  chainSelectorName: z.string().default("ethereum-sepolia"), // Chain selector for EVMClient
  gasLimit: z.string().default("500000"), // Gas limit for on-chain transactions
});

type Config = z.infer<typeof configSchema>;

type AuctionResult = {
  winner: string;
  amount: number;
  auctionId: string;
  contractAuctionId: number;
  encrypted?: boolean;
  report?: string; // ABI-encoded report for on-chain submission
};

type EndedAuction = {
  auction_id: string;
  asset_id: string;
  seller_address: string;
  start_price: number;
  reserve_price: number;
  ends_at: string;
  contract_auction_id: number;
  bid_count: number;
};

type SupabaseQueryResponse = {
  statusCode: number;
  body?: string;
};

// =============================================================================
// QUERY ENDED AUCTIONS FROM SUPABASE USING CRE HTTP CLIENT
// =============================================================================
const querySupabaseForEndedAuctions = (
  sendRequester: HTTPSendRequester,
  config: Config,
): SupabaseQueryResponse => {
  // Encode the request body
  const bodyBytes = new TextEncoder().encode(JSON.stringify({}));
  const body = Buffer.from(bodyBytes).toString("base64");

  const req = {
    url: `${config.supabaseUrl}/rest/v1/rpc/get_ended_auctions`,
    method: "POST" as const,
    body,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.supabaseKey}`,
      "apikey": config.supabaseKey,
    },
  };

  const resp = sendRequester.sendRequest(req).result();
  if (!ok(resp)) {
    throw new Error(`Failed to query ended auctions: ${resp.statusCode}`);
  }

  return { statusCode: resp.statusCode, body: resp.body };
};

// =============================================================================
// TRIGGER SOLVER - Executes inside the CRE Confidential Enclave
// The secret (SOLVER_AUTH_TOKEN) is injected by the enclave, never in code
// =============================================================================
const triggerSolver = (
  sendRequester: ConfidentialHTTPSendRequester,
  config: Config,
  auction: EndedAuction,
  runtime: Runtime<Config>,
): AuctionResult => {
  // Construct the confidential HTTP request
  // The {{.solver_auth_token}} placeholder is replaced by the enclave
  const req = {
    request: {
      url: config.solverUrl,
      method: "POST" as const,
      multiHeaders: {
        Authorization: { values: ["Bearer {{.solver_auth_token}}"] },
        "Content-Type": { values: ["application/json"] },
        "X-Auction-ID": { values: [auction.auction_id] },
      },
      bodyString: JSON.stringify({
        auctionId: auction.auction_id,
        contractAuctionId: auction.contract_auction_id,
        action: "resolve",
      }),
    },
    // Reference the secret from VaultDON
    vaultDonSecrets: [
      {
        key: "solver_auth_token",
        namespace: "default",
        owner: config.owner,
      },
    ],
    // Enable response encryption - even the winner is encrypted until consensus
    encryptOutput: true,
  };

  // Send the request through the confidential enclave
  const resp = sendRequester.sendRequest(req).result();

  if (!ok(resp)) {
    throw new Error(`Solver refused connection: ${resp.statusCode}`);
  }

  // When encryptOutput is true, the response is AES-GCM encrypted
  // The DON aggregates encrypted responses and delivers to Forwarder
  runtime.log(
    `📦 Encrypted response received (${resp.body?.length || 0} bytes)`,
  );
  runtime.log("🔐 Response is AES-GCM encrypted (only enclave can decrypt)");

  // Return placeholder - actual winner data is in encrypted report
  return {
    winner: "0xEncrypted",
    amount: 0,
    auctionId: auction.auction_id,
    contractAuctionId: auction.contract_auction_id,
    encrypted: true,
  };
};

// =============================================================================
// RESOLVE AUCTION - Handler for a single auction resolution
// =============================================================================
const resolveAuction = (
  runtime: Runtime<Config>,
  auction: EndedAuction,
): AuctionResult => {
  runtime.log(`🔒 Resolving auction ${auction.auction_id} (contract ID: ${auction.contract_auction_id}) via Confidential Enclave...`);

  const config = runtime.config;
  const confidentialClient = new ConfidentialHTTPClient();

  const result = confidentialClient
    .sendRequest(
      runtime as unknown as NodeRuntime<Config>,
      (req, cfg) => triggerSolver(req, cfg as Config, auction, runtime),
      consensusIdenticalAggregation<AuctionResult>(),
    )(config)
    .result();

  if (result.encrypted) {
    runtime.log("✅ Auction resolved via encrypted channel!");
    runtime.log(
      "🔐 Winner data is encrypted (accessible only after consensus)",
    );
  } else {
    runtime.log(`✅ Auction resolved! Winner: ${result.winner}`);
    runtime.log(`💰 Winning bid: ${result.amount}`);
  }
  runtime.log(`📦 Auction ID: ${result.auctionId}`);

  return result;
};

// =============================================================================
// SUBMIT WINNER ON-CHAIN VIA CONFIDENTIAL DELIVERY
// This delivers the result to MaskBidAuction._processReport()
// Note: This is called when not using encryptOutput or for manual settlement
// =============================================================================
const submitWinnerOnChain = (
  runtime: Runtime<Config>,
  auction: EndedAuction,
  winner: string,
  winningBid: number,
): string => {
  const config = runtime.config;

  runtime.log(`⛓️ Submitting winner on-chain for auction ${auction.contract_auction_id}...`);

  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: config.chainSelectorName || "ethereum-sepolia",
    isTestnet: true,
  });

  if (!network) {
    throw new Error(`Network not found: ${config.chainSelectorName}`);
  }

  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

  // Encode the report data for _processReport(bytes calldata report)
  // The report should contain: (uint256 auctionId, address winner, uint256 winningBid)
  const reportData = encodeAbiParameters(
    parseAbiParameters("uint256 auctionId, address winner, uint256 winningBid"),
    [BigInt(auction.contract_auction_id), winner as `0x${string}`, BigInt(winningBid)],
  );

  runtime.log(`📝 Encoded report: ${reportData}`);

  // Generate a signed report that will be delivered to the contract
  const reportResponse = runtime.report({
    encodedPayload: hexToBase64(reportData),
    encoderName: "evm",
    signingAlgo: "ecdsa",
    hashingAlgo: "keccak256",
  }).result();

  // Submit the report to the MaskBidAuction contract
  // The Forwarder will call onReport() which routes to _processReport()
  const writeReportResult = evmClient
    .writeReport(runtime, {
      receiver: config.auctionContractAddress,
      report: reportResponse,
      gasConfig: {
        gasLimit: config.gasLimit || "500000",
      },
    })
    .result();

  const txHash = bytesToHex(writeReportResult.txHash || new Uint8Array(32));

  runtime.log(`✅ On-chain submission successful! TxHash: ${txHash}`);

  return txHash;
};

// =============================================================================
// CRON HANDLER - Polls for ended auctions and resolves them
// =============================================================================
const onCronTick = (runtime: Runtime<Config>): string => {
  const config = runtime.config;
  runtime.log("⏰ Cron tick: checking for ended auctions...");

  try {
    // Query Supabase for ended auctions using CRE HTTP client
    const httpClient = new cre.capabilities.HTTPClient();
    const queryResult = httpClient
      .sendRequest(
        runtime,
        querySupabaseForEndedAuctions,
        consensusIdenticalAggregation<SupabaseQueryResponse>(),
      )(config)
      .result();

    if (!queryResult.body) {
      runtime.log("ℹ️ No ended auctions found (empty response)");
      return JSON.stringify({
        trigger: "cron",
        message: "No ended auctions found",
        timestamp: new Date().toISOString(),
      });
    }

    // Parse the response body
    const bodyBytes = Buffer.from(queryResult.body, "base64");
    const endedAuctions = JSON.parse(new TextDecoder().decode(bodyBytes)) as EndedAuction[];

    if (endedAuctions.length === 0) {
      runtime.log("ℹ️ No ended auctions found");
      return JSON.stringify({
        trigger: "cron",
        message: "No ended auctions found",
        timestamp: new Date().toISOString(),
      });
    }

    runtime.log(`🎯 Found ${endedAuctions.length} ended auction(s) to resolve`);

    const results = [];

    for (const auction of endedAuctions) {
      try {
        // Step 1: Resolve auction via confidential solver
        const result = resolveAuction(runtime, auction);

        results.push({
          auctionId: auction.auction_id,
          contractAuctionId: auction.contract_auction_id,
          status: "resolved",
          encrypted: result.encrypted,
        });
      } catch (error) {
        runtime.log(`❌ Failed to resolve auction ${auction.auction_id}: ${(error as Error).message}`);
        results.push({
          auctionId: auction.auction_id,
          contractAuctionId: auction.contract_auction_id,
          status: "error",
          error: (error as Error).message,
        });
      }
    }

    return JSON.stringify({
      trigger: "cron",
      auctionsProcessed: endedAuctions.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    runtime.log(`❌ Cron tick failed: ${(error as Error).message}`);
    throw error;
  }
};

// =============================================================================
// HTTP HANDLER - Immediate settlement for a specific auction
// Can optionally submit on-chain immediately after resolution
// =============================================================================
const onHttpTrigger = async (runtime: Runtime<Config>): Promise<string> => {
  const config = runtime.config;

  // For HTTP trigger, use the configured default auction or require manual input
  if (!config.auctionId) {
    throw new Error("auctionId not configured for HTTP trigger");
  }

  runtime.log(`🌐 HTTP trigger: resolving auction ${config.auctionId}...`);

  // Create a mock ended auction object for the configured auction
  const mockAuction: EndedAuction = {
    auction_id: config.auctionId,
    asset_id: "manual-trigger",
    seller_address: "0x0",
    start_price: 0,
    reserve_price: 0,
    ends_at: new Date().toISOString(),
    contract_auction_id: 0, // Will be populated from request or config
    bid_count: 0,
  };

  const result = resolveAuction(runtime, mockAuction);

  return JSON.stringify({
    trigger: "http",
    auctionId: config.auctionId,
    winner: result.encrypted ? "encrypted" : result.winner,
    amount: result.encrypted ? 0 : result.amount,
    contractAuctionId: result.contractAuctionId,
    encrypted: result.encrypted,
    timestamp: new Date().toISOString(),
  });
};

// =============================================================================
// WORKFLOW INITIALIZATION
// Two triggers: Cron (scheduled polling) + HTTP (manual immediate settlement)
// =============================================================================
const initWorkflow = (config: Config) => {
  const cron = new cre.capabilities.CronCapability();
  const httpTrigger = new cre.capabilities.HTTPCapability();

  return [
    // Cron trigger: polls for ended auctions periodically
    cre.handler(
      cron.trigger({
        schedule: config.schedule || "0 */5 * * * *", // Every 5 minutes default
      }),
      onCronTick,
    ),
    // HTTP trigger: manual auction settlement
    cre.handler(
      httpTrigger.trigger({}),
      onHttpTrigger,
    ),
  ];
};

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================
export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(initWorkflow);
}

main();
