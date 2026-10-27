// Page identity is checked before a snapshot can become a baseline or PASS.
// Query values are deliberately excluded; they can contain session secrets.
export function pageIdentity(rawUrl) {
  const url = new URL(rawUrl);
  return `${url.origin}${url.pathname}`;
}

export class CaptureReadinessError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = "CaptureReadinessError";
    this.code = code;
  }
}

export function assertDocumentReady(config, httpStatus, finalUrl) {
  if (!Number.isInteger(httpStatus) || httpStatus < 200 || httpStatus >= 300) {
    throw new CaptureReadinessError("CAPTURE_HTTP_ERROR", `Expected a successful document response; received HTTP ${Number.isInteger(httpStatus) ? httpStatus : "unknown"}.`);
  }
  const expected = pageIdentity(config.capture_expectations?.expected_final_url ?? config.url);
  if (pageIdentity(finalUrl) !== expected) {
    // Do not echo private URL paths/query values into CI errors.
    throw new CaptureReadinessError("CAPTURE_WRONG_PAGE", "The final origin/path does not match the configured checkout page. Check for a login or empty-cart redirect.");
  }
}

export function readinessEvidence(config, markerState) {
  return {
    expected_final_url: pageIdentity(config.capture_expectations?.expected_final_url ?? config.url),
    ready_element_id: config.capture_expectations?.ready_element_id ?? null,
    marker_check: markerState,
    scope: "Page identity/readiness only; checkout functionality is not tested.",
  };
}

export function assertSnapshotUsable(snapshot, label) {
  // Older in-memory integrations may omit this field; actual scanner snapshots
  // always include it. The scanner independently enforces document readiness.
  const status = snapshot.page?.http_status;
  if (status !== undefined && (!Number.isInteger(status) || status < 200 || status >= 300)) {
    throw new CaptureReadinessError("CAPTURE_HTTP_ERROR", `${label} contains an unsuccessful HTTP status. Review the capture before comparison.`);
  }
  const ready = snapshot.page?.readiness;
  if (ready) {
    if (!snapshot.page.final_url || pageIdentity(snapshot.page.final_url) !== ready.expected_final_url) {
      throw new CaptureReadinessError("CAPTURE_WRONG_PAGE", `${label} does not match its recorded page expectation.`);
    }
    if (ready.ready_element_id && !["PRESENT", "VISIBLE"].includes(ready.marker_check)) {
      throw new CaptureReadinessError("CAPTURE_MARKER_MISSING", `${label} has no successful readiness-marker check.`);
    }
  }
}
