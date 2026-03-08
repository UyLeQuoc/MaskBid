// kyc-handler — Supabase Edge Function
// Called exclusively by the Chainlink CRE kyc-verification-workflow
// after the World ID proof has been verified in CRE consensus.
//
// This function holds the ADMIN_PRIVATE_KEY as a Supabase secret and
// writes setKYCStatus(wallet_address, true) on-chain.
//
// JWT verification: OFF (called by CRE, not authenticated users)

import { ethers } from "npm:ethers@6";

const STATUS_OK = 200;
const STATUS_BAD_REQUEST = 400;
const STATUS_SERVER_ERROR = 500;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const SET_KYC_ABI = [
  "function setKYCStatus(address user, bool status) external",
];

function buildResponse(statusCode: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return buildResponse(STATUS_BAD_REQUEST, { error: "Only POST method is supported" });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return buildResponse(STATUS_BAD_REQUEST, { error: "Invalid JSON in request body" });
  }

  const { wallet_address } = body;
  if (!wallet_address || typeof wallet_address !== "string") {
    return buildResponse(STATUS_BAD_REQUEST, { error: "Missing wallet_address" });
  }

  // Validate wallet address format
  if (!ethers.isAddress(wallet_address)) {
    return buildResponse(STATUS_BAD_REQUEST, { error: "Invalid wallet_address format" });
  }

  const adminPrivateKey = Deno.env.get("ADMIN_PRIVATE_KEY");
  const contractAddress = Deno.env.get("ASSET_CONTRACT_ADDRESS");
  const rpcUrl = Deno.env.get("RPC_URL");

  if (!adminPrivateKey || !contractAddress || !rpcUrl) {
    console.error("Missing required environment variables: ADMIN_PRIVATE_KEY, ASSET_CONTRACT_ADDRESS, RPC_URL");
    return buildResponse(STATUS_SERVER_ERROR, { error: "Server configuration error" });
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(adminPrivateKey, provider);
    const contract = new ethers.Contract(contractAddress, SET_KYC_ABI, signer);

    console.log(`Setting KYC status for ${wallet_address}...`);
    const tx = await contract.setKYCStatus(wallet_address, true);
    const receipt = await tx.wait();

    console.log(`KYC set on-chain. txHash: ${receipt.hash}`);

    return buildResponse(STATUS_OK, {
      success: true,
      txHash: receipt.hash,
      wallet_address,
      blockNumber: receipt.blockNumber,
    });
  } catch (error) {
    const err = error as Error;
    console.error("On-chain KYC failed:", err.message);
    return buildResponse(STATUS_SERVER_ERROR, {
      error: "On-chain KYC transaction failed",
      details: err.message,
    });
  }
});
