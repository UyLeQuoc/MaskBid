import {
  cre,
  Runner,
  type Runtime,
  getNetwork,
  type HTTPPayload,
  HTTPSendRequester,
  ok,
  consensusIdenticalAggregation,
  EVMLog,
  hexToBase64,
} from "@chainlink/cre-sdk";
import { bytesToHex, decodeEventLog, encodeAbiParameters, parseAbi, parseAbiParameters } from "viem";
import { z } from "zod";

// =============================================================================
// AUCTION LOG TRIGGER WORKFLOW
// Listens to MaskBidAuction contract events and forwards to Supabase
// Events: AuctionCreated, BidPlaced, AuctionEnded, AuctionFinalized, BidRefunded
// =============================================================================

const configSchema = z.object({
  url: z.string(), // Supabase Edge Function URL
  evms: z.array(
    z.object({
      auctionAddress: z.string(), // MaskBidAuction contract address
      chainSelectorName: z.string(),
      gasLimit: z.string(),
    }),
  ),
});

type Config = z.infer<typeof configSchema>;

type PostResponse = {
  statusCode: number;
};

// Event parameter types
type AuctionCreatedParams = {
  action: "AuctionCreated";
  auctionId: string;
  tokenId: string;
  seller: string;
  tokenAmount: string;
  reservePrice: string;
  depositRequired: string;
  startTime: string;
  endTime: string;
  txHash?: string;
};

type BidPlacedParams = {
  action: "BidPlaced";
  auctionId: string;
  bidder: string;
  bidHash: string;
  escrowAmount: string;
  txHash?: string;
};

type AuctionEndedParams = {
  action: "AuctionEnded";
  auctionId: string;
  endTime: string;
  txHash?: string;
};

type AuctionFinalizedParams = {
  action: "AuctionFinalized";
  auctionId: string;
  winner: string;
  winningBid: string;
  txHash?: string;
};

type BidRefundedParams = {
  action: "BidRefunded";
  auctionId: string;
  bidder: string;
  amount: string;
  txHash?: string;
};

type AuctionEventParams =
  | AuctionCreatedParams
  | BidPlacedParams
  | AuctionEndedParams
  | AuctionFinalizedParams
  | BidRefundedParams;

// =============================================================================
// SEND EVENT DATA TO SUPABASE EDGE FUNCTION
// =============================================================================
const postEventData = (
  sendRequester: HTTPSendRequester,
  config: Config,
  eventParams: AuctionEventParams,
): PostResponse => {
  // Prepare the payload for POST request
  const dataToSend = { ...eventParams };

  // Serialize the data to JSON and encode as bytes
  const bodyBytes = new TextEncoder().encode(JSON.stringify(dataToSend));

  // Convert to base64 for the request
  const body = Buffer.from(bodyBytes).toString("base64");

  // Construct the POST request with cacheSettings
  const req = {
    url: config.url,
    method: "POST" as const,
    body,
    headers: {
      "Content-Type": "application/json",
    },
    cacheSettings: {
      readFromCache: true,
      maxAgeMs: 60000,
    },
  };

  // Send the request and wait for the response
  const resp = sendRequester.sendRequest(req).result();
  if (!ok(resp)) {
    throw new Error(`HTTP request failed with status: ${resp.statusCode}`);
  }
  return { statusCode: resp.statusCode };
};

// =============================================================================
// EVENT ABI - MaskBidAuction contract events
// =============================================================================
const eventAbi = parseAbi([
  "event AuctionCreated(uint256 indexed auctionId, uint256 indexed tokenId, address indexed seller, uint256 tokenAmount, uint256 reservePrice, uint256 depositRequired, uint256 startTime, uint256 endTime)",
  "event BidPlaced(uint256 indexed auctionId, address indexed bidder, bytes32 indexed bidHash, uint256 escrowAmount)",
  "event AuctionEnded(uint256 indexed auctionId, uint256 endTime)",
  "event AuctionFinalized(uint256 indexed auctionId, address indexed winner, uint256 indexed winningBid)",
  "event BidRefunded(uint256 indexed auctionId, address indexed bidder, uint256 amount)",
]);

