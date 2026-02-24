import { createClient } from "jsr:@supabase/supabase-js@2";

const STATUS_OK = 200;
const STATUS_BAD_REQUEST = 400;
const STATUS_NOT_FOUND = 404;
const STATUS_SERVER_ERROR = 500;

// ============================================================================
// REQUIRED FIELDS VALIDATION
// ============================================================================
const REQUIRED_FIELDS: Record<string, string[]> = {
  AuctionCreated: ["auctionId", "tokenId", "seller", "tokenAmount", "reservePrice", "depositRequired", "startTime", "endTime"],
  BidPlaced: ["auctionId", "bidder", "bidHash", "escrowAmount"],
  AuctionEnded: ["auctionId", "endTime"],
  AuctionFinalized: ["auctionId", "winner", "winningBid"],
  BidRefunded: ["auctionId", "bidder", "amount"],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function validateParams(action: string, params: Record<string, unknown>): void {
  const required = REQUIRED_FIELDS[action];
  if (!required || !required.every((field) => params[field] != null)) {
    throw new Error(`Missing required parameters for ${action}`);
  }
}

function buildResponse(statusCode: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// ============================================================================
// VALIDATE REQUEST ORIGIN
// Checks if request is from authorized CRE workflow
// ============================================================================
function validateRequestOrigin(req: Request): boolean {
  // In production, validate that the request came from Chainlink CRE
  // This could check for:
  // - A shared secret in headers
  // - IP whitelist
  // - Signature verification

  const authHeader = req.headers.get("Authorization");
  const expectedToken = Deno.env.get("CRE_WEBHOOK_TOKEN");

  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    console.warn("Unauthorized request attempt");
    return false;
  }

  return true;
}

// ============================================================================
// HANDLERS
// ============================================================================
type SupabaseClient = ReturnType<typeof createClient>;

const handlers: Record<
  string,
  (client: SupabaseClient, params: Record<string, unknown>) => Promise<unknown>
> = {
  // ==========================================================================
  // AuctionCreated: Insert new auction into database
  // ==========================================================================
  async AuctionCreated(client, {
    auctionId,
    tokenId,
    seller,
    tokenAmount,
    reservePrice,
    depositRequired,
    startTime,
    endTime,
    txHash,
  }) {
    // Convert Unix timestamps to ISO strings
    const startDate = new Date(Number(startTime) * 1000).toISOString();
    const endDate = new Date(Number(endTime) * 1000).toISOString();

    // Check if auction already exists (by contract_auction_id)
    const { data: existing } = await client
      .from("auctions")
      .select("id")
      .eq("contract_auction_id", Number(auctionId))
      .maybeSingle();

    if (existing) {
      console.log(`Auction ${auctionId} already exists, skipping insert`);
      return { message: "Auction already exists", auctionId };
    }

    // Generate a UUID for the auction
    const auctionUUID = crypto.randomUUID();

    const { error } = await client.from("auctions").insert({
      id: auctionUUID,
      asset_id: tokenId?.toString() || "unknown",
      seller_address: seller,
      start_price: Number(reservePrice) / 1e6, // Convert from USDC (6 decimals)
      reserve_price: Number(reservePrice) / 1e6,
      status: "active",
      started_at: startDate,
      ends_at: endDate,
      contract_auction_id: Number(auctionId),
      deposit_required: Number(depositRequired) / 1e6,
      token_id: Number(tokenId),
      token_amount: Number(tokenAmount),
      tx_hash_create: txHash?.toString(),
    });

    if (error) {
      console.error("Failed to insert auction:", error);
      throw new Error(error.message);
    }

    console.log(`Auction ${auctionId} created with UUID ${auctionUUID}`);
    return { message: "Auction created successfully", auctionId, id: auctionUUID };
  },

  // ==========================================================================
  // BidPlaced: Insert new bid into database
  // ==========================================================================
  async BidPlaced(client, {
    auctionId,
    bidder,
    bidHash,
    escrowAmount,
    txHash,
  }) {
    // Find the auction by contract_auction_id
    const { data: auction, error: auctionError } = await client
      .from("auctions")
      .select("id")
      .eq("contract_auction_id", Number(auctionId))
      .single();

    if (auctionError || !auction) {
      console.error(`Auction ${auctionId} not found`);
      throw Object.assign(new Error(`Auction ${auctionId} not found`), {
        statusCode: STATUS_NOT_FOUND,
      });
    }

    // Generate a UUID for the bid
    const bidUUID = crypto.randomUUID();

    const { error } = await client.from("bids").insert({
      id: bidUUID,
      auction_id: auction.id,
      bidder_address: bidder,
      bid_hash: bidHash,
      encrypted_data: "", // Will be filled by bidder app
      hashed_amount: "", // Will be filled by bidder app
      status: "active",
      escrow_tx_hash: txHash?.toString(),
    });

    if (error) {
      console.error("Failed to insert bid:", error);
      throw new Error(error.message);
    }

    console.log(`Bid placed for auction ${auctionId} by ${bidder}`);
    return { message: "Bid recorded successfully", auctionId, bidder, id: bidUUID };
  },

  // ==========================================================================
  // AuctionEnded: Update auction status to 'ended'
  // ==========================================================================
  async AuctionEnded(client, { auctionId, endTime }) {
    const { error } = await client
      .from("auctions")
      .update({
        status: "ended",
        ends_at: new Date(Number(endTime) * 1000).toISOString(),
      })
      .eq("contract_auction_id", Number(auctionId));

    if (error) {
      console.error("Failed to update auction status:", error);
      throw new Error(error.message);
    }

    console.log(`Auction ${auctionId} marked as ended`);
    return { message: "Auction marked as ended", auctionId };
  },

  // ==========================================================================
  // AuctionFinalized: Update auction with winner and mark as resolved
  // ==========================================================================
  async AuctionFinalized(client, {
    auctionId,
    winner,
    winningBid,
    txHash,
  }) {
    // Update auction status
    const { error: auctionError } = await client
      .from("auctions")
      .update({
        status: "resolved",
        winner_address: winner,
        winning_amount: Number(winningBid) / 1e6, // Convert from USDC (6 decimals)
        resolved_at: new Date().toISOString(),
        tx_hash_finalize: txHash?.toString(),
      })
      .eq("contract_auction_id", Number(auctionId));

    if (auctionError) {
      console.error("Failed to update auction:", auctionError);
      throw new Error(auctionError.message);
    }

    // Find the winning bid and update its status
    const { data: auction } = await client
      .from("auctions")
      .select("id")
      .eq("contract_auction_id", Number(auctionId))
      .single();

    if (auction) {
      // Update winner bid status
      const { error: winnerBidError } = await client
        .from("bids")
        .update({ status: "won" })
        .eq("auction_id", auction.id)
        .eq("bidder_address", winner);

      if (winnerBidError) {
        console.error("Failed to update winner bid:", winnerBidError);
      }

      // Update all other bids as lost
      const { error: loserBidsError } = await client
        .from("bids")
        .update({ status: "lost" })
        .eq("auction_id", auction.id)
        .neq("bidder_address", winner);

      if (loserBidsError) {
        console.error("Failed to update loser bids:", loserBidsError);
      }
    }

    console.log(`Auction ${auctionId} finalized with winner ${winner}`);
    return { message: "Auction finalized", auctionId, winner, winningBid };
  },

  // ==========================================================================
  // BidRefunded: Update bid status to 'refunded'
  // ==========================================================================
  async BidRefunded(client, { auctionId, bidder, amount, txHash }) {
    // Find the auction
    const { data: auction } = await client
      .from("auctions")
      .select("id")
      .eq("contract_auction_id", Number(auctionId))
      .single();

    if (!auction) {
      throw Object.assign(new Error(`Auction ${auctionId} not found`), {
        statusCode: STATUS_NOT_FOUND,
      });
    }

    // Update the bid status
    const { error } = await client
      .from("bids")
      .update({
        status: "refunded",
        refund_tx_hash: txHash?.toString(),
      })
      .eq("auction_id", auction.id)
      .eq("bidder_address", bidder);

    if (error) {
      console.error("Failed to update bid refund status:", error);
      throw new Error(error.message);
    }

    console.log(`Bid refunded for auction ${auctionId} by ${bidder}`);
    return { message: "Bid marked as refunded", auctionId, bidder, amount };
  },
};

// ============================================================================
// MAIN HANDLER
// ============================================================================
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

  // Validate request origin (optional, based on CRE_WEBHOOK_TOKEN)
  if (!validateRequestOrigin(req)) {
    return buildResponse(STATUS_UNAUTHORIZED, {
      error: "Unauthorized",
      message: "Request must come from authorized Chainlink CRE workflow",
    });
  }

  // Parse request body
  let params: Record<string, unknown>;
  try {
    params = await req.json();
  } catch {
    return buildResponse(STATUS_BAD_REQUEST, {
      error: "Invalid JSON in request body",
    });
  }

  const action = params.action as string;

  if (!action || !handlers[action]) {
    return buildResponse(STATUS_BAD_REQUEST, {
      error: "Invalid action",
      validActions: Object.keys(handlers),
    });
  }

  try {
    validateParams(action, params);
  } catch (err) {
    return buildResponse(STATUS_BAD_REQUEST, {
      error: (err as Error).message,
    });
  }

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    return buildResponse(STATUS_SERVER_ERROR, {
      error: "Server configuration error: Supabase not configured",
    });
  }

  const client = createClient(supabaseUrl, supabaseKey);

  try {
    const result = await handlers[action](client, params);
    return buildResponse(STATUS_OK, result);
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    console.error("Error handling auction event:", err.message);

    const statusCode = err.statusCode ?? STATUS_SERVER_ERROR;
    const body =
      statusCode === STATUS_SERVER_ERROR
        ? { error: "Internal server error", details: err.message }
        : { error: err.message };

    return buildResponse(statusCode, body);
  }
});
