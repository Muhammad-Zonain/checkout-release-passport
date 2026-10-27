import test from "node:test";
import assert from "node:assert/strict";
import { evaluateScriptApprovals, validateApprovalDocument } from "../src/approvals.js";

const script = {
  kind: "external",
  src: "https://cdn.example/sdk/v3.js",
  content_sha256: "a".repeat(64),
};

function approval(overrides = {}) {
  return {
    approval_id: "sdk",
    kind: "external",
    match_type: "prefix",
    match: "https://cdn.example/sdk/",
    owner: "Payments",
    purpose: "Payment UI",
    approved_by: "Owner",
    approved_at: "2026-07-01",
    expires_at: null,
    ...overrides,
  };
}

test("prefix approval matches an external script", () => {
  const [evaluated] = evaluateScriptApprovals(
    [script],
    { approvals: [approval()] },
    new Date("2026-07-18T00:00:00Z"),
  );
  assert.equal(evaluated.approval.status, "approved");
  assert.equal(evaluated.approval.approval_id, "sdk");
});

test("expired approval does not approve a script", () => {
  const [evaluated] = evaluateScriptApprovals(
    [script],
    { approvals: [approval({ expires_at: "2026-07-01" })] },
    new Date("2026-07-18T00:00:00Z"),
  );
  assert.equal(evaluated.approval.status, "expired");
  assert.equal(evaluated.approval.approval_id, "sdk");
});

test("declared SRI is retained as integrity evidence when a body fingerprint is unavailable", () => {
  const [evaluated] = evaluateScriptApprovals(
    [{ ...script, content_sha256: null, integrity: "sha384-example" }],
    { approvals: [approval()] },
  );
  assert.equal(evaluated.integrity_evidence.status, "declared");
  assert.equal(evaluated.integrity_evidence.sri_declared, true);
});

test("approval document validation rejects onboarding placeholders", () => {
  assert.throws(
    () => validateApprovalDocument(
      { schema_version: "1.1", target_id: "demo", approvals: [approval({ owner: "REVIEW_REQUIRED" })] },
      "demo",
    ),
    /owner must be completed/,
  );
});

test("approval document validation rejects duplicate approval identifiers", () => {
  assert.throws(
    () => validateApprovalDocument(
      { schema_version: "1.1", target_id: "demo", approvals: [approval(), approval()] },
      "demo",
    ),
    /duplicate approval_id/,
  );
});

test("a future-dated approval is visible but not treated as active", () => {
  const [evaluated] = evaluateScriptApprovals(
    [script],
    { approvals: [approval({ approved_at: "2026-08-20" })] },
    new Date("2026-08-11T12:00:00.000Z"),
  );
  assert.equal(evaluated.approval.status, "pending");
});

test("approval document rejects an expiry before the approval date", () => {
  assert.throws(
    () => validateApprovalDocument(
      { target_id: "demo", schema_version: "1.1", approvals: [approval({ expires_at: "2026-06-30" })] },
      "demo",
    ),
    /expires_at cannot be before approved_at/,
  );
});
