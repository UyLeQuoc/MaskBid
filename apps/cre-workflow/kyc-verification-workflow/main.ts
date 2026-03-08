import {
  type HTTPPayload,
  type HTTPSendRequester,
  type Runtime,
  Runner,
  consensusIdenticalAggregation,
  cre,
  ok,
} from "@chainlink/cre-sdk";
import { z } from "zod";

// =============================================================================
// WORLD ID KYC VERIFICATION WORKFLOW
// Capability: Chainlink CRE HTTPClient (standard)
// Pattern: Off-chain proof verification in CRE consensus → on-chain KYC status
//
// Why this matters for the World ID + CRE track:
//   World ID is natively supported on Ethereum, Optimism, and World Chain only.
//   By verifying the World ID proof INSIDE CRE consensus, we can extend KYC
//   gating to ANY chain that CRE's EVMClient can reach — without requiring
//   World ID native deployment on that chain.
//
// Trigger: HTTP — web app POSTs proof after IDKit returns it
// Payload: { nullifier_hash, proof, merkle_root, verification_level, wallet_address }
// =============================================================================

const configSchema = z.object({
  kycHandlerUrl: z.string(),                    // Supabase kyc-handler Edge Function URL
  worldIdAppId: z.string(),                     // World ID App ID
  worldIdAction: z.string(),                    // World ID action string
  worldIdSignal: z.string(),
});

type Config = z.infer<typeof configSchema>;

type ProofPayload = {
  nullifier_hash: string;
  proof: string;
  merkle_root: string;
  verification_level: string;
  wallet_address: string;
};

type WorldIdVerifyResponse = {
  statusCode: number;
  body: string; // always a string to avoid aggregation null issues
};

type KycHandlerResponse = {
  statusCode: number;
  body: string;
};

// =============================================================================
// STEP 1: VERIFY WORLD ID PROOF VIA CHAINLINK CRE CONSENSUS
// Multiple CRE nodes independently call worldcoin.org and must agree on result.
// This is the critical difference from centralized server verification.
// =============================================================================
const verifyWorldIdProof = (
  sendRequester: HTTPSendRequester,
  config: Config,
  proofData: ProofPayload,
): WorldIdVerifyResponse => {
  const bodyBytes = new TextEncoder().encode(
    JSON.stringify({
      nullifier_hash: proofData.nullifier_hash,
      proof: proofData.proof,
      merkle_root: proofData.merkle_root,
      verification_level: proofData.verification_level,
      action: config.worldIdAction,
      signal: config.worldIdSignal,
    }),
  );

  const req = {
    url: `https://developer.worldcoin.org/api/v2/verify/${config.worldIdAppId}`,
    method: "POST" as const,
    body: Buffer.from(bodyBytes).toString("base64"),
    headers: { "Content-Type": "application/json" },
  };

  const resp = sendRequester.sendRequest(req).result();

  return {
    statusCode: resp.statusCode,
    body: (ok(resp) && resp.body)
      ? (typeof resp.body === "string" ? resp.body : Buffer.from(resp.body).toString("base64"))
      : Buffer.from("{}").toString("base64"),
  };
};

// =============================================================================
// STEP 2: SET KYC STATUS ON-CHAIN VIA SUPABASE KYC-HANDLER EDGE FUNCTION
// =============================================================================
const setKycOnChain = (
  sendRequester: HTTPSendRequester,
  config: Config,
  walletAddress: string,
): KycHandlerResponse => {
  const bodyBytes = new TextEncoder().encode(
    JSON.stringify({ wallet_address: walletAddress }),
  );

  const req = {
    url: config.kycHandlerUrl,
    method: "POST" as const,
    body: Buffer.from(bodyBytes).toString("base64"),
    headers: { "Content-Type": "application/json" },
  };

  const resp = sendRequester.sendRequest(req).result();

  if (!ok(resp)) {
    throw new Error(`kyc-handler failed: HTTP ${resp.statusCode}`);
  }

  return {
    statusCode: resp.statusCode,
    body: resp.body
      ? (typeof resp.body === "string" ? resp.body : Buffer.from(resp.body).toString("base64"))
      : Buffer.from("{}").toString("base64"),
  };
};

// =============================================================================
// HTTP TRIGGER HANDLER
// payload.input contains the JSON body sent by the web app after IDKit returns
// =============================================================================
const onHttpTrigger = async (runtime: Runtime<Config>, payload: HTTPPayload): Promise<string> => {
  const config = runtime.config;

  // Parse JSON body from HTTP trigger payload
  // In production: sent by KYCFlow.tsx after IDKit returns a valid proof
  // In simulation: passed via --http-payload flag
  let proofData: ProofPayload;
  try {
    proofData = JSON.parse(new TextDecoder().decode(payload.input)) as ProofPayload;
  } catch {
    throw new Error("Invalid JSON in HTTP trigger payload");
  }

  const { wallet_address, nullifier_hash, proof, merkle_root } = proofData;

  if (!wallet_address || !nullifier_hash || !proof || !merkle_root) {
    throw new Error("Missing required fields: wallet_address, nullifier_hash, proof, merkle_root");
  }

  runtime.log(`Verifying World ID proof for wallet: ${wallet_address}`);
  runtime.log(`App ID: ${config.worldIdAppId} | Action: ${config.worldIdAction} | Level: ${proofData.verification_level}`);

  // ── Step 1: Verify proof with worldcoin.org in CRE consensus ────────────
  const httpClient = new cre.capabilities.HTTPClient();

  const verifyResult = httpClient
    .sendRequest(
      runtime,
      (req, cfg) => verifyWorldIdProof(req, cfg as Config, proofData),
      consensusIdenticalAggregation<WorldIdVerifyResponse>(),
    )(config)
    .result();

  runtime.log(`World ID API response: HTTP ${verifyResult.statusCode}`);

  if (verifyResult.statusCode !== 200) {
    let errDetail = "Proof rejected by World ID";
    try {
      const errBody = JSON.parse(new TextDecoder().decode(Buffer.from(verifyResult.body, "base64")));
      errDetail = errBody.detail || errBody.code || errDetail;
    } catch { /* ignore */ }
    runtime.log(`Verification failed: ${errDetail}`);
    return JSON.stringify({
      success: false,
      error: errDetail,
      wallet_address,
      timestamp: new Date().toISOString(),
    });
  }

  runtime.log(`World ID proof verified in CRE consensus for ${wallet_address}`);

  // ── Step 2: Set KYC status on-chain via kyc-handler ─────────────────────
  const kycResult = httpClient
    .sendRequest(
      runtime,
      (req, cfg) => setKycOnChain(req, cfg as Config, wallet_address),
      consensusIdenticalAggregation<KycHandlerResponse>(),
    )(config)
    .result();

  let txHash: string | undefined;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(Buffer.from(kycResult.body, "base64")));
    txHash = parsed.txHash;
  } catch { /* ignore */ }

  runtime.log(`KYC set on-chain. txHash: ${txHash ?? "unknown"}`);

  return JSON.stringify({
    success: true,
    wallet_address,
    txHash,
    verifiedBy: "chainlink-cre-consensus",
    timestamp: new Date().toISOString(),
  });
};

// =============================================================================
// WORKFLOW INITIALIZATION
// =============================================================================
const initWorkflow = (_config: Config) => {
  const httpTrigger = new cre.capabilities.HTTPCapability();
  return [
    cre.handler(httpTrigger.trigger({}), onHttpTrigger),
  ];
};

// =============================================================================
// MAIN
// =============================================================================
export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(initWorkflow);
}

main();
