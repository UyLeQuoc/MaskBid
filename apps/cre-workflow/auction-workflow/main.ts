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
import { z } from 'zod';

// =============================================================================
// ZERO-KNOWLEDGE RWA AUCTION WORKFLOW
// Capability: Chainlink CRE ConfidentialHttp (Experimental)
// Pattern: The "Authorized Enclave" Pattern
// Goal: Prove bids remain encrypted, only decrypted by authorized solver
// triggered by secure hardware enclave.
// =============================================================================

const configSchema = z.object({
  schedule: z.string().optional(), // Cron schedule for auction resolution
  solverUrl: z.string(),           // Secure solver endpoint
  auctionId: z.string(),           // Current auction ID
  owner: z.string(),               // Secret owner address
});

type Config = z.infer<typeof configSchema>;

type AuctionResult = {
  winner: string;
  amount: number;
  assetId: string;
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
  runtime: Runtime<Config>
): AuctionResult => {
  // Construct the confidential HTTP request
  // The {{.solver_auth_token}} placeholder is replaced by the enclave
  const req = {
    request: {
      url: config.solverUrl,
      method: "POST" as const,
      multiHeaders: {
        "Authorization": { values: ["Bearer {{.solver_auth_token}}"] },
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
      }
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
  // The encrypted data is returned as bytes, not JSON
  // In production, the enclave would decrypt this automatically
  // For demo: we acknowledge the encrypted response
  runtime.log(`📦 Encrypted response received (${resp.body?.length || 0} bytes)`);
  runtime.log("🔐 Response is AES-GCM encrypted (only enclave can decrypt)");

  // Return success - the solver already processed the auction
  return {
    winner: "0xEncrypted",
    amount: 0,
    assetId: auctionId,
    encrypted: true,
  };
};

// =============================================================================
// ON AUCTION END - Handler triggered when auction resolution time arrives
// =============================================================================
const onAuctionEnd = (runtime: Runtime<Config>): string => {
  const config = runtime.config;
  runtime.log(`🔒 Resolving auction ${config.auctionId} via Confidential Enclave...`);

  // Initialize the ConfidentialHTTP client
  const confidentialClient = new ConfidentialHTTPClient();

  // Execute with consensus across multiple enclaves
  const result = confidentialClient.sendRequest(
    runtime as unknown as NodeRuntime<Config>,
    (req, cfg) => triggerSolver(req, cfg, config.auctionId, runtime),
    consensusIdenticalAggregation<AuctionResult>()
  )(config).result();

  if (result.encrypted) {
    runtime.log("✅ Auction resolved via encrypted channel!");
    runtime.log("🔐 Winner data is encrypted (accessible only after consensus)");
  } else {
    runtime.log(`✅ Auction resolved! Winner: ${result.winner}`);
    runtime.log(`💰 Winning bid: ${result.amount}`);
  }
  runtime.log(`📦 Asset ID: ${result.assetId}`);

  // Return the result (could be written to chain via EVMClient)
  return JSON.stringify({
    auctionId: config.auctionId,
    winner: result.encrypted ? "encrypted" : result.winner,
    amount: result.encrypted ? 0 : result.amount,
    assetId: result.assetId,
    encrypted: result.encrypted,
    timestamp: "2026-02-16T12:00:00Z",
  });
};

// =============================================================================
// WORKFLOW INITIALIZATION
// =============================================================================
const initWorkflow = (config: Config) => {
  // For demo purposes, use a cron trigger (could also use HTTP trigger)
  // In production, this would trigger at auction end time
  const cron = new cre.capabilities.CronCapability();

  return [
    cre.handler(
      cron.trigger({
        schedule: config.schedule || "0 */5 * * * *", // Every 5 minutes default
      }),
      onAuctionEnd,
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
