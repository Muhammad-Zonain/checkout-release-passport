import test from "node:test";
import assert from "node:assert/strict";
import { digestObject } from "../src/hash.js";
import { verifyArtifactDigest } from "../src/verification.js";

function artifact(kind, idField, digestField, prefix) {
  const core = { schema_version: "1.0", kind, created_at: "2026-08-11T12:00:00.000Z", decision: "PASS" };
  const digest = digestObject(core);
  return {
    ...core,
    [idField]: `${prefix}${digest.slice(0, 20)}`,
    [digestField]: digest,
  };
}

test("monitoring-event and alert digests can be independently verified", () => {
  const event = artifact("checkout-monitoring-event", "event_id", "event_sha256", "cme_");
  const alert = artifact("checkout-review-alert", "alert_id", "alert_sha256", "cra_");
  assert.equal(verifyArtifactDigest(event, "event").artifact_id, event.event_id);
  assert.equal(verifyArtifactDigest(alert, "alert").artifact_id, alert.alert_id);
});

test("artifact verification detects post-generation changes", () => {
  const alert = artifact("checkout-review-alert", "alert_id", "alert_sha256", "cra_");
  alert.decision = "REVIEW_REQUIRED";
  assert.throws(() => verifyArtifactDigest(alert, "alert"), /digest verification failed/);
});
