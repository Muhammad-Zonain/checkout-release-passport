import { readFile } from "node:fs/promises";
import path from "node:path";
import { pageIdentity } from "./readiness.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Invalid configuration: ${message}`);
  }
}

function resolveFromConfig(configPath, candidate, fallback) {
  const value = candidate ?? fallback;
  return path.resolve(path.dirname(configPath), value);
}

export function validateConfig(config) {
  assert(config && typeof config === "object", "root value must be an object");
  assert(
    typeof config.target_id === "string" && /^[a-z0-9][a-z0-9_-]{1,63}$/.test(config.target_id),
    "target_id must contain 2-64 lowercase letters, numbers, hyphens, or underscores",
  );
  assert(
    typeof config.name === "string" && config.name.trim() && config.name.trim().length <= 120,
    "name is required and must be at most 120 characters",
  );

  let targetUrl;
  try {
    targetUrl = new URL(config.url);
  } catch {
    throw new Error("Invalid configuration: url must be a valid absolute URL");
  }
  assert(["http:", "https:"].includes(targetUrl.protocol), "url must use http or https");
  assert(!targetUrl.username && !targetUrl.password, "url must not contain embedded credentials");

  const authorization = config.authorization;
  assert(authorization?.confirmed === true, "authorization.confirmed must be true");
  assert(
    typeof authorization.confirmed_by === "string" && authorization.confirmed_by.trim(),
    "authorization.confirmed_by is required",
  );
  assert(
    typeof authorization.confirmed_at === "string" && /^\d{4}-\d{2}-\d{2}$/.test(authorization.confirmed_at),
    "authorization.confirmed_at must use YYYY-MM-DD",
  );
  assert(
    typeof authorization.scope_note === "string" && authorization.scope_note.trim().length >= 10,
    "authorization.scope_note must explain the authorized scope",
  );
  const allowedNavigationOrigins = authorization.allowed_navigation_origins ?? [targetUrl.origin];
  assert(
    Array.isArray(allowedNavigationOrigins) && allowedNavigationOrigins.length >= 1 && allowedNavigationOrigins.length <= 20,
    "authorization.allowed_navigation_origins must contain 1-20 origins",
  );
  const normalizedNavigationOrigins = allowedNavigationOrigins.map((candidate) => {
    let parsed;
    try {
      parsed = new URL(candidate);
    } catch {
      throw new Error("Invalid configuration: every allowed navigation origin must be an absolute HTTP(S) origin");
    }
    assert(["http:", "https:"].includes(parsed.protocol), "allowed navigation origins must use http or https");
    assert(!parsed.username && !parsed.password, "allowed navigation origins must not contain credentials");
    assert(
      parsed.origin === candidate && parsed.pathname === "/" && !parsed.search && !parsed.hash,
      "allowed navigation origins must contain only scheme, host, and optional port without a trailing slash",
    );
    return parsed.origin;
  });
  assert(
    normalizedNavigationOrigins.includes(targetUrl.origin),
    "authorization.allowed_navigation_origins must include the configured URL origin",
  );

  const expectations = config.capture_expectations ?? {};
  assert(expectations && typeof expectations === "object" && !Array.isArray(expectations), "capture_expectations must be an object");
  const expectedFinalUrl = expectations.expected_final_url ?? pageIdentity(config.url);
  let expectedUrl;
  try { expectedUrl = new URL(expectedFinalUrl); } catch {
    throw new Error("Invalid configuration: capture_expectations.expected_final_url must be an absolute HTTP(S) URL");
  }
  assert(["http:", "https:"].includes(expectedUrl.protocol), "expected_final_url must use http or https");
  assert(!expectedUrl.username && !expectedUrl.password && !expectedUrl.search && !expectedUrl.hash, "expected_final_url must not contain credentials, query parameters, or a fragment");
  assert(normalizedNavigationOrigins.includes(expectedUrl.origin), "expected_final_url must use an authorized navigation origin");
  const readyElementId = expectations.ready_element_id ?? null;
  assert(readyElementId === null || (typeof readyElementId === "string" && /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(readyElementId)), "ready_element_id must be a simple HTML id (1-80 letters, numbers, underscores or hyphens, starting with a letter)");

  const scan = config.scan ?? {};
  const mode = scan.mode ?? "static";
  const timeoutMs = scan.timeout_ms ?? 30_000;
  const postLoadWaitMs = scan.post_load_wait_ms ?? 1_000;
  const waitUntil = scan.wait_until ?? "networkidle";
  assert(["static", "browser"].includes(mode), "scan.mode must be static or browser");
  assert(
    ["load", "domcontentloaded", "networkidle", "commit"].includes(waitUntil),
    "scan.wait_until must be load, domcontentloaded, networkidle, or commit",
  );
  assert(Number.isInteger(timeoutMs) && timeoutMs >= 1_000 && timeoutMs <= 120_000, "scan.timeout_ms must be 1000-120000");
  assert(
    Number.isInteger(postLoadWaitMs) && postLoadWaitMs >= 0 && postLoadWaitMs <= 30_000,
    "scan.post_load_wait_ms must be 0-30000",
  );

  const monitoring = config.monitoring ?? {};
  const expectedIntervalHours = monitoring.expected_interval_hours ?? 168;
  const responseTargetHours = monitoring.response_target_hours ?? 24;
  const reviewOwner = monitoring.review_owner ?? authorization.confirmed_by;
  assert(
    Number.isInteger(expectedIntervalHours) && expectedIntervalHours >= 1 && expectedIntervalHours <= 168,
    "monitoring.expected_interval_hours must be 1-168",
  );
  assert(
    Number.isInteger(responseTargetHours) && responseTargetHours >= 1 && responseTargetHours <= 168,
    "monitoring.response_target_hours must be 1-168",
  );
  assert(
    typeof reviewOwner === "string" && reviewOwner.trim() && reviewOwner.trim().length <= 120,
    "monitoring.review_owner must be 1-120 characters",
  );

  return {
    ...config,
    capture_expectations: {
      expected_final_url: pageIdentity(expectedFinalUrl),
      ready_element_id: readyElementId,
    },
    authorization: {
      ...authorization,
      allowed_navigation_origins: [...new Set(normalizedNavigationOrigins)],
    },
    scan: {
      mode,
      wait_until: waitUntil,
      timeout_ms: timeoutMs,
      post_load_wait_ms: postLoadWaitMs,
    },
    monitoring: {
      expected_interval_hours: expectedIntervalHours,
      response_target_hours: responseTargetHours,
      review_owner: reviewOwner.trim(),
    },
  };
}

export async function loadConfig(configArgument) {
  if (!configArgument) {
    throw new Error("Missing --config <path>");
  }

  const configPath = path.resolve(process.cwd(), configArgument);
  const raw = await readFile(configPath, "utf8");
  const config = validateConfig(JSON.parse(raw));

  return {
    config: {
      ...config,
      output_dir: resolveFromConfig(configPath, config.output_dir, "../evidence"),
      approvals_file: resolveFromConfig(configPath, config.approvals_file, "approvals.json"),
    },
    configPath,
  };
}
