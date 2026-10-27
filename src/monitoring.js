import path from "node:path";
import { digestObject } from "./hash.js";

function safeMarkdown(value) {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[<>`|]/g, "")
    .replace(/([\\[\]()*_#])/g, "\\$1")
    .trim();
}

export function buildControlCoverage(config, comparison, notificationMode = "artifact") {
  const total = comparison.summary.scripts_total;
  const approved = comparison.summary.scripts_approved;
  const integrityEvidenced = comparison.summary.scripts_integrity_evidenced;

  return {
    schema_version: "1.0",
    assessed_at: comparison.compared_at,
    script_management: {
      scripts_observed: total,
      active_approvals: approved,
      business_justifications_documented: approved,
      integrity_evidence_available: integrityEvidenced,
      expired_approvals: comparison.summary.script_approvals_expired,
      pending_approvals: comparison.summary.script_approvals_pending,
      unapproved_scripts: comparison.summary.scripts_unapproved,
      integrity_gaps: comparison.summary.scripts_integrity_unavailable,
      status:
        approved === total && integrityEvidenced === total
          ? "EVIDENCED"
          : "ATTENTION_REQUIRED",
    },
    change_detection: {
      reviewed_baseline_compared: true,
      scripts_evaluated: true,
      selected_security_headers_evaluated: true,
      network_origins_evaluated: true,
      decision: comparison.status,
      review_priority: comparison.review.priority,
      status: comparison.status === "PASS" ? "NO_DRIFT_DETECTED" : "REVIEW_REQUIRED",
    },
    operations: {
      expected_interval_hours: config.monitoring.expected_interval_hours,
      review_owner: config.monitoring.review_owner,
      response_target_hours: config.monitoring.response_target_hours,
      notification_mode: notificationMode,
      cadence_verification: "Retain and review the actual GitHub Actions run history; configuration alone does not prove execution frequency.",
    },
    boundary: "This is technical control evidence. It does not determine PCI DSS compliance or replace an assessor, incident response, or real-user-session protection.",
  };
}

export function buildMonitoringEvent({ config, current, comparison, passport, controlCoverage, paths, env = process.env }) {
  const runUrl = env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID
    ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
    : null;
  const core = {
    schema_version: "1.0",
    kind: "checkout-monitoring-event",
    created_at: new Date().toISOString(),
    target: {
      target_id: config.target_id,
      name: config.name,
      requested_url: current.target.requested_url,
    },
    decision: {
      status: comparison.status,
      review_priority: comparison.review.priority,
      review_reasons: comparison.review_reasons,
      findings: comparison.review.findings,
    },
    control_coverage: controlCoverage,
    evidence: {
      passport_id: passport.passport_id,
      passport_sha256: passport.passport_sha256,
      snapshot_sha256: current.snapshot_sha256,
      snapshot_file: path.basename(paths.snapshotPath),
      comparison_file: path.basename(paths.comparisonPath),
      report_file: path.basename(paths.reportPath),
      passport_file: path.basename(paths.passportPath),
      workflow_run: runUrl,
    },
  };
  const eventDigest = digestObject(core);
  return {
    ...core,
    event_id: `cme_${eventDigest.slice(0, 20)}`,
    event_sha256: eventDigest,
  };
}

export function buildReviewAlert(config, monitoringEvent) {
  const needsReview = monitoringEvent.decision.status === "REVIEW_REQUIRED";
  const marker = `<!-- checkout-release-passport-alert:${config.target_id} -->`;
  const findings = monitoringEvent.decision.findings.slice(0, 12);
  const findingLines = findings.length
    ? findings.map((entry) => `- **${entry.priority}** ${safeMarkdown(entry.message)}`).join("\n")
    : "- No active review findings.";
  const runLine = monitoringEvent.evidence.workflow_run
    ? `- Workflow run: ${monitoringEvent.evidence.workflow_run}`
    : "- Workflow run: local execution";
  const action = needsReview ? "open_or_update" : "resolve_if_open";
  const body = `${marker}
## ${needsReview ? "Checkout review required" : "Checkout control restored"}

- Target: ${safeMarkdown(config.name)} (\`${safeMarkdown(config.target_id)}\`)
- Decision: **${monitoringEvent.decision.status}**
- Review priority: **${monitoringEvent.decision.review_priority}**
- Review owner: ${safeMarkdown(config.monitoring.review_owner)}
- Response target: ${config.monitoring.response_target_hours} hour(s)
- Monitoring event: \`${monitoringEvent.event_id}\`
- Passport: \`${monitoringEvent.evidence.passport_id}\`
${runLine}

### Findings

${findingLines}

Download the workflow artifact and review the HTML report, comparison JSON, monitoring event, and release passport before accepting or rolling back the change.

This alert is workflow evidence, not a PCI DSS compliance determination or proof of compromise.`;

  const core = {
    schema_version: "1.0",
    kind: "checkout-review-alert",
    created_at: new Date().toISOString(),
    action,
    dedupe_key: `checkout-release-passport:${config.target_id}`,
    issue_marker: marker,
    title: needsReview
      ? `[Checkout Control][${config.target_id}] ${monitoringEvent.decision.review_priority} review required`
      : `[Checkout Control][${config.target_id}] control restored`,
    body_markdown: body,
    suggested_labels: ["checkout-control", needsReview ? "review-required" : "resolved"],
    event_id: monitoringEvent.event_id,
    target_id: config.target_id,
    decision: monitoringEvent.decision.status,
    review_priority: monitoringEvent.decision.review_priority,
  };
  const digest = digestObject(core);
  return {
    ...core,
    alert_id: `cra_${digest.slice(0, 20)}`,
    alert_sha256: digest,
  };
}