// =============================================================================
// LOG TRIGGER HANDLER - Processes contract events
// =============================================================================
const onLogTrigger = (runtime: Runtime<Config>, log: EVMLog): string => {
  const topics = log.topics.map((topic) => bytesToHex(topic)) as [
    `0x${string}`,
    ...`0x${string}`[],
  ];
  const data = bytesToHex(log.data);

  // Decode the event
  const decodedLog = decodeEventLog({
    abi: eventAbi,
    data,
    topics,
  });

  runtime.log(`Event name: ${decodedLog.eventName}`);
  let eventParams: AuctionEventParams;

  const httpClient = new cre.capabilities.HTTPClient();

  // Extract info from event and prepare the parameters
  switch (decodedLog.eventName) {
    case "AuctionCreated": {
      const {
        auctionId,
        tokenId,
        seller,
        tokenAmount,
        reservePrice,
        depositRequired,
        startTime,
        endTime,
      } = decodedLog.args;
      eventParams = {
        action: "AuctionCreated",
        auctionId: auctionId.toString(),
        tokenId: tokenId.toString(),
        seller,
        tokenAmount: tokenAmount.toString(),
        reservePrice: reservePrice.toString(),
        depositRequired: depositRequired.toString(),
        startTime: startTime.toString(),
        endTime: endTime.toString(),
      };
      runtime.log(
        `Event AuctionCreated detected: auctionId ${auctionId} | seller ${seller} | tokenId ${tokenId}`,
      );
      break;
    }
    case "BidPlaced": {
      const { auctionId, bidder, bidHash, escrowAmount } = decodedLog.args;
      eventParams = {
        action: "BidPlaced",
        auctionId: auctionId.toString(),
        bidder,
        bidHash,
        escrowAmount: escrowAmount.toString(),
      };
      runtime.log(
        `Event BidPlaced detected: auctionId ${auctionId} | bidder ${bidder} | escrow ${escrowAmount}`,
      );
      break;
    }
    case "AuctionEnded": {
      const { auctionId, endTime } = decodedLog.args;
      eventParams = {
        action: "AuctionEnded",
        auctionId: auctionId.toString(),
        endTime: endTime.toString(),
      };
      runtime.log(`Event AuctionEnded detected: auctionId ${auctionId}`);
      break;
    }
    case "AuctionFinalized": {
      const { auctionId, winner, winningBid } = decodedLog.args;
      eventParams = {
        action: "AuctionFinalized",
        auctionId: auctionId.toString(),
        winner,
        winningBid: winningBid.toString(),
      };
      runtime.log(
        `Event AuctionFinalized detected: auctionId ${auctionId} | winner ${winner} | bid ${winningBid}`,
      );
      break;
    }
    case "BidRefunded": {
      const { auctionId, bidder, amount } = decodedLog.args;
      eventParams = {
        action: "BidRefunded",
        auctionId: auctionId.toString(),
        bidder,
        amount: amount.toString(),
      };
      runtime.log(
        `Event BidRefunded detected: auctionId ${auctionId} | bidder ${bidder} | amount ${amount}`,
      );
      break;
    }
    default:
      return "No key event detected";
  }

  const result = httpClient
    .sendRequest(
      runtime,
      postEventData,
      consensusIdenticalAggregation<PostResponse>(),
    )(runtime.config, eventParams)
    .result();

  runtime.log(`Successfully sent event data to url. Status ${result.statusCode}`);
  return "Success";
};

// =============================================================================
// HTTP TRIGGER HANDLER - Manual trigger for testing
// =============================================================================
const onHTTPTrigger = (runtime: Runtime<Config>, payload: HTTPPayload): string => {
  runtime.log("Raw HTTP trigger received");

  // Expect a HTTP request with metadata info
  if (!payload.input || payload.input.length === 0) {
    runtime.log("HTTP trigger payload is empty");
    throw new Error("JSON payload is empty");
  }

  try {
    const responseText = Buffer.from(payload.input).toString("utf-8");
    const { action, auctionId } = JSON.parse(responseText);

    runtime.log(`Parsed HTTP trigger: action=${action}, auctionId=${auctionId}`);

    return `Received manual trigger for auction ${auctionId}`;
  } catch (error) {
    runtime.log("Failed to parse HTTP trigger payload");
    throw new Error("Failed to parse HTTP trigger payload");
  }
};

// =============================================================================
// WORKFLOW INITIALIZATION
// =============================================================================
const initWorkflow = (config: Config) => {
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: config.evms[0].chainSelectorName,
    isTestnet: true,
  });

  if (!network) {
    throw new Error(
      `Network not found for chain selector name: ${config.evms[0].chainSelectorName}`,
    );
  }

  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);
  const httpTrigger = new cre.capabilities.HTTPCapability();

  return [
    // Log trigger: listens to contract events
    cre.handler(
      evmClient.logTrigger({
        addresses: [hexToBase64(config.evms[0].auctionAddress)],
      }),
      onLogTrigger,
    ),
    // HTTP trigger: manual testing
    cre.handler(httpTrigger.trigger({}), onHTTPTrigger),
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
