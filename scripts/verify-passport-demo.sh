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

start_server() {
  local version="$1"
  node scripts/demo-server.js --version "$version" >"$temp_dir/server-v${version}.log" 2>&1 &
  server_pid=$!

  for _ in {1..30}; do
    if curl --fail --silent http://127.0.0.1:4173/checkout.html >/dev/null; then
      return
    fi
    sleep 0.1
  done
  curl --fail --silent http://127.0.0.1:4173/checkout.html >/dev/null
}

stop_server() {
  if [[ -n "$server_pid" ]]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
    server_pid=""
  fi
}

start_server 1

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
CHECKOUT_PASSPORT_ACTION_REF=v0.4.1 \
CHECKOUT_PASSPORT_ALERT_MODE=github-issue \
GITHUB_SERVER_URL=https://github.com \
GITHUB_OUTPUT="$temp_dir/pass-output.txt" \
GITHUB_STEP_SUMMARY="$temp_dir/pass-summary.md" \
node src/cli.js check --config examples/demo-target.json --ack-authorized --no-fail

grep --quiet '^status=PASS$' "$temp_dir/pass-output.txt"
grep --quiet '^review_priority=NONE$' "$temp_dir/pass-output.txt"
passport_path="$(sed -n 's/^passport_path=//p' "$temp_dir/pass-output.txt")"
snapshot_path="$(sed -n 's/^snapshot_path=//p' "$temp_dir/pass-output.txt")"
event_path="$(sed -n 's/^monitoring_event_path=//p' "$temp_dir/pass-output.txt")"
alert_path="$(sed -n 's/^alert_path=//p' "$temp_dir/pass-output.txt")"
test -f "$passport_path"
test -f "$snapshot_path"
test -f "$event_path"
test -f "$alert_path"

node -e '
  const fs = require("node:fs");
  const passport = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (passport.kind !== "checkout-release-passport") throw new Error("wrong passport kind");
  if (passport.decision.status !== "PASS") throw new Error("demo did not pass");
  if (passport.release.repository !== "Muhammad-Zonain/checkout-release-passport") throw new Error("missing CI provenance");
  if (passport.release.action_repository !== "Muhammad-Zonain/checkout-release-passport") throw new Error("missing action repository");
  if (passport.release.action_ref !== "v0.4.1") throw new Error("missing action ref");
  if (passport.generator.version !== "0.4.1") throw new Error("wrong generator version");
  if (passport.decision.review_priority !== "NONE") throw new Error("unexpected review priority");
' "$passport_path"

node -e '
  const fs = require("node:fs");
  const event = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const alert = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  if (event.kind !== "checkout-monitoring-event") throw new Error("wrong event kind");
  if (event.decision.status !== "PASS") throw new Error("PASS event missing");
  if (alert.action !== "resolve_if_open") throw new Error("PASS alert should resolve an existing issue");
' "$event_path" "$alert_path"

stop_server
start_server 2

GITHUB_ACTIONS=true \
GITHUB_REPOSITORY=Muhammad-Zonain/checkout-release-passport \
GITHUB_SHA=2222222222222222222222222222222222222222 \
GITHUB_REF=refs/heads/main \
GITHUB_ACTOR=Muhammad-Zonain \
GITHUB_RUN_ID=1002 \
CHECKOUT_PASSPORT_ACTION_REPOSITORY=Muhammad-Zonain/checkout-release-passport \
CHECKOUT_PASSPORT_ACTION_REF=v0.4.1 \
CHECKOUT_PASSPORT_ALERT_MODE=github-issue \
GITHUB_SERVER_URL=https://github.com \
GITHUB_OUTPUT="$temp_dir/review-output.txt" \
GITHUB_STEP_SUMMARY="$temp_dir/review-summary.md" \
node src/cli.js check --config examples/demo-target.json --ack-authorized --no-fail

grep --quiet '^status=REVIEW_REQUIRED$' "$temp_dir/review-output.txt"
grep --quiet '^review_priority=P1$' "$temp_dir/review-output.txt"
review_event_path="$(sed -n 's/^monitoring_event_path=//p' "$temp_dir/review-output.txt")"
review_alert_path="$(sed -n 's/^alert_path=//p' "$temp_dir/review-output.txt")"
node -e '
  const fs = require("node:fs");
  const event = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const alert = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  if (event.decision.status !== "REVIEW_REQUIRED") throw new Error("review event missing");
  if (event.decision.review_priority !== "P1") throw new Error("P1 priority missing");
  if (!event.decision.findings.some((item) => item.type === "script_added")) throw new Error("added-script finding missing");
  if (alert.action !== "open_or_update") throw new Error("review alert should open or update an issue");
' "$review_event_path" "$review_alert_path"

stop_server
start_server 1

GITHUB_ACTIONS=true \
GITHUB_REPOSITORY=Muhammad-Zonain/checkout-release-passport \
GITHUB_SHA=3333333333333333333333333333333333333333 \
GITHUB_REF=refs/heads/main \
GITHUB_ACTOR=Muhammad-Zonain \
GITHUB_RUN_ID=1003 \
CHECKOUT_PASSPORT_ACTION_REPOSITORY=Muhammad-Zonain/checkout-release-passport \
CHECKOUT_PASSPORT_ACTION_REF=v0.4.1 \
CHECKOUT_PASSPORT_ALERT_MODE=github-issue \
GITHUB_SERVER_URL=https://github.com \
GITHUB_OUTPUT="$temp_dir/recovery-output.txt" \
GITHUB_STEP_SUMMARY="$temp_dir/recovery-summary.md" \
node src/cli.js check --config examples/demo-target.json --ack-authorized --no-fail

grep --quiet '^status=PASS$' "$temp_dir/recovery-output.txt"
grep --quiet '^review_priority=NONE$' "$temp_dir/recovery-output.txt"
recovery_alert_path="$(sed -n 's/^alert_path=//p' "$temp_dir/recovery-output.txt")"
node -e '
  const fs = require("node:fs");
  const alert = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (alert.action !== "resolve_if_open") throw new Error("recovery alert should resolve an existing issue");
' "$recovery_alert_path"

echo "Checkout monitoring demo: PASS -> P1 REVIEW_REQUIRED -> PASS"
