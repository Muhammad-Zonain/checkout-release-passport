import test from "node:test";
import assert from "node:assert/strict";
import { buildControlCoverage, buildMonitoringEvent, buildReviewAlert } from "../src/monitoring.js";

function config() {
  return {
    target_id: "shop-checkout",
    name: "Shop Checkout",
    monitoring: {
      expected_interval_hours: 24,
      response_target_hours: 4,
      review_owner: "Ecommerce Engineering",
    },
  };
}

function comparison(status = "REVIEW_REQUIRED") {
  return {
    compared_at: "2026-08-11T12:00:00.000Z",
    status,
    review_reasons: status === "PASS" ? [] : ["scripts_added"],
    summary: {
      scripts_total: 2,
      scripts_approved: status === "PASS" ? 2 : 1,
      scripts_integrity_evidenced: 2,
      script_approvals_expired: 0,
      scripts_unapproved: status === "PASS" ? 0 : 1,
      scripts_integrity_unavailable: 0,
    },
    review: {
      priority: status === "PASS" ? "NONE" : "P1",
      findings: status === "PASS" ? [] : [{
        finding_id: "crf_example",
        type: "script_added",
        priority: "P1",
        message: "A third-party script was added.",
        evidence: {},
      }],
    },
  };
}

function eventFor(status) {
  const currentComparison = comparison(status);
  const coverage = buildControlCoverage(config(), currentComparison, "github-issue");
  return buildMonitoringEvent({
    config: config(),
    current: {
      snapshot_sha256: "a".repeat(64),
      target: { requested_url: "https://shop.example/checkout" },
    },
    comparison: currentComparison,
    passport: { passport_id: "crp_1234567890abcdef1234", passport_sha256: "b".repeat(64) },
    controlCoverage: coverage,
    paths: {
      snapshotPath: "/tmp/snapshot.json",
      comparisonPath: "/tmp/comparison.json",
      reportPath: "/tmp/report.html",
      passportPath: "/tmp/passport.json",
    },
    env: {
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: "owner/repository",
      GITHUB_RUN_ID: "123",
    },
  });
}

test("control coverage separates evidence status from compliance determination", () => {
  const coverage = buildControlCoverage(config(), comparison(), "github-issue");
  assert.equal(coverage.script_management.status, "ATTENTION_REQUIRED");
  assert.equal(coverage.change_detection.review_priority, "P1");
  assert.match(coverage.boundary, /does not determine PCI DSS compliance/);
});

test("monitoring event binds the decision, passport, evidence paths, and workflow run", () => {
  const event = eventFor("REVIEW_REQUIRED");
  assert.match(event.event_id, /^cme_[a-f0-9]{20}$/);
  assert.match(event.event_sha256, /^[a-f0-9]{64}$/);
  assert.equal(event.evidence.workflow_run, "https://github.com/owner/repository/actions/runs/123");
  assert.equal(event.decision.review_priority, "P1");
});

test("alert opens or updates on review and resolves an existing issue after PASS", () => {
  const reviewAlert = buildReviewAlert(config(), eventFor("REVIEW_REQUIRED"));
  const passAlert = buildReviewAlert(config(), eventFor("PASS"));
  assert.equal(reviewAlert.action, "open_or_update");
  assert.match(reviewAlert.body_markdown, /Checkout review required/);
  assert.equal(passAlert.action, "resolve_if_open");
  assert.match(passAlert.body_markdown, /Checkout control restored/);
  assert.equal(reviewAlert.issue_marker, passAlert.issue_marker);
});
