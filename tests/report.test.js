import test from "node:test";
import assert from "node:assert/strict";
import { generateHtmlReport } from "../src/report.js";

test("report escapes target-controlled text", () => {
  const config = { name: "<script>alert('x')</script>" };
  const baseline = { snapshot_sha256: "a".repeat(64) };
  const current = {
    engine: {
      capture_mode: "static",
      behavior: "Authorized static test capture",
    },
    captured_at: "2026-07-18T00:00:00.000Z",
    snapshot_sha256: "b".repeat(64),
    target: {
      requested_url: "https://example.test/checkout",
      authorization: {
        confirmed_by: "Owner",
        confirmed_at: "2026-07-18",
        scope_note: "Authorized staging page",
      },
    },
  };
  const comparison = {
    status: "PASS",
    summary: { scripts_total: 0 },
    review_reasons: [],
    scripts: { added: [], removed: [], modified: [], current: [] },
    security_headers: { changed: [] },
    network_origins: { current: [] },
  };

  const html = generateHtmlReport(config, baseline, current, comparison);
  assert.equal(html.includes("<script>alert"), false);
  assert.equal(html.includes("&lt;script&gt;alert"), true);
});
