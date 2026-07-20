import test from "node:test";
import assert from "node:assert/strict";
import { buildReleasePassport } from "../src/passport.js";

test("release passport binds decision, evidence digests, authorization, and CI provenance", () => {
  const passport = buildReleasePassport({
    config: { target_id: "demo-checkout", name: "Demo Checkout", authorization: { reference: "TICKET-42" } },
    baseline: { snapshot_sha256: "a".repeat(64) },
    current: {
      snapshot_sha256: "b".repeat(64),
      engine: { name: "checkout-evidence-engine", version: "0.3.0", capture_mode: "browser" },
      target: {
        requested_url: "https://staging.example.test/checkout",
        authorization: { confirmed: true, confirmed_by: "Owner", confirmed_at: "2026-07-19", scope_note: "Owned test checkout" },
      },
    },
    comparison: { status: "PASS", review_reasons: [], summary: { scripts_added: 0, scripts_modified: 0, security_headers_changed: 0 } },
    comparisonPath: "/tmp/check.comparison.json",
    reportPath: "/tmp/check.html",
    reportHtml: "<html>safe report</html>",
    env: {
      GITHUB_ACTIONS: "true",
      GITHUB_REPOSITORY: "agency/store",
      GITHUB_SHA: "c".repeat(40),
      CHECKOUT_PASSPORT_ACTION_REPOSITORY: "",
      CHECKOUT_PASSPORT_ACTION_REF: "",
      GITHUB_ACTION_REPOSITORY: "Muhammad-Zonain/checkout-release-passport",
      GITHUB_ACTION_REF: "v0.3.0",
    },
  });

  assert.equal(passport.kind, "checkout-release-passport");
  assert.match(passport.passport_id, /^crp_[a-f0-9]{20}$/);
  assert.match(passport.passport_sha256, /^[a-f0-9]{64}$/);
  assert.equal(passport.decision.status, "PASS");
  assert.equal(passport.authorization.reference, "TICKET-42");
  assert.equal(passport.release.repository, "agency/store");
  assert.equal(passport.release.action_repository, "Muhammad-Zonain/checkout-release-passport");
  assert.equal(passport.release.action_ref, "v0.3.0");
  assert.equal(passport.generator.version, "0.3.0");
  assert.equal(passport.data_boundaries.form_values_collected, false);
});
