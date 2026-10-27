import { digestObject } from "./hash.js";
import { evaluateScriptApprovals } from "./approvals.js";
import { classifyReview } from "./review.js";
import { assertSnapshotUsable, pageIdentity } from "./readiness.js";

function keyedScripts(scripts) {
  const externalOccurrences = new Map();
  return scripts.map((script) => {
    if (script.kind !== "external") {
      return [`inline:${script.dom_index}`, script];
    }
    const occurrence = externalOccurrences.get(script.src) ?? 0;
    externalOccurrences.set(script.src, occurrence + 1);
    return [`external:${script.src}#${occurrence}`, script];
  });
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
  const baselineMap = new Map(keyedScripts(baselineScripts));
  const currentMap = new Map(keyedScripts(currentScripts));
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
  assertSnapshotUsable(baseline, "Baseline");
  assertSnapshotUsable(current, "Current snapshot");
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
  const unapprovedScripts = currentScripts.filter((script) => script.approval.status === "unapproved");
  const expiredScripts = currentScripts.filter((script) => script.approval.status === "expired");
  const pendingScripts = currentScripts.filter((script) => script.approval.status === "pending");
  const integrityUnavailable = currentScripts.filter((script) => script.integrity_evidence.status === "unavailable");
  const integrityEvidenced = currentScripts.filter((script) => script.integrity_evidence.status !== "unavailable");
  const fingerprintedScripts = currentScripts.filter((script) => script.integrity_evidence.fingerprint_observed);
  const baselineEngineVersion = baseline.engine?.version ?? null;
  const currentEngineVersion = current.engine?.version ?? null;
  const baselineCaptureMode = baseline.engine?.capture_mode ?? null;
  const currentCaptureMode = current.engine?.capture_mode ?? null;
  const scannerVersionChanged = baselineEngineVersion !== currentEngineVersion;
  const captureModeChanged = baselineCaptureMode !== currentCaptureMode;

  const reviewReasons = [];
  if (baseline.page.final_url && current.page.final_url &&
      pageIdentity(baseline.page.final_url) !== pageIdentity(current.page.final_url)) {
    reviewReasons.push("page_identity_changed");
  }
  if (digestObject(baseline.page.readiness ?? null) !== digestObject(current.page.readiness ?? null)) {
    reviewReasons.push("capture_expectations_changed");
  }
  if (scannerVersionChanged) reviewReasons.push("scanner_version_changed");
  if (captureModeChanged) reviewReasons.push("capture_mode_changed");
  if (scriptChanges.added.length) reviewReasons.push("scripts_added");
  if (scriptChanges.removed.length) reviewReasons.push("scripts_removed");
  if (scriptChanges.modified.length) reviewReasons.push("scripts_modified");
  if (headerChanges.length) reviewReasons.push("security_headers_changed");
  if (originChanges.added.length) reviewReasons.push("network_origins_added");
  if (unapprovedScripts.length) reviewReasons.push("unapproved_scripts_present");
  if (expiredScripts.length) reviewReasons.push("script_approvals_expired");
  if (pendingScripts.length) reviewReasons.push("script_approvals_not_yet_effective");
  if (integrityUnavailable.length) reviewReasons.push("script_integrity_unavailable");

  const result = {
    schema_version: "1.0",
    target_id: current.target.target_id,
    compared_at: now.toISOString(),
    baseline_snapshot_sha256: baseline.snapshot_sha256,
    current_snapshot_sha256: current.snapshot_sha256,
    status: reviewReasons.length ? "REVIEW_REQUIRED" : "PASS",
    review_reasons: reviewReasons,
    summary: {
      scripts_total: currentScripts.length,
      scripts_approved: currentScripts.filter((script) => script.approval.status === "approved").length,
      scripts_unapproved: unapprovedScripts.length,
      script_approvals_expired: expiredScripts.length,
      script_approvals_pending: pendingScripts.length,
      scripts_integrity_evidenced: integrityEvidenced.length,
      scripts_fingerprinted: fingerprintedScripts.length,
      scripts_integrity_unavailable: integrityUnavailable.length,
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
      expired: expiredScripts,
      pending: pendingScripts,
      integrity_unavailable: integrityUnavailable,
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

  result.review = classifyReview(result);
  result.summary.review_priority = result.review.priority;
  result.summary.findings_total = result.review.findings.length;
  return result;
}
