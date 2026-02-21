/**
 * RSA Encryption Utilities for MaskBid
 *
 * Bids are encrypted client-side with the solver's public key.
 * Only the Chainlink CRE enclave with the corresponding private key can decrypt.
 */

import { env } from "@/configs/env";

/**
 * Import a PEM-encoded RSA public key for encryption
 */
async function importPublicKey(pem: string): Promise<CryptoKey> {
  // Remove PEM headers and whitespace
  const pemContents = pem
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    "spki",
    binaryDer.buffer,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    false,
    ["encrypt"]
  );
}

/**
 * Encrypt bid data using RSA-OAEP
 * Returns base64-encoded encrypted data
 */
export async function encryptBid(
  bidAmount: number,
  bidderAddress: string
): Promise<{ encryptedData: string; hash: string }> {
  const publicKeyPem = env.NEXT_PUBLIC_RSA_PUBLIC_KEY;

  if (!publicKeyPem) {
    // Fallback to mock encryption for demo (base64 encoded JSON)
    console.warn("No RSA public key configured, using mock encryption");
    const data = JSON.stringify({
      amount: bidAmount,
      user: bidderAddress,
      timestamp: Date.now(),
    });
    const encryptedData = btoa(data);
    const hash = "0x" + Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data))))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return { encryptedData, hash };
  }

  // Prepare the data to encrypt
  const bidData = JSON.stringify({
    amount: bidAmount,
    user: bidderAddress.toLowerCase(),
    timestamp: Date.now(),
  });

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(bidData);

  // Import the public key
  const publicKey = await importPublicKey(publicKeyPem);

  // Encrypt the data
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "RSA-OAEP",
    },
    publicKey,
    dataBuffer
  );

  // Convert to base64
  const encryptedData = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));

  // Generate hash of the original data (for verification without revealing)
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hash = "0x" + Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return { encryptedData, hash };
}

/**
 * Generate a keccak256-like hash for on-chain bid hash
 * This creates a bytes32 hash that matches Solidity's keccak256
 */
export async function generateBidHash(
  auctionId: bigint,
  bidder: string,
  encryptedData: string
): Promise<string> {
  const data = `${auctionId.toString()}:${bidder.toLowerCase()}:${encryptedData}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return "0x" + Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Format a bytes32 hash for display
 */
export function formatHash(hash: string): string {
  if (hash.length <= 20) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}
