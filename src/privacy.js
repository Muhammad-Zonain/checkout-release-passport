const STORED_SECURITY_HEADERS = [
  "content-security-policy",
  "content-security-policy-report-only",
  "strict-transport-security",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "x-frame-options",
  "cross-origin-opener-policy",
  "cross-origin-embedder-policy",
  "cross-origin-resource-policy",
];

export function sanitizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.hash = "";

    const keys = [...new Set([...url.searchParams.keys()])].sort();
    url.search = "";
    for (const key of keys) {
      url.searchParams.append(key, "<redacted>");
    }

    return url.toString();
  } catch {
    return "<invalid-url>";
  }
}

export function getOrigin(rawUrl) {
  try {
    return new URL(rawUrl).origin;
  } catch {
    return "<invalid-origin>";
  }
}

export function selectSecurityHeaders(headers = {}) {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]),
  );

  return Object.fromEntries(
    STORED_SECURITY_HEADERS.map((name) => [name, normalized[name] ?? null]),
  );
}

export { STORED_SECURITY_HEADERS };
