import test from "node:test";
import assert from "node:assert/strict";
import { digestObject } from "../src/hash.js";

test("passport digest changes when evidence content changes", () => {
  const core = {
    schema_version: "1.0",
    kind: "checkout-release-passport",
    decision: { status: "PASS" },
    evidence: { current_snapshot_sha256: "a".repeat(64) },
  };
  const before = digestObject(core);
  const after = digestObject({
    ...core,
    decision: { status: "REVIEW_REQUIRED" },
  });
  assert.notEqual(before, after);
});
