/**
 * Test script for solver RSA decryption.
 * Encrypts a bid with the public key (same as frontend), inserts into Supabase,
 * calls the solver, and verifies the result.
 *
 * Required env vars (reads from apps/web/.env and apps/cre-workflow/.env):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SOLVER_AUTH_TOKEN_DEV
 *
 * Usage: bunx tsx test-solver.ts
 */

// Load env files
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path: string) {
	try {
		const content = readFileSync(resolve(path), "utf-8");
		for (const line of content.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const eqIdx = trimmed.indexOf("=");
			if (eqIdx === -1) continue;
			const key = trimmed.slice(0, eqIdx).trim();
			let val = trimmed.slice(eqIdx + 1).trim();
			// Strip surrounding quotes
			if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
				val = val.slice(1, -1);
			}
			if (!process.env[key]) process.env[key] = val;
		}
	} catch {
		// File not found, skip
	}
}

loadEnvFile("../web/.env");
loadEnvFile("../cre-workflow/.env");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SOLVER_TOKEN = process.env.SOLVER_AUTH_TOKEN_DEV;

if (!SUPABASE_URL || !SUPABASE_KEY || !SOLVER_TOKEN) {
	console.error("Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SOLVER_AUTH_TOKEN_DEV");
	console.error("Ensure apps/web/.env and apps/cre-workflow/.env exist with these values.");
	process.exit(1);
}

const SOLVER_URL = `${SUPABASE_URL}/functions/v1/solver`;

const RSA_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmK26XwXYYeUuNRtHFW7Z
T5j7QT61O8u6a5Xp9y0WqFaT0wM6vn/u3lFc8Ce54wmF2Ol9nc+P7OgWozRPdfeK
JPNw++sWnb9t/5foDRw2REJg23Ans04E3N4/fxAz2Waag+2w2TCPrUkmqeKw6JKH
e56H+ANA7M43YGsw6PdSc5Ijydmu1+B6EaQE7DrfQJ9sRMxsBOcHtg+Sf/nsekY6
Ly8jX+Lsj/YAFboMv6RUQRgKbh+UNIJWc/wBobul8mScLkVxrzO1Ib7gIh4vcCiz
ooWuh/OeI76EwFCTIsbcBdHo+6HeQfVpb5m8EAsPxJ3A2u5ndERdoEcn4/DM3moz
TwIDAQAB
-----END PUBLIC KEY-----`;

const TEST_AUCTION_ID = "test-solver-rsa-" + Date.now();
const TEST_BIDDER = "0x1234567890abcdef1234567890abcdef12345678";
const TEST_BID_AMOUNT = 150;

// --- RSA Encryption (same as apps/web/src/lib/crypto.ts) ---

async function importPublicKey(pem: string): Promise<CryptoKey> {
	const pemContents = pem
		.replace("-----BEGIN PUBLIC KEY-----", "")
		.replace("-----END PUBLIC KEY-----", "")
		.replace(/\s/g, "");

	const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

	return await crypto.subtle.importKey(
		"spki",
		binaryDer.buffer,
		{ name: "RSA-OAEP", hash: "SHA-256" },
		false,
		["encrypt"],
	);
}

async function encryptBid(
	amount: number,
	user: string,
): Promise<string> {
	const bidData = JSON.stringify({
		amount,
		user: user.toLowerCase(),
		timestamp: Date.now(),
	});

	const publicKey = await importPublicKey(RSA_PUBLIC_KEY_PEM);
	const encoded = new TextEncoder().encode(bidData);
	const encrypted = await crypto.subtle.encrypt(
		{ name: "RSA-OAEP" },
		publicKey,
		encoded,
	);

	return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

// --- Supabase helpers ---

async function supabasePost(table: string, data: Record<string, unknown>) {
	const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
		method: "POST",
		headers: {
			apikey: SUPABASE_KEY,
			Authorization: `Bearer ${SUPABASE_KEY}`,
			"Content-Type": "application/json",
			Prefer: "return=representation",
		},
		body: JSON.stringify(data),
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Supabase POST ${table} failed: ${res.status} ${text}`);
	}
	return res.json();
}

