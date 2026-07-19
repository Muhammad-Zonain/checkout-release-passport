import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeUrl, selectSecurityHeaders } from "../src/privacy.js";

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
