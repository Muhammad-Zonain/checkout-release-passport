import { digestObject } from "./hash.js";

const PRIORITY_RANK = { NONE: 0, P3: 1, P2: 2, P1: 3 };
const HIGH_IMPACT_HEADERS = new Set([
  "content-security-policy",
  "content-security-policy-report-only",
  "strict-transport-security",
  "permissions-policy",
]);

function scriptName(script) {
  return script.kind === "external" ? script.src : `inline script #${script.dom_index}`;
}

function finding(type, priority, message, evidence = {}) {
  const core = { type, priority, message, evidence };
  return {
    finding_id: `crf_${digestObject(core).slice(0, 16)}`,
    ...core,
  };
}

function highestPriority(findings) {
  return findings.reduce(
    (highest, entry) => (PRIORITY_RANK[entry.priority] > PRIORITY_RANK[highest] ? entry.priority : highest),
    "NONE",
  );
}

export function classifyReview(comparison) {
  const findings = [];

  if (comparison.review_reasons?.includes("page_identity_changed")) {
    findings.push(finding("page_identity_changed", "P2", "The observed page origin/path changed. Confirm the intended checkout before accepting a new baseline."));
  }
  if (comparison.review_reasons?.includes("capture_expectations_changed")) {
    findings.push(finding("capture_expectations_changed", "P3", "The expected page or readiness-marker policy changed. Review the new capture conditions."));
  }

  for (const script of comparison.scripts.integrity_unavailable) {
    findings.push(finding(
      "script_integrity_unavailable",
      "P1",
      `No script fingerprint or declared SRI was available for ${scriptName(script)}.`,
      { script: scriptName(script), first_party: script.first_party },
    ));
  }

  for (const script of comparison.scripts.unapproved) {
    findings.push(finding(
      "script_unapproved",
      "P1",
      `No active authorization and business justification matched ${scriptName(script)}.`,
      { script: scriptName(script), first_party: script.first_party },
    ));
  }

  for (const script of comparison.scripts.expired) {
    findings.push(finding(
      "script_approval_expired",
      "P2",
      `The documented approval expired for ${scriptName(script)}.`,
      { script: scriptName(script), approval_id: script.approval.approval_id },
    ));
  }

  for (const script of comparison.scripts.pending) {
    findings.push(finding(
      "script_approval_not_yet_effective",
      "P2",
      `The matching approval is dated in the future for ${scriptName(script)}.`,
      { script: scriptName(script), approval_id: script.approval.approval_id },
    ));
  }

  for (const entry of comparison.scripts.modified) {
    findings.push(finding(
      "script_modified",
      entry.after.first_party ? "P2" : "P1",
      `The observed content or execution attributes changed for ${scriptName(entry.after)}.`,
      { script: scriptName(entry.after), first_party: entry.after.first_party },
    ));
  }

  for (const script of comparison.scripts.added) {
    findings.push(finding(
      "script_added",
      script.first_party ? "P2" : "P1",
      `A ${script.first_party ? "first-party" : "third-party"} script was added: ${scriptName(script)}.`,
      { script: scriptName(script), first_party: script.first_party },
    ));
  }

  for (const script of comparison.scripts.removed) {
    findings.push(finding(
      "script_removed",
      "P3",
      `A previously observed script was removed: ${scriptName(script)}.`,
      { script: scriptName(script) },
    ));
  }

  for (const header of comparison.security_headers.changed) {
    const removed = header.before !== null && header.after === null;
    findings.push(finding(
      "security_header_changed",
      removed && HIGH_IMPACT_HEADERS.has(header.name) ? "P1" : "P2",
      `${header.name} was ${removed ? "removed" : "changed"}.`,
      { header: header.name, removed },
    ));
  }

  for (const origin of comparison.network_origins.added) {
    findings.push(finding(
      "network_origin_added",
      origin.first_party ? "P3" : "P2",
      `A ${origin.first_party ? "first-party" : "third-party"} network origin was added: ${origin.origin}.`,
      { origin: origin.origin, first_party: origin.first_party },
    ));
  }

  if (comparison.engine.scanner_version_changed) {
    findings.push(finding(
      "scanner_version_changed",
      "P3",
      "The evidence-engine version changed; review the new observation before accepting it.",
      comparison.engine,
    ));
  }
  if (comparison.engine.capture_mode_changed) {
    findings.push(finding(
      "capture_mode_changed",
      "P3",
      "The capture mode changed; the new evidence may not be directly comparable with the baseline.",
      comparison.engine,
    ));
  }

  if (comparison.status === "REVIEW_REQUIRED" && findings.length === 0) {
    findings.push(finding(
      "other_review_reason",
      "P3",
      "The comparison requires documented review for an uncategorized reason.",
      { review_reasons: comparison.review_reasons },
    ));
  }

  const priority = highestPriority(findings);
  return {
    priority,
    label: {
      NONE: "No review finding",
      P1: "Immediate human review",
      P2: "Prompt human review",
      P3: "Planned human review",
    }[priority],
    findings,
    disclaimer: "Review priority ranks workflow urgency; it is not a vulnerability severity or proof of compromise.",
  };
}
