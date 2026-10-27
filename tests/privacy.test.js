import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeSecurityHeaderValue, sanitizeUrl, selectSecurityHeaders } from "../src/privacy.js";

test("URL query values are redacted while parameter names remain visible", () => {
  const result = sanitizeUrl("https://cdn.example/sdk.js?token=secret&version=42#fragment");
  assert.equal(
    result,
    "https://cdn.example/sdk.js?token=%3Credacted%3E&version=%3Credacted%3E",
  );
  assert.equal(result.includes("secret"), false);
  assert.equal(result.includes("42"), false);
});

test("only selected security headers are retained", () => {
  const result = selectSecurityHeaders({
    "Content-Security-Policy": "default-src 'self'",
    "Set-Cookie": "session=secret",
  });
  assert.equal(result["content-security-policy"], "default-src 'self'");
  assert.equal(Object.hasOwn(result, "set-cookie"), false);
});

test("CSP nonces and report URL query values are redacted", () => {
  const result = sanitizeSecurityHeaderValue(
    "Content-Security-Policy",
    "script-src 'self' 'nonce-one-time-value'; report-uri /csp?token=secret&tenant=private",
  );
  assert.equal(result.includes("one-time-value"), false);
  assert.equal(result.includes("secret"), false);
  assert.equal(result.includes("private"), false);
  assert.equal(
    result,
    "script-src 'self' 'nonce-<redacted>'; report-uri /csp?token=<redacted>&tenant=<redacted>",
  );
});

test("URL credentials are removed from stored evidence", () => {
  const result = sanitizeUrl("https://user:password@example.test/checkout?token=secret");
  assert.equal(result.includes("user"), false);
  assert.equal(result.includes("password"), false);
  assert.equal(result, "https://example.test/checkout?token=%3Credacted%3E");
});
