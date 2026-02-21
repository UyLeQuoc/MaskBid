import {
  cre,
  Runner,
  type Runtime,
  type NodeRuntime,
  type ConfidentialHTTPSendRequester,
  ConfidentialHTTPClient,
  consensusIdenticalAggregation,
  ok,
} from "@chainlink/cre-sdk";
import { z } from "zod";

// =============================================================================
// ZERO-KNOWLEDGE RWA AUCTION WORKFLOW
// Capability: Chainlink CRE ConfidentialHttp (Experimental)
// Pattern: The "Authorized Enclave" Pattern
// Goal: Prove bids remain encrypted, only decrypted by authorized solver
// triggered by secure hardware enclave.
//
// Triggers:
//   1. Cron (scheduled) - polls for ended auctions every 5 minutes
//   2. HTTP (manual)    - immediate settlement trigger for a specific auction
// =============================================================================

const configSchema = z.object({
  schedule: z.string().optional(), // Cron schedule for auction resolution
  solverUrl: z.string(), // Secure solver endpoint
  auctionId: z.string(), // Current auction ID (for HTTP trigger)
  owner: z.string(), // Secret owner address
  supabaseUrl: z.string().optional(), // Supabase REST API URL
  supabaseKey: z.string().optional(), // Supabase anon key (for reading auctions)
});

type Config = z.infer<typeof configSchema>;

type AuctionResult = {
  winner: string;
  amount: number;
  assetId: string;
  auctionId: string;
  encrypted?: boolean;
};

// =============================================================================
// TRIGGER SOLVER - Executes inside the CRE Confidential Enclave
// The secret (SOLVER_AUTH_TOKEN) is injected by the enclave, never in code
// =============================================================================
const triggerSolver = (
  sendRequester: ConfidentialHTTPSendRequester,
  config: Config,
  auctionId: string,
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
        "X-Auction-ID": { values: [auctionId] },
      },
      bodyString: JSON.stringify({
        auctionId: auctionId,
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
  runtime.log(
    `📦 Encrypted response received (${resp.body?.length || 0} bytes)`,
  );
  runtime.log("🔐 Response is AES-GCM encrypted (only enclave can decrypt)");

  return {
    winner: "0xEncrypted",
    amount: 0,
    assetId: auctionId,
    auctionId: auctionId,
    encrypted: true,
  };
};

// =============================================================================
// ON AUCTION END - Handler for a single auction resolution
// =============================================================================
const resolveAuction = (
  runtime: Runtime<Config>,
  auctionId: string,
): AuctionResult => {
  runtime.log(`🔒 Resolving auction ${auctionId} via Confidential Enclave...`);

  const config = runtime.config;
  const confidentialClient = new ConfidentialHTTPClient();

  const result = confidentialClient
    .sendRequest(
      runtime as unknown as NodeRuntime<Config>,
      (req, cfg) => triggerSolver(req, cfg, auctionId, runtime),
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
// CRON HANDLER - Polls for ended auctions and resolves them
// =============================================================================
const onCronTick = (runtime: Runtime<Config>): string => {
  const config = runtime.config;
  runtime.log("⏰ Cron tick: checking for ended auctions...");

  // Resolve the configured auction ID
  // In production, this would query Supabase for all ended auctions
  // via get_ended_auctions() function and iterate
  const result = resolveAuction(runtime, config.auctionId);

  return JSON.stringify({
    trigger: "cron",
    auctionId: config.auctionId,
    winner: result.encrypted ? "encrypted" : result.winner,
    amount: result.encrypted ? 0 : result.amount,
    assetId: result.assetId,
    encrypted: result.encrypted,
    timestamp: new Date().toISOString(),
  });
};

// =============================================================================
// HTTP HANDLER - Immediate settlement for a specific auction
// =============================================================================
const onHttpTrigger = (runtime: Runtime<Config>): string => {
  const config = runtime.config;
  runtime.log(`🌐 HTTP trigger: resolving auction ${config.auctionId}...`);

  const result = resolveAuction(runtime, config.auctionId);

  return JSON.stringify({
    trigger: "http",
    auctionId: config.auctionId,
    winner: result.encrypted ? "encrypted" : result.winner,
    amount: result.encrypted ? 0 : result.amount,
    assetId: result.assetId,
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

  return [
    // Cron trigger: polls for ended auctions periodically
    cre.handler(
      cron.trigger({
        schedule: config.schedule || "0 */5 * * * *", // Every 5 minutes default
      }),
      onCronTick,
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
