import path from "node:path";
import { digestObject, sha256 } from "./hash.js";

function clean(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function githubProvenance(env) {
  return {
    provider: env.GITHUB_ACTIONS === "true" ? "github-actions" : "local",
    repository: clean(env.GITHUB_REPOSITORY),
    commit_sha: clean(env.GITHUB_SHA),
    ref: clean(env.GITHUB_REF),
    event_name: clean(env.GITHUB_EVENT_NAME),
    workflow: clean(env.GITHUB_WORKFLOW),
    actor: clean(env.GITHUB_ACTOR),
    run_id: clean(env.GITHUB_RUN_ID),
    run_attempt: clean(env.GITHUB_RUN_ATTEMPT),
    action_repository: clean(env.CHECKOUT_PASSPORT_ACTION_REPOSITORY) ?? clean(env.GITHUB_ACTION_REPOSITORY),
    action_ref: clean(env.CHECKOUT_PASSPORT_ACTION_REF) ?? clean(env.GITHUB_ACTION_REF),
  };
}

export function buildReleasePassport({
  config,
  baseline,
  current,
  comparison,
  comparisonPath,
  reportPath,
  reportHtml,
  env = process.env,
}) {
  const createdAt = new Date().toISOString();
  const core = {
    schema_version: "1.0",
    kind: "checkout-release-passport",
    created_at: createdAt,
    target: {
      target_id: config.target_id,
      name: config.name,
      requested_url: current.target.requested_url,
      capture_mode: current.engine.capture_mode,
    },
    authorization: {
      confirmed: current.target.authorization.confirmed,
      confirmed_by: current.target.authorization.confirmed_by,
      confirmed_at: current.target.authorization.confirmed_at,
      scope_note: current.target.authorization.scope_note,
      reference: clean(config.authorization.reference),
    },
    release: githubProvenance(env),
    generator: {
      name: current.engine.name,
      version: current.engine.version,
      capture_mode: current.engine.capture_mode,
    },
    decision: {
      status: comparison.status,
      review_reasons: comparison.review_reasons,
      summary: comparison.summary,
    },
    evidence: {
      baseline_snapshot_sha256: baseline.snapshot_sha256,
      current_snapshot_sha256: current.snapshot_sha256,
      comparison_sha256: digestObject(comparison),
      report_sha256: sha256(reportHtml),
      comparison_file: path.basename(comparisonPath),
      report_file: path.basename(reportPath),
    },
    data_boundaries: {
      response_bodies_stored: false,
      inline_script_content_stored: false,
      query_values_stored: false,
      cookies_stored: false,
      form_values_collected: false,
    },
    limitations: [
      "This passport records what the configured authorized check observed; it is not PCI DSS certification.",
      "It is not a penetration test, legal opinion, or guarantee that every script, header, vulnerability, or attack was detected.",
      "A pre-release check does not replace appropriately scoped continuous production monitoring.",
    ],
  };
  const passportSha256 = digestObject(core);
  return {
    ...core,
    passport_id: `crp_${passportSha256.slice(0, 20)}`,
    passport_sha256: passportSha256,
  };
}
