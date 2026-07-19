import test from "node:test";
import assert from "node:assert/strict";
import { validateConfig } from "../src/config.js";

function validConfig() {
  return {
    target_id: "demo-target",
    name: "Demo",
    url: "https://example.test/checkout",
    authorization: {
      confirmed: true,
      confirmed_by: "Site owner",
      confirmed_at: "2026-07-18",
      scope_note: "Written authorization for the staging checkout page",
    },
  };
}

test("valid configuration receives safe scan defaults", () => {
  const result = validateConfig(validConfig());
  assert.equal(result.scan.wait_until, "networkidle");
  assert.equal(result.scan.timeout_ms, 30000);
});

test("configuration rejects non-HTTP URLs", () => {
  const config = validConfig();
  config.url = "file:///tmp/checkout.html";
  assert.throws(() => validateConfig(config), /url must use http or https/);
});

test("configuration rejects missing authorization", () => {
  const config = validConfig();
  config.authorization.confirmed = false;
  assert.throws(() => validateConfig(config), /authorization\.confirmed must be true/);
});
