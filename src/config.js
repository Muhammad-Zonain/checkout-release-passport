import { readFile } from "node:fs/promises";
import path from "node:path";

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
  assert(typeof config.name === "string" && config.name.trim(), "name is required");

  let targetUrl;
  try {
    targetUrl = new URL(config.url);
  } catch {
    throw new Error("Invalid configuration: url must be a valid absolute URL");
  }
  assert(["http:", "https:"].includes(targetUrl.protocol), "url must use http or https");

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

  const scan = config.scan ?? {};
  const mode = scan.mode ?? "static";
  const timeoutMs = scan.timeout_ms ?? 30_000;
  const postLoadWaitMs = scan.post_load_wait_ms ?? 1_000;
  assert(["static", "browser"].includes(mode), "scan.mode must be static or browser");
  assert(Number.isInteger(timeoutMs) && timeoutMs >= 1_000 && timeoutMs <= 120_000, "scan.timeout_ms must be 1000-120000");
  assert(
    Number.isInteger(postLoadWaitMs) && postLoadWaitMs >= 0 && postLoadWaitMs <= 30_000,
    "scan.post_load_wait_ms must be 0-30000",
  );

  return {
    ...config,
    scan: {
      mode,
      wait_until: scan.wait_until ?? "networkidle",
      timeout_ms: timeoutMs,
      post_load_wait_ms: postLoadWaitMs,
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
