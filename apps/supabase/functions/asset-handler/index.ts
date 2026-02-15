import { createClient } from "jsr:@supabase/supabase-js@2";

const STATUS_OK = 200;
const STATUS_BAD_REQUEST = 400;
const STATUS_NOT_FOUND = 404;
const STATUS_SERVER_ERROR = 500;

const REQUIRED_FIELDS: Record<string, string[]> = {
  read: ["assetId"],
  AssetRegistered: ["assetId", "issuer", "initialSupply", "assetName"],
  AssetVerified: ["assetId", "isValid"],
  TokensMinted: ["assetId", "amount"],
  TokensRedeemed: ["assetId", "amount"],
  sendNotification: ["assetId", "apiUrl"],
};

function validateParams(action: string, params: Record<string, unknown>): void {
  const required = REQUIRED_FIELDS[action];
  if (!required || !required.every((field) => params[field] != null)) {
    throw new Error("Missing required parameters");
  }
}

function buildResponse(statusCode: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { "Content-Type": "application/json" },
  });
}

type SupabaseClient = ReturnType<typeof createClient>;

const handlers: Record<
  string,
  (client: SupabaseClient, params: Record<string, unknown>) => Promise<unknown>
> = {
  async read(client, { assetId }) {
    const { data, error } = await client
      .from("asset_states")
      .select("*")
      .eq("asset_id", assetId)
      .single();

    if (error || !data) {
      throw Object.assign(new Error("Asset not found"), { statusCode: STATUS_NOT_FOUND });
    }

    return { data };
  },

  async AssetRegistered(client, { assetId, issuer, initialSupply, assetName }) {
    const { error } = await client.from("asset_states").insert({
      asset_id: assetId,
      asset_name: assetName,
      issuer,
      supply: Number(initialSupply),
      // uid, verified, token_minted, token_redeemed use column defaults
    });

    if (error) throw new Error(error.message);
    return { message: "Asset registered successfully" };
  },

  async AssetVerified(client, { assetId, isValid }) {
    const { error } = await client
      .from("asset_states")
      .update({ verified: isValid })
      .eq("asset_id", assetId);

    if (error) throw new Error(error.message);
    return { message: "Asset verified successfully", isValid };
  },

  async TokensMinted(client, { assetId, amount }) {
    const { error } = await client.rpc("increment_token_minted", {
      p_asset_id: assetId,
      p_amount: Number(amount),
    });

    if (error) throw new Error(error.message);
    return { message: "New Token minted successfully", amount };
  },

  async TokensRedeemed(client, { assetId, amount }) {
    const { error } = await client.rpc("increment_token_redeemed", {
      p_asset_id: assetId,
      p_amount: Number(amount),
    });

    if (error) throw new Error(error.message);
    return { message: "Token redeemed successfully", amount };
  },

  /**
   * Sends a POST notification to the provided API URL using asset UID data.
   * Note: Requires CRE workflow deployed on mainnet for full functionality.
   * In the demo, this action will not be used.
   * The purpose is to show how to send a POST request back to CRE.
   */
  async sendNotification(client, { assetId, apiUrl }) {
    const { data, error } = await client
      .from("asset_states")
      .select("uid")
      .eq("asset_id", assetId)
      .single();

    if (error || !data?.uid) {
      throw Object.assign(new Error("Asset UID not found"), { statusCode: STATUS_NOT_FOUND });
    }

    const postBody = JSON.stringify({
      assetId: Number(assetId),
      uid: data.uid,
    });

    const response = await fetch(apiUrl as string, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: postBody,
    });

    if (!response.ok) {
      const text = await response.text();
      throw Object.assign(new Error(`POST request failed: ${text}`), {
        statusCode: STATUS_BAD_REQUEST,
      });
    }

    const apiResponse = await response.text();
    return {
      message: "POST request sent successfully",
      assetId: Number(assetId),
      uid: data.uid,
      apiResponse,
    };
  },
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return buildResponse(STATUS_BAD_REQUEST, { error: "Only POST method is supported" });
  }

  let params: Record<string, unknown>;
  try {
    params = await req.json();
  } catch {
    return buildResponse(STATUS_BAD_REQUEST, { error: "Invalid JSON in request body" });
  }

  const action = params.action as string;

  if (!action || !handlers[action]) {
    return buildResponse(STATUS_BAD_REQUEST, { error: "Invalid action" });
  }

  try {
    validateParams(action, params);
  } catch {
    return buildResponse(STATUS_BAD_REQUEST, { error: "Missing required parameters" });
  }

  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const result = await handlers[action](client, params);
    return buildResponse(STATUS_OK, result);
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    console.error("Error:", err.message);

    const statusCode = err.statusCode ?? STATUS_SERVER_ERROR;
    const body =
      statusCode === STATUS_SERVER_ERROR
        ? { error: "Internal server error", details: err.message }
        : { error: err.message };

    return buildResponse(statusCode, body);
  }
});
