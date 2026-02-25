import fs from "fs";
import path from "path";

interface BroadcastTransaction {
  contractName?: string;
  contractAddress?: string;
}

interface BroadcastFile {
  transactions?: BroadcastTransaction[];
}

function findLatestBroadcastFile(): string {
  const scriptsRoot = __dirname;
  const contractRoot = path.resolve(scriptsRoot, "..");
  const broadcastRoot = path.join(contractRoot, "broadcast", "Deploy.s.sol");

  if (!fs.existsSync(broadcastRoot)) {
    throw new Error(`broadcast directory not found at ${broadcastRoot}`);
  }

  const chainDirs = fs
    .readdirSync(broadcastRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => /^\d+$/.test(name))
    .sort((a, b) => Number(b) - Number(a));

  for (const dir of chainDirs) {
    const candidate = path.join(broadcastRoot, dir, "run-latest.json");
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error("run-latest.json not found in any chain directory under broadcast/Deploy.s.sol");
}

function readBroadcast(): { assetAddress: string; auctionAddress: string } {
  const filePath = findLatestBroadcastFile();
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as BroadcastFile;

  if (!Array.isArray(parsed.transactions)) {
    throw new Error("broadcast file missing transactions array");
  }

  let assetAddress: string | undefined;
  let auctionAddress: string | undefined;

  for (const tx of parsed.transactions) {
    if (!tx.contractName || !tx.contractAddress) continue;
    if (tx.contractName === "MaskBidAsset") {
      assetAddress = tx.contractAddress;
    }
    if (tx.contractName === "MaskBidAuction") {
      auctionAddress = tx.contractAddress;
    }
  }

  if (!assetAddress || !auctionAddress) {
    throw new Error(
      `Could not find MaskBidAsset or MaskBidAuction in broadcast transactions (asset=${assetAddress}, auction=${auctionAddress})`,
    );
  }

  return { assetAddress, auctionAddress };
}

function updateEnvFile(filePath: string, updates: Record<string, string>) {
  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split("\n");

  const keys = Object.keys(updates);
  const present = new Set<string>();

  const updatedLines = lines.map((line) => {
    for (const key of keys) {
      if (line.startsWith(`${key}=`)) {
        present.add(key);
        return `${key}=${updates[key]}`;
      }
    }
    return line;
  });

  for (const key of keys) {
    if (!present.has(key)) {
      updatedLines.push(`${key}=${updates[key]}`);
    }
  }

  fs.writeFileSync(filePath, updatedLines.join("\n"), "utf8");
  console.log(`  ✅ ${path.relative(process.cwd(), filePath)}`);
}

function updateJsonConfig(filePath: string, updater: (obj: Record<string, unknown>) => void) {
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  skipped (not found): ${path.relative(process.cwd(), filePath)}`);
    return;
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const obj = JSON.parse(raw) as Record<string, unknown>;
  updater(obj);
  fs.writeFileSync(filePath, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
  console.log(`  ✅ ${path.relative(process.cwd(), filePath)}`);
}

function main() {
  const { assetAddress, auctionAddress } = readBroadcast();
  console.log(`\n🔍 Addresses from broadcast:`);
  console.log(`   MaskBidAsset:   ${assetAddress}`);
  console.log(`   MaskBidAuction: ${auctionAddress}`);

  const scriptsRoot = __dirname;
  const contractRoot = path.resolve(scriptsRoot, "..");
  const repoRoot = path.resolve(contractRoot, "..", "..");
  const creRoot = path.join(repoRoot, "apps/cre-workflow");

  // ── Contract envs ──────────────────────────────────────────────────────────
  console.log("\n📄 Contract envs:");
  updateEnvFile(path.join(contractRoot, ".env"), {
    ASSET_CONTRACT_ADDRESS: assetAddress,
    AUCTION_CONTRACT_ADDRESS: auctionAddress,
  });
  updateEnvFile(path.join(contractRoot, ".env.example"), {
    ASSET_CONTRACT_ADDRESS: assetAddress,
    AUCTION_CONTRACT_ADDRESS: auctionAddress,
  });

  // ── Web envs ───────────────────────────────────────────────────────────────
  console.log("\n🌐 Web envs:");
  updateEnvFile(path.join(repoRoot, "apps/web/.env"), {
    NEXT_PUBLIC_ASSET_CONTRACT_ADDRESS: assetAddress,
    NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS: auctionAddress,
    ASSET_CONTRACT_ADDRESS: assetAddress,
  });
  updateEnvFile(path.join(repoRoot, "apps/web/.env.example"), {
    NEXT_PUBLIC_ASSET_CONTRACT_ADDRESS: assetAddress,
    NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS: auctionAddress,
    ASSET_CONTRACT_ADDRESS: assetAddress,
  });

  // ── asset-log-trigger-workflow ─────────────────────────────────────────────
  console.log("\n⚙️  asset-log-trigger-workflow:");
  const assetEvm = (obj: Record<string, unknown>) => {
    const evms = obj.evms as Record<string, unknown>[] | undefined;
    if (Array.isArray(evms) && evms.length > 0) {
      evms[0].assetAddress = assetAddress;
    }
  };
  updateJsonConfig(path.join(creRoot, "asset-log-trigger-workflow/config.json"), assetEvm);
  updateJsonConfig(path.join(creRoot, "asset-log-trigger-workflow/config.json.example"), assetEvm);

  // ── auction-log-trigger-workflow ───────────────────────────────────────────
  console.log("\n⚙️  auction-log-trigger-workflow:");
  const auctionLogEvm = (obj: Record<string, unknown>) => {
    const evms = obj.evms as Record<string, unknown>[] | undefined;
    if (Array.isArray(evms) && evms.length > 0) {
      evms[0].auctionAddress = auctionAddress;
    }
  };
  updateJsonConfig(path.join(creRoot, "auction-log-trigger-workflow/config.json"), auctionLogEvm);
  updateJsonConfig(path.join(creRoot, "auction-log-trigger-workflow/config.json.example"), auctionLogEvm);

  // ── auction-workflow (ZK solver) ───────────────────────────────────────────
  console.log("\n⚙️  auction-workflow:");
  const auctionSolver = (obj: Record<string, unknown>) => {
    obj.auctionContractAddress = auctionAddress;
  };
  updateJsonConfig(path.join(creRoot, "auction-workflow/config.json"), auctionSolver);
  updateJsonConfig(path.join(creRoot, "auction-workflow/config.json.example"), auctionSolver);

  console.log("\n✨ All files updated.\n");
}

main();
