import { digestObject } from "./hash.js";
import { evaluateScriptApprovals } from "./approvals.js";

function scriptKey(script) {
  return script.kind === "external" ? `external:${script.src}` : `inline:${script.dom_index}`;
}

function scriptFingerprint(script) {
  return digestObject({
    kind: script.kind,
    src: script.src ?? null,
    type: script.type,
    async: script.async,
    defer: script.defer,
    integrity: script.integrity,
    crossorigin: script.crossorigin,
    referrerpolicy: script.referrerpolicy,
    nonce_present: script.nonce_present,
    content_sha256: script.content_sha256,
    response_status: script.response_status,
  });
}

function compareScripts(baselineScripts, currentScripts) {
  const baselineMap = new Map(baselineScripts.map((script) => [scriptKey(script), script]));
  const currentMap = new Map(currentScripts.map((script) => [scriptKey(script), script]));
  const added = [];
  const removed = [];
  const modified = [];

  for (const [key, script] of currentMap) {
    const previous = baselineMap.get(key);
    if (!previous) {
      added.push(script);
    } else if (scriptFingerprint(previous) !== scriptFingerprint(script)) {
      modified.push({ key, before: previous, after: script });
    }
  }

  for (const [key, script] of baselineMap) {
    if (!currentMap.has(key)) {
      removed.push(script);
    }
  }

  return { added, removed, modified };
}

function compareHeaders(baselineHeaders, currentHeaders) {
  const names = new Set([...Object.keys(baselineHeaders), ...Object.keys(currentHeaders)]);
  return [...names]
    .sort()
    .filter((name) => baselineHeaders[name] !== currentHeaders[name])
    .map((name) => ({
      name,
      before: baselineHeaders[name] ?? null,
      after: currentHeaders[name] ?? null,
    }));
}

function compareOrigins(baselineOrigins, currentOrigins) {
  const baselineSet = new Set(baselineOrigins.map((entry) => entry.origin));
  const currentSet = new Set(currentOrigins.map((entry) => entry.origin));
  return {
    added: currentOrigins.filter((entry) => !baselineSet.has(entry.origin)),
    removed: baselineOrigins.filter((entry) => !currentSet.has(entry.origin)),
  };
}

export function compareSnapshots(baseline, current, approvalDocument, now = new Date()) {
  if (baseline.target.target_id !== current.target.target_id) {
    throw new Error("Cannot compare snapshots from different targets");
  }

  const currentScripts = evaluateScriptApprovals(current.scripts, approvalDocument, now);
  const scriptChanges = compareScripts(baseline.scripts, currentScripts);
  const headerChanges = compareHeaders(
    baseline.page.security_headers,
    current.page.security_headers,
  );
  const originChanges = compareOrigins(baseline.network_origins, current.network_origins);
  const unapprovedScripts = currentScripts.filter((script) => script.approval.status !== "approved");
  const baselineEngineVersion = baseline.engine?.version ?? null;
  const currentEngineVersion = current.engine?.version ?? null;
  const baselineCaptureMode = baseline.engine?.capture_mode ?? null;
  const currentCaptureMode = current.engine?.capture_mode ?? null;
  const scannerVersionChanged = baselineEngineVersion !== currentEngineVersion;
  const captureModeChanged = baselineCaptureMode !== currentCaptureMode;

  const reviewReasons = [];
  if (scannerVersionChanged) reviewReasons.push("scanner_version_changed");
  if (captureModeChanged) reviewReasons.push("capture_mode_changed");
  if (scriptChanges.added.length) reviewReasons.push("scripts_added");
  if (scriptChanges.removed.length) reviewReasons.push("scripts_removed");
  if (scriptChanges.modified.length) reviewReasons.push("scripts_modified");
  if (headerChanges.length) reviewReasons.push("security_headers_changed");
  if (originChanges.added.length) reviewReasons.push("network_origins_added");
  if (unapprovedScripts.length) reviewReasons.push("unapproved_scripts_present");

  return {
    schema_version: "1.0",
    target_id: current.target.target_id,
    compared_at: new Date().toISOString(),
    baseline_snapshot_sha256: baseline.snapshot_sha256,
    current_snapshot_sha256: current.snapshot_sha256,
    status: reviewReasons.length ? "REVIEW_REQUIRED" : "PASS",
    review_reasons: reviewReasons,
    summary: {
      scripts_total: currentScripts.length,
      scripts_approved: currentScripts.length - unapprovedScripts.length,
      scripts_unapproved: unapprovedScripts.length,
      scripts_added: scriptChanges.added.length,
      scripts_removed: scriptChanges.removed.length,
      scripts_modified: scriptChanges.modified.length,
      security_headers_changed: headerChanges.length,
      network_origins_added: originChanges.added.length,
      scanner_version_changed: scannerVersionChanged,
      capture_mode_changed: captureModeChanged,
    },
    scripts: {
      current: currentScripts,
      unapproved: unapprovedScripts,
      ...scriptChanges,
    },
    security_headers: {
      baseline: baseline.page.security_headers,
      current: current.page.security_headers,
      changed: headerChanges,
    },
    network_origins: {
      current: current.network_origins,
      ...originChanges,
    },
    engine: {
      baseline: {
        version: baselineEngineVersion,
        capture_mode: baselineCaptureMode,
      },
      current: {
        version: currentEngineVersion,
        capture_mode: currentCaptureMode,
      },
      scanner_version_changed: scannerVersionChanged,
      capture_mode_changed: captureModeChanged,
    },
  };
}
