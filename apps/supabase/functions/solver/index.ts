import { createClient } from "jsr:@supabase/supabase-js@2";

const STATUS_OK = 200;
const STATUS_UNAUTHORIZED = 401;
const STATUS_BAD_REQUEST = 400;
const STATUS_SERVER_ERROR = 500;

// The SOLVER_AUTH_TOKEN that only the Chainlink Enclave knows
const EXPECTED_TOKEN = Deno.env.get("SOLVER_AUTH_TOKEN_DEV");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// RSA Private Key for decrypting bids (stored securely, never exposed)
const RSA_PRIVATE_KEY = Deno.env.get("RSA_PRIVATE_KEY");

function buildResponse(statusCode: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/**
 * ABI-encode the report data for MaskBidAuction._processReport
 * Format: (uint256 auctionId, address winner, uint256 winningBid)
 * Returns the hex-encoded ABI data
 */
function encodeAuctionReport(
  auctionId: number,
  winner: string,
  winningBid: number,
): string {
  // Remove 0x prefix from winner address if present
  const cleanWinner = winner.toLowerCase().replace(/^0x/, "");

  // Pad auctionId to 32 bytes (64 hex chars)
  const auctionIdHex = BigInt(auctionId).toString(16).padStart(64, "0");

  // Pad winner address to 32 bytes (64 hex chars, left-padded with zeros)
  const winnerHex = cleanWinner.padStart(64, "0");

  // Pad winningBid to 32 bytes (64 hex chars) - convert from USDC (6 decimals)
  // winningBid is already in USDC units, just convert to BigInt
  const winningBidUnits = BigInt(Math.floor(winningBid * 1e6));
  const winningBidHex = winningBidUnits.toString(16).padStart(64, "0");

  // Function selector for _processReport(bytes calldata report) is not needed
  // The Forwarder calls onReport(bytes metadata, bytes report) directly
  // and the report bytes are decoded via abi.decode inside _processReport

  // ABI-encoded tuple: (uint256 auctionId, address winner, uint256 winningBid)
  const encodedReport = `0x${auctionIdHex}${winnerHex}${winningBidHex}`;

  return encodedReport;
}

/**
 * Decrypt a bid using RSA private key
 * In production, this would use proper crypto libraries
 */
async function decryptBid(
  encryptedBid: string,
  privateKey: string,
): Promise<{ user: string; amount: number }> {
  // TODO: Implement actual RSA decryption
  // For hackathon demo, we'll simulate decryption
  // In production: use Web Crypto API or node-forge
  try {
    const decoded = atob(encryptedBid);
    return JSON.parse(decoded);
  } catch {
    throw new Error("Failed to decrypt bid");
  }
}

/**
 * The Secure Solver - Only runs when authorized by Chainlink Enclave
 */
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return buildResponse(STATUS_BAD_REQUEST, {
      error: "Only POST method is supported",
    });
  }

  // ============================================================================
  // GATEKEEPER CHECK: Verify request came from Chainlink Confidential Enclave
  // ============================================================================
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!EXPECTED_TOKEN) {
    console.error("⛔ SOLVER_AUTH_TOKEN_DEV not configured");
    return buildResponse(STATUS_SERVER_ERROR, { error: "Solver not configured" });
  }

  if (token !== EXPECTED_TOKEN) {
    console.log("⛔ Attack blocked: Invalid or missing authorization token");
    console.log("   Expected:", EXPECTED_TOKEN?.slice(0, 10) + "...");
    console.log("   Received:", token?.slice(0, 10) + "...");
    return buildResponse(STATUS_UNAUTHORIZED, {
      error: "Access Denied: Enclave Signature Missing",
      message:
        "This endpoint only accepts requests from authorized Chainlink Confidential Enclaves",
    });
  }

  console.log("✅ Authorization verified: Request from Chainlink Enclave");

  // Parse request body
  let body: {
    auctionId?: string;
    contractAuctionId?: number;
    action?: string;
  };
  try {
    body = await req.json();
  } catch {
    return buildResponse(STATUS_BAD_REQUEST, {
      error: "Invalid JSON in request body",
    });
  }

  const { auctionId, contractAuctionId, action } = body;

  if (!auctionId || action !== "resolve") {
    return buildResponse(STATUS_BAD_REQUEST, {
      error: "Missing required fields: auctionId and action='resolve'",
    });
  }

  console.log(`🔒 Resolving auction: ${auctionId}`);

  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // ============================================================================
    // FETCH ENCRYPTED BIDS
    // ============================================================================
    const { data: bids, error: bidsError } = await supabase
      .from("bids")
      .select("*")
      .eq("auction_id", auctionId)
      .eq("status", "active");

    if (bidsError) {
      console.error("Failed to fetch bids:", bidsError);
      throw new Error("Failed to fetch bids from database");
    }

    if (!bids || bids.length === 0) {
      return buildResponse(STATUS_BAD_REQUEST, {
        error: "No active bids found for this auction",
        auctionId,
      });
    }

    console.log(`📊 Found ${bids.length} bids for auction ${auctionId}`);

    // ============================================================================
    // DECRYPT BIDS (The confidential logic)
    // ============================================================================
    if (!RSA_PRIVATE_KEY) {
      console.warn("⚠️  RSA_PRIVATE_KEY not set, using mock decryption for demo");
    }

    const decryptedBids = await Promise.all(
      bids.map(async (bid) => {
        try {
          // In production: decrypt with RSA_PRIVATE_KEY
          // For demo: assuming bid.encrypted_data is base64-encoded JSON
          const decrypted = RSA_PRIVATE_KEY
            ? await decryptBid(bid.encrypted_data, RSA_PRIVATE_KEY)
            : JSON.parse(atob(bid.encrypted_data));

          return {
            user: bid.bidder_address || decrypted.user,
            amount: Number(decrypted.amount),
            bidId: bid.id,
          };
        } catch (err) {
          console.error(`Failed to decrypt bid ${bid.id}:`, err);
          return null;
        }
      }),
    );

    const validBids = decryptedBids.filter((b): b is {
      user: string;
      amount: number;
      bidId: string;
    } => b !== null && b.amount > 0);

    if (validBids.length === 0) {
      return buildResponse(STATUS_BAD_REQUEST, {
        error: "No valid bids after decryption",
        auctionId,
      });
    }

    console.log(`✅ Successfully decrypted ${validBids.length} valid bids`);

    // ============================================================================
    // DETERMINE WINNER (Highest bid)
    // ============================================================================
    const winner = validBids.sort((a, b) => b.amount - a.amount)[0];

    console.log(`🏆 Winner: ${winner.user} with bid ${winner.amount}`);

    // Update bid status in database
    await supabase
      .from("bids")
      .update({ status: "won", won_at: new Date().toISOString() })
      .eq("id", winner.bidId);

    await supabase
      .from("bids")
      .update({ status: "lost" })
      .eq("auction_id", auctionId)
      .neq("id", winner.bidId);

    // Update auction status
    await supabase
      .from("auctions")
      .update({
        status: "resolved",
        winner_address: winner.user,
        winning_amount: winner.amount,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", auctionId);

    // ============================================================================
    // GET CONTRACT AUCTION ID
    // ============================================================================
    // Use provided contractAuctionId or fetch from database
    let onChainAuctionId = contractAuctionId;
    if (!onChainAuctionId) {
      const { data: auction } = await supabase
        .from("auctions")
        .select("contract_auction_id")
        .eq("id", auctionId)
        .single();

      if (auction?.contract_auction_id) {
        onChainAuctionId = auction.contract_auction_id;
      } else {
        console.warn("⚠️  No contract_auction_id found, using 0");
        onChainAuctionId = 0;
      }
    }

    // ============================================================================
    // ENCODE REPORT FOR ON-CHAIN DELIVERY
    // ============================================================================
    // Create ABI-encoded report for MaskBidAuction._processReport()
    const encodedReport = encodeAuctionReport(
      onChainAuctionId,
      winner.user,
      winner.amount,
    );

    console.log(`📝 Encoded report for on-chain delivery: ${encodedReport}`);

    // ============================================================================
    // RETURN RESULT (Will be encrypted if encryptOutput: true in workflow)
    // ============================================================================
    const result = {
      winner: winner.user,
      amount: winner.amount,
      assetId: auctionId,
      contractAuctionId: onChainAuctionId,
      totalBids: validBids.length,
      timestamp: new Date().toISOString(),
      report: encodedReport, // ABI-encoded report for _processReport()
    };

    console.log("✅ Auction resolved successfully with on-chain report");

    return buildResponse(STATUS_OK, result);
  } catch (error) {
    console.error("Solver error:", error);
    return buildResponse(STATUS_SERVER_ERROR, {
      error: "Internal solver error",
      details: (error as Error).message,
    });
  }
});
