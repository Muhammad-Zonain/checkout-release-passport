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

GITHUB_OUTPUT="$temp_dir/baseline-output.txt" \
GITHUB_STEP_SUMMARY="$temp_dir/baseline-summary.md" \
node src/cli.js baseline --config examples/demo-target.json --ack-authorized --force-baseline >/dev/null

grep --quiet '^status=BASELINE_CREATED$' "$temp_dir/baseline-output.txt"
grep --quiet '^target_id=local-demo-checkout$' "$temp_dir/baseline-output.txt"
baseline_path="$(sed -n 's/^baseline_path=//p' "$temp_dir/baseline-output.txt")"
approval_template_path="$(sed -n 's/^approval_template_path=//p' "$temp_dir/baseline-output.txt")"
test -f "$baseline_path"
test -f "$approval_template_path"

if node src/cli.js baseline --config examples/demo-target.json --ack-authorized >/dev/null 2>&1; then
  echo "Baseline overwrite guard failed"
  exit 1
fi

GITHUB_ACTIONS=true \
GITHUB_REPOSITORY=Muhammad-Zonain/checkout-release-passport \
GITHUB_SHA=1111111111111111111111111111111111111111 \
GITHUB_REF=refs/heads/main \
GITHUB_ACTOR=Muhammad-Zonain \
GITHUB_RUN_ID=1001 \
CHECKOUT_PASSPORT_ACTION_REPOSITORY=Muhammad-Zonain/checkout-release-passport \
CHECKOUT_PASSPORT_ACTION_REF=v0.3.0 \
GITHUB_OUTPUT="$temp_dir/github-output.txt" \
GITHUB_STEP_SUMMARY="$temp_dir/github-summary.md" \
node src/cli.js check --config examples/demo-target.json --ack-authorized --no-fail

grep --quiet '^status=PASS$' "$temp_dir/github-output.txt"
passport_path="$(sed -n 's/^passport_path=//p' "$temp_dir/github-output.txt")"
snapshot_path="$(sed -n 's/^snapshot_path=//p' "$temp_dir/github-output.txt")"
test -f "$passport_path"
test -f "$snapshot_path"

node -e '
  const fs = require("node:fs");
  const passport = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (passport.kind !== "checkout-release-passport") throw new Error("wrong passport kind");
  if (passport.decision.status !== "PASS") throw new Error("demo did not pass");
  if (passport.release.repository !== "Muhammad-Zonain/checkout-release-passport") throw new Error("missing CI provenance");
  if (passport.release.action_repository !== "Muhammad-Zonain/checkout-release-passport") throw new Error("missing action repository");
  if (passport.release.action_ref !== "v0.3.0") throw new Error("missing action ref");
' "$passport_path"

echo "Passport demo verification: PASS"
