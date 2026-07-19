import test from "node:test";
import assert from "node:assert/strict";
import { evaluateScriptApprovals } from "../src/approvals.js";

const script = {
  kind: "external",
  src: "https://cdn.example/sdk/v3.js",
  content_sha256: "abc",
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
  assert.equal(evaluated.approval.status, "unapproved");
});
