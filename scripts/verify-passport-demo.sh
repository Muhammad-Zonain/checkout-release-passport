#!/usr/bin/env bash
set -euo pipefail

work_dir="$(cd "$(dirname "$0")/.." && pwd)"
temp_dir="$(mktemp -d)"
server_pid=""

cleanup() {
  if [[ -n "$server_pid" ]]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT

cd "$work_dir"
node scripts/demo-server.js --version 1 >"$temp_dir/server.log" 2>&1 &
server_pid=$!

for _ in {1..30}; do
  if curl --fail --silent http://127.0.0.1:4173/checkout.html >/dev/null; then
    break
  fi
  sleep 0.1
done

curl --fail --silent http://127.0.0.1:4173/checkout.html >/dev/null

node src/cli.js baseline --config examples/demo-target.json --ack-authorized >/dev/null

GITHUB_ACTIONS=true \
GITHUB_REPOSITORY=Muhammad02-dev/checkout-release-passport \
GITHUB_SHA=1111111111111111111111111111111111111111 \
GITHUB_REF=refs/heads/main \
GITHUB_ACTOR=Muhammad02-dev \
GITHUB_RUN_ID=1001 \
GITHUB_OUTPUT="$temp_dir/github-output.txt" \
GITHUB_STEP_SUMMARY="$temp_dir/github-summary.md" \
node src/cli.js check --config examples/demo-target.json --ack-authorized --no-fail

grep --quiet '^status=PASS$' "$temp_dir/github-output.txt"
passport_path="$(sed -n 's/^passport_path=//p' "$temp_dir/github-output.txt")"
test -f "$passport_path"

node -e '
  const fs = require("node:fs");
  const passport = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (passport.kind !== "checkout-release-passport") throw new Error("wrong passport kind");
  if (passport.decision.status !== "PASS") throw new Error("demo did not pass");
  if (passport.release.repository !== "Muhammad02-dev/checkout-release-passport") throw new Error("missing CI provenance");
' "$passport_path"

echo "Passport demo verification: PASS"
