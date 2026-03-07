#!/usr/bin/env bash
# prepare-solver.sh
#
# Prepares the auction-workflow solver run by:
#   1. Finding the latest ended auction in Supabase
#   2. Writing its UUID into auction-workflow/config.json
#
# The auction status should already be "ended" via the CRE AuctionEnded event sync.
# This script just sets the correct auctionId in config.json so the solver knows
# which auction to resolve.
#
# Usage:
#   cd apps/cre-workflow
#   ./prepare-solver.sh
#   cre workflow simulate auction-workflow --target local-simulation

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG="$SCRIPT_DIR/auction-workflow/config.json"

# Read Supabase credentials from config.json
SUPABASE_URL=$(python3 -c "import json; print(json.load(open('$CONFIG'))['supabaseUrl'])")
SUPABASE_KEY=$(python3 -c "import json; print(json.load(open('$CONFIG'))['supabaseKey'])")

echo "Looking for the latest ended auction..."

AUCTION=$(curl -s "${SUPABASE_URL}/rest/v1/auctions?status=eq.ended&order=created_at.desc&limit=1" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

AUCTION_ID=$(echo "$AUCTION" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')")

if [ -z "$AUCTION_ID" ]; then
  echo "No ended auction found. Nothing to resolve."
  exit 1
fi

echo "Found ended auction: $AUCTION_ID"

# Update config.json with the auction UUID
python3 -c "
import json
with open('$CONFIG', 'r') as f:
    config = json.load(f)
config['auctionId'] = '$AUCTION_ID'
with open('$CONFIG', 'w') as f:
    json.dump(config, f, indent=2)
    f.write('\n')
"

echo "Updated auction-workflow/config.json with auctionId: $AUCTION_ID"
echo ""
echo "Ready! Now run:"
echo "  cre workflow simulate auction-workflow --target local-simulation"
