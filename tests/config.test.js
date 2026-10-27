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
  assert.equal(result.monitoring.expected_interval_hours, 168);
  assert.equal(result.monitoring.response_target_hours, 24);
  assert.equal(result.monitoring.review_owner, "Site owner");
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

test("configuration rejects a monitoring interval longer than seven days", () => {
  const config = validConfig();
  config.monitoring = { expected_interval_hours: 169 };
  assert.throws(() => validateConfig(config), /expected_interval_hours must be 1-168/);
});

test("configuration rejects embedded target credentials", () => {
  const config = validConfig();
  config.url = "https://user:password@example.test/checkout";
  assert.throws(() => validateConfig(config), /must not contain embedded credentials/);
});

test("configuration requires redirects to remain inside explicit authorized origins", () => {
  const config = validConfig();
  config.authorization.allowed_navigation_origins = ["https://other.example.test"];
  assert.throws(() => validateConfig(config), /must include the configured URL origin/);
});
