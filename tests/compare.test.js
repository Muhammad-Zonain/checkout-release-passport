import test from "node:test";
import assert from "node:assert/strict";
import { compareSnapshots } from "../src/compare.js";

function externalScript(src, hash) {
  return {
    dom_index: 0,
    kind: "external",
    src,
    type: "text/javascript",
    async: false,
    defer: true,
    integrity: null,
    crossorigin: null,
    referrerpolicy: null,
    nonce_present: false,
    content_sha256: hash,
    response_status: 200,
  };
}

function snapshot({ scripts, csp = "default-src 'self'", origins = [] }) {
  return {
    snapshot_sha256: "a".repeat(64),
    engine: { name: "checkout-evidence-engine", version: "0.3.0", capture_mode: "static" },
    target: { target_id: "demo" },
    page: { security_headers: { "content-security-policy": csp } },
    scripts,
    network_origins: origins,
  };
}

const approvalDocument = {
  target_id: "demo",
  approvals: [
    {
      approval_id: "approved-a",
      kind: "external",
      match_type: "exact",
      match: "https://shop.example/a.js",
      owner: "Payments",
      purpose: "Checkout rendering",
      approved_by: "Owner",
      approved_at: "2026-07-18",
      expires_at: null,
    },
  ],
};

test("comparison detects modified and added scripts, headers, origins, and approval gaps", () => {
  const baseline = snapshot({
    scripts: [externalScript("https://shop.example/a.js", "old-hash")],
    origins: [{ origin: "https://shop.example", first_party: true, request_count: 1, resource_types: ["document"] }],
  });
  const current = snapshot({
    scripts: [
      externalScript("https://shop.example/a.js", "new-hash"),
      externalScript("https://cdn.example/b.js", "b-hash"),
    ],
    csp: "default-src 'self'; connect-src 'self'",
    origins: [
      { origin: "https://shop.example", first_party: true, request_count: 1, resource_types: ["document"] },
      { origin: "https://cdn.example", first_party: false, request_count: 1, resource_types: ["script"] },
    ],
  });
  current.snapshot_sha256 = "b".repeat(64);

  const result = compareSnapshots(baseline, current, approvalDocument, new Date("2026-07-18T00:00:00Z"));

  assert.equal(result.status, "REVIEW_REQUIRED");
  assert.equal(result.summary.scripts_added, 1);
  assert.equal(result.summary.scripts_modified, 1);
  assert.equal(result.summary.scripts_unapproved, 1);
  assert.equal(result.summary.security_headers_changed, 1);
  assert.equal(result.summary.network_origins_added, 1);
  assert.deepEqual(
    result.review_reasons,
    ["scripts_added", "scripts_modified", "security_headers_changed", "network_origins_added", "unapproved_scripts_present"],
  );
});

test("comparison passes when evidence is unchanged and every script is approved", () => {
  const unchanged = snapshot({
    scripts: [externalScript("https://shop.example/a.js", "same-hash")],
    origins: [{ origin: "https://shop.example", first_party: true, request_count: 2, resource_types: ["document", "script"] }],
  });
  const current = structuredClone(unchanged);
  current.snapshot_sha256 = "c".repeat(64);

  const result = compareSnapshots(unchanged, current, approvalDocument, new Date("2026-07-18T00:00:00Z"));
  assert.equal(result.status, "PASS");
  assert.equal(result.summary.scripts_approved, 1);
  assert.deepEqual(result.review_reasons, []);
});

test("comparison requires review when scanner version or capture mode changes", () => {
  const baseline = snapshot({
    scripts: [externalScript("https://shop.example/a.js", "same-hash")],
  });
  const current = structuredClone(baseline);
  current.snapshot_sha256 = "d".repeat(64);
  current.engine.version = "0.4.0";
  current.engine.capture_mode = "browser";

  const result = compareSnapshots(baseline, current, approvalDocument, new Date("2026-07-18T00:00:00Z"));

  assert.equal(result.status, "REVIEW_REQUIRED");
  assert.equal(result.summary.scanner_version_changed, true);
  assert.equal(result.summary.capture_mode_changed, true);
  assert.deepEqual(result.review_reasons, ["scanner_version_changed", "capture_mode_changed"]);
});