async function supabaseDelete(table: string, column: string, value: string) {
	const res = await fetch(
		`${SUPABASE_URL}/rest/v1/${table}?${column}=eq.${value}`,
		{
			method: "DELETE",
			headers: {
				apikey: SUPABASE_KEY,
				Authorization: `Bearer ${SUPABASE_KEY}`,
			},
		},
	);
	if (!res.ok) {
		console.warn(`Cleanup warning: DELETE ${table} returned ${res.status}`);
	}
}

// --- Main test ---

async function main() {
	console.log("=== Solver RSA Decryption Test ===\n");

	// Step 1: Encrypt a bid
	console.log(`1. Encrypting bid: ${TEST_BID_AMOUNT} USDC from ${TEST_BIDDER}`);
	const encryptedData = await encryptBid(TEST_BID_AMOUNT, TEST_BIDDER);
	console.log(`   Encrypted (first 40 chars): ${encryptedData.slice(0, 40)}...`);

	// Step 2: Insert test asset + auction
	console.log(`\n2. Inserting test asset + auction: ${TEST_AUCTION_ID}`);
	await supabasePost("asset_states", {
		asset_id: "test-asset-001",
		asset_name: "Test RWA Asset",
		asset_type: "real_estate",
		issuer: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		supply: 1,
		verified: true,
		token_minted: 1,
		token_redeemed: 0,
	});
	await supabasePost("auctions", {
		id: TEST_AUCTION_ID,
		asset_id: "test-asset-001",
		seller_address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		start_price: 100,
		reserve_price: 100,
		status: "active",
		started_at: new Date(Date.now() - 3600000).toISOString(),
		ends_at: new Date(Date.now() - 60000).toISOString(),
		contract_auction_id: 999,
	});
	console.log("   Auction inserted.");

	// Step 3: Insert encrypted bid
	console.log("\n3. Inserting RSA-encrypted bid into Supabase...");
	await supabasePost("bids", {
		auction_id: TEST_AUCTION_ID,
		bidder_address: TEST_BIDDER,
		encrypted_data: encryptedData,
		hashed_amount: "0xdeadbeef",
		status: "active",
	});
	console.log("   Bid inserted.");

	// Step 4: Call solver
	console.log("\n4. Calling solver...");
	const solverRes = await fetch(SOLVER_URL, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${SOLVER_TOKEN}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			auctionId: TEST_AUCTION_ID,
			contractAuctionId: 999,
			action: "resolve",
		}),
	});

	const solverBody = await solverRes.json();
	console.log(`   Status: ${solverRes.status}`);
	console.log(`   Response:`, JSON.stringify(solverBody, null, 2));

	// Step 5: Verify
	console.log("\n5. Verification:");
	if (solverRes.status === 200 && solverBody.winner) {
		const amountMatch = solverBody.amount === TEST_BID_AMOUNT;
		const winnerMatch =
			solverBody.winner.toLowerCase() === TEST_BIDDER.toLowerCase();
		console.log(`   Winner correct:  ${winnerMatch ? "PASS" : "FAIL"} (${solverBody.winner})`);
		console.log(`   Amount correct:  ${amountMatch ? "PASS" : "FAIL"} (${solverBody.amount})`);
		console.log(
			`\n   ${amountMatch && winnerMatch ? "ALL TESTS PASSED" : "SOME TESTS FAILED"}`,
		);
	} else {
		console.log(`   FAILED — solver returned: ${JSON.stringify(solverBody)}`);
	}

	// Step 6: Cleanup
	console.log("\n6. Cleaning up test data...");
	await supabaseDelete("bids", "auction_id", TEST_AUCTION_ID);
	await supabaseDelete("auctions", "id", TEST_AUCTION_ID);
	await supabaseDelete("asset_states", "asset_id", "test-asset-001");
	console.log("   Done.\n");
}

main().catch(console.error);
