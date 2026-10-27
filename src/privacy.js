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
    url.username = "";
    url.password = "";
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

function sanitizeHeaderUrl(rawUrl) {
  return sanitizeUrl(rawUrl).replaceAll("%3Credacted%3E", "<redacted>");
}

export function sanitizeSecurityHeaderValue(name, rawValue) {
  let value = String(rawValue ?? "");
  const normalizedName = String(name ?? "").toLowerCase();

  if (normalizedName === "content-security-policy" || normalizedName === "content-security-policy-report-only") {
    value = value.replace(/'nonce-[^']*'/gi, "'nonce-<redacted>'");
    value = value.replace(/https?:\/\/[^\s;,]+/gi, (candidate) => sanitizeHeaderUrl(candidate));
    value = value.replace(/([?&][A-Za-z0-9._~-]+)=([^&\s;,]*)/g, "$1=<redacted>");
  }

  return value;
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
    STORED_SECURITY_HEADERS.map((name) => [
      name,
      normalized[name] === undefined
        ? null
        : sanitizeSecurityHeaderValue(name, normalized[name]),
    ]),
  );
}

export { STORED_SECURITY_HEADERS };
