#!/usr/bin/env node
import { access, appendFile, readFile, writeFile } from "node:fs/promises";
import { buildApprovalTemplate, loadApprovals } from "./approvals.js";
import { compareSnapshots } from "./compare.js";
import { loadConfig } from "./config.js";
import { generateHtmlReport } from "./report.js";
import { scanPage } from "./scanner.js";
import { buildReleasePassport } from "./passport.js";
import { buildControlCoverage, buildMonitoringEvent, buildReviewAlert } from "./monitoring.js";
import { verifyArtifactDigest } from "./verification.js";
import {
  loadBaseline,
  saveJson,
  saveMonitoringEvent,
  saveReport,
  savePassport,
  saveReviewAlert,
  saveSnapshot,
  setBaseline,
  targetPaths,
} from "./storage.js";

function usage() {
  return `Checkout Evidence Engine

Usage:
  checkout-evidence baseline --config <target.json> --ack-authorized [--headed] [--force-baseline]
  checkout-evidence check    --config <target.json> --ack-authorized [--headed] [--no-fail]
  checkout-evidence verify-passport --file <passport.json>
  checkout-evidence verify-event    --file <event.json>
  checkout-evidence verify-alert    --file <alert.json>

Safety:
  --ack-authorized is mandatory. Use this only for a page you own or are explicitly authorized to inspect.
  The engine navigates once and passively observes resources. It does not click or submit forms.
  Baseline creation refuses to replace an existing baseline unless --force-baseline is supplied explicitly.

Exit codes for check:
  0  PASS, or --no-fail was supplied
  2  REVIEW_REQUIRED
  1  Configuration or runtime error
`;
}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  const options = {
    command,
    config: null,
    ackAuthorized: false,
    headed: false,
    noFail: false,
    file: null,
    forceBaseline: false,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === "--config") {
      options.config = rest[++index];
    } else if (argument === "--ack-authorized") {
      options.ackAuthorized = true;
    } else if (argument === "--headed") {
      options.headed = true;
    } else if (argument === "--no-fail") {
      options.noFail = true;
    } else if (argument === "--file") {
      options.file = rest[++index];
    } else if (argument === "--force-baseline") {
      options.forceBaseline = true;
    } else if (["--help", "-h"].includes(argument)) {
      options.command = "help";
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

async function runVerifyArtifact(filePath, type) {
  if (!filePath) throw new Error(`Missing --file <${type}.json>`);
  const document = JSON.parse(await readFile(filePath, "utf8"));
  const verified = verifyArtifactDigest(document, type);
  console.log(`${type[0].toUpperCase()}${type.slice(1)} digest: VERIFIED`);
  console.log(`Artifact ID:        ${verified.artifact_id}`);
  console.log(`Decision:           ${verified.decision ?? "UNKNOWN"}`);
  console.log("Note: digest verification detects content mismatch; signer authenticity requires an external attestation or signature.");
}

async function capture(config, options) {
  try {
    return await scanPage(config, { headed: options.headed });
  } catch (error) {
    if (error.message.includes("Executable doesn't exist")) {
      throw new Error(`${error.message}\nInstall the browser once with: npx playwright install chromium`);
    }
    throw error;
  }
}

async function runBaseline(config, options) {
  const paths = targetPaths(config);
  if (!options.forceBaseline) {
    try {
      await access(paths.baseline);
      throw new Error("A baseline already exists. Review it instead of replacing it, or use --force-baseline only for an explicitly approved reset.");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  const snapshot = await capture(config, options);
  const snapshotPath = await saveSnapshot(config, snapshot);
  const baselinePath = await setBaseline(config, snapshotPath);
  const template = buildApprovalTemplate(snapshot);
  await saveJson(paths.approvalTemplate, template);

  console.log(`Baseline captured: ${baselinePath}`);
  console.log(`Immutable scan:    ${snapshotPath}`);
  console.log(`Approval template: ${paths.approvalTemplate}`);
  console.log(`Snapshot digest:   ${snapshot.snapshot_sha256}`);
  console.log("Next: review the approval template and copy approved entries into the configured approvals file.");

  await writeBaselineGitHubOutputs({
    config,
    snapshot,
    snapshotPath,
    baselinePath,
    approvalTemplatePath: paths.approvalTemplate,
  });
}

async function runCheck(config, options) {
  const baseline = await loadBaseline(config);
  const current = await capture(config, options);
  const currentPath = await saveSnapshot(config, current);
  const approvals = await loadApprovals(config.approvals_file, config.target_id);
  const comparison = compareSnapshots(baseline, current, approvals);
  const comparisonPath = currentPath.replace(/\.json$/, ".comparison.json");
  await writeFile(comparisonPath, `${JSON.stringify(comparison, null, 2)}\n`, "utf8");
  const notificationMode = process.env.CHECKOUT_PASSPORT_ALERT_MODE || "artifact";
  const controlCoverage = buildControlCoverage(config, comparison, notificationMode);
  const report = generateHtmlReport(config, baseline, current, comparison, controlCoverage);
  const reportPath = await saveReport(config, current.captured_at, current.snapshot_sha256, report);
  const passport = buildReleasePassport({
    config,
    baseline,
    current,
    comparison,
    comparisonPath,
    reportPath,
    reportHtml: report,
    controlCoverage,
  });
  const passportPath = await savePassport(
    config,
    current.captured_at,
    current.snapshot_sha256,
    passport,
  );
  const monitoringEvent = buildMonitoringEvent({
    config,
    current,
    comparison,
    passport,
    controlCoverage,
    paths: {
      snapshotPath: currentPath,
      comparisonPath,
      reportPath,
      passportPath,
    },
  });
  const monitoringEventPath = await saveMonitoringEvent(
    config,
    current.captured_at,
    current.snapshot_sha256,
    monitoringEvent,
  );
  const reviewAlert = buildReviewAlert(config, monitoringEvent);
  const alertPath = await saveReviewAlert(
    config,
    current.captured_at,
    current.snapshot_sha256,
    reviewAlert,
  );

  console.log(`Status:            ${comparison.status}`);
  console.log(`Review priority:   ${comparison.review.priority}`);
  console.log(`Current scan:      ${currentPath}`);
  console.log(`Comparison JSON:   ${comparisonPath}`);
  console.log(`HTML report:       ${reportPath}`);
  console.log(`Release passport:  ${passportPath}`);
  console.log(`Monitoring event:  ${monitoringEventPath}`);
  console.log(`Review alert:      ${alertPath}`);
  console.log(`Current digest:    ${current.snapshot_sha256}`);

  await writeGitHubOutputs({
    config,
    comparison,
    snapshotPath: currentPath,
    comparisonPath,
    reportPath,
    passportPath,
    passport,
    monitoringEventPath,
    alertPath,
  });

  if (comparison.status === "REVIEW_REQUIRED" && !options.noFail) {
    process.exitCode = 2;
  }
}

function oneLine(value) {
  return String(value).replace(/[\r\n|`]/g, " ").trim();
}

async function writeBaselineGitHubOutputs({ config, snapshot, snapshotPath, baselinePath, approvalTemplatePath }) {
  if (process.env.GITHUB_OUTPUT) {
    const outputs = [
      "status=BASELINE_CREATED",
      `target_id=${config.target_id}`,
      `snapshot_path=${snapshotPath}`,
      `baseline_path=${baselinePath}`,
      `approval_template_path=${approvalTemplatePath}`,
    ];
    await appendFile(process.env.GITHUB_OUTPUT, `${outputs.join("\n")}\n`, "utf8");
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const summary = `## Checkout Release Passport baseline\n\n` +
      `| Field | Result |\n|---|---|\n` +
      `| Target | ${oneLine(config.name)} |\n` +
      `| Status | **BASELINE_CREATED** |\n` +
      `| Snapshot digest | \`${snapshot.snapshot_sha256}\` |\n\n` +
      `Review the baseline and approval template before committing them. Do not regenerate the baseline automatically on every release check.\n`;
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
  }
}

async function writeGitHubOutputs({
  config,
  comparison,
  snapshotPath,
  comparisonPath,
  reportPath,
  passportPath,
  passport,
  monitoringEventPath,
  alertPath,
}) {
  if (process.env.GITHUB_OUTPUT) {
    const outputs = [
      `status=${comparison.status}`,
      `target_id=${config.target_id}`,
      `snapshot_path=${snapshotPath}`,
      `passport_id=${passport.passport_id}`,
      `passport_sha256=${passport.passport_sha256}`,
      `passport_path=${passportPath}`,
      `report_path=${reportPath}`,
      `comparison_path=${comparisonPath}`,
      `monitoring_event_path=${monitoringEventPath}`,
      `alert_path=${alertPath}`,
      `review_priority=${comparison.review.priority}`,
    ];
    await appendFile(process.env.GITHUB_OUTPUT, `${outputs.join("\n")}\n`, "utf8");
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const summary = `## Checkout Release Passport\n\n` +
      `| Field | Result |\n|---|---|\n` +
      `| Target | ${oneLine(config.name)} |\n` +
      `| Decision | **${comparison.status}** |\n` +
      `| Passport | \`${passport.passport_id}\` |\n` +
      `| Review priority | **${comparison.review.priority}** |\n` +
      `| Added scripts | ${comparison.summary.scripts_added} |\n` +
      `| Modified scripts | ${comparison.summary.scripts_modified} |\n` +
      `| Header changes | ${comparison.summary.security_headers_changed} |\n` +
      `| Unapproved / expired / pending | ${comparison.summary.scripts_unapproved} / ${comparison.summary.script_approvals_expired} / ${comparison.summary.script_approvals_pending} |\n` +
      `| Integrity gaps | ${comparison.summary.scripts_integrity_unavailable} |\n\n` +
      `This is authorized technical control evidence, not PCI DSS certification or proof of compromise.\n`;
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (["--help", "-h"].includes(options.command)) options.command = "help";
  if (!options.command || options.command === "help") {
    console.log(usage());
    return;
  }
  const verificationCommands = {
    "verify-passport": "passport",
    "verify-event": "event",
    "verify-alert": "alert",
  };
  if (verificationCommands[options.command]) {
    await runVerifyArtifact(options.file, verificationCommands[options.command]);
    return;
  }
  if (!["baseline", "check"].includes(options.command)) {
    throw new Error(`Unknown command: ${options.command}\n\n${usage()}`);
  }
  if (!options.ackAuthorized) {
    throw new Error("Refusing to run without --ack-authorized");
  }

  const { config } = await loadConfig(options.config);
  if (options.command === "baseline") {
    await runBaseline(config, options);
  } else {
    await runCheck(config, options);
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  console.error("Capture/check incomplete: no PASS or recovery decision was produced by this invocation. Do not treat an earlier report as this run's result.");
  process.exitCode = 1;
});
