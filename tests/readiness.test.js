import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanPage } from "../src/scanner.js";
import { compareSnapshots } from "../src/compare.js";
import { validateConfig } from "../src/config.js";
import { startReadinessServer } from "../verification/owned-readiness-server.mjs";

test("static capture verifies page identity and the configured HTML marker", async (t) => {
  const fixture = await startReadinessServer(); t.after(() => fixture.close());
  const result = await scanPage(fixture.config());
  assert.equal(result.page.readiness.marker_check, "PRESENT");
  assert.equal(result.page.readiness.expected_final_url, `${fixture.origin}/checkout`);
});

for (const [state, code] of [["http500", "CAPTURE_HTTP_ERROR"], ["http404", "CAPTURE_HTTP_ERROR"], ["redirect", "CAPTURE_WRONG_PAGE"], ["missing", "CAPTURE_MARKER_MISSING"]]) {
  test(`static capture rejects ${state} instead of producing evidence`, async (t) => {
    const fixture = await startReadinessServer(); t.after(() => fixture.close());
    fixture.setState(state);
    await assert.rejects(scanPage(fixture.config()), (error) => error.code === code && !error.message.includes("private-test-value"));
  });
}

test("static capture timeout is an error", async (t) => {
  const fixture = await startReadinessServer(); t.after(() => fixture.close());
  fixture.setState("timeout");
  await assert.rejects(scanPage(fixture.config()));
});

test("redirect to login is rejected even without an explicitly configured marker", async (t) => {
  const fixture = await startReadinessServer(); t.after(() => fixture.close());
  const config = fixture.config(); delete config.capture_expectations;
  fixture.setState("redirect");
  await assert.rejects(scanPage(config), /CAPTURE_WRONG_PAGE/);
});

test("an intentional authorised redirect requires an explicit expected final URL", async (t) => {
  const fixture = await startReadinessServer(); t.after(() => fixture.close());
  const config = fixture.config(); config.capture_expectations.expected_final_url = `${fixture.origin}/login`;
  fixture.setState("redirect");
  const result = await scanPage(config);
  assert.equal(result.page.readiness.marker_check, "PRESENT");
  assert.equal(result.page.final_url.includes("private-test-value"), false);
});

test("readiness configuration rejects secrets, unauthorized origins and unsafe marker selectors", async (t) => {
  const fixture = await startReadinessServer(); t.after(() => fixture.close());
  for (const expected of [`${fixture.origin}/checkout?token=secret`, "https://not-authorised.example/checkout"]) {
    const config = fixture.config(); config.capture_expectations.expected_final_url = expected;
    assert.throws(() => validateConfig(config), /Invalid configuration/);
  }
  const config = fixture.config(); config.capture_expectations.ready_element_id = "main >> script";
  assert.throws(() => validateConfig(config), /ready_element_id/);
});

function comparisonFixture() {
  return { target: { target_id: "test" }, snapshot_sha256: "a".repeat(64), engine: { version: "0.4.1", capture_mode: "browser" }, page: { http_status: 200, final_url: "https://owned.example/checkout", security_headers: {} }, scripts: [], network_origins: [] };
}

test("comparator refuses unsuccessful HTTP snapshots", () => {
  const base = comparisonFixture(); const current = structuredClone(base); current.page.http_status = 500;
  assert.throws(() => compareSnapshots(base, current, { approvals: [] }), /CAPTURE_HTTP_ERROR/);
});

test("comparator flags page identity changes in legacy snapshots", () => {
  const base = comparisonFixture(); const current = structuredClone(base); current.page.final_url = "https://owned.example/login";
  const result = compareSnapshots(base, current, { approvals: [] });
  assert.equal(result.status, "REVIEW_REQUIRED");
  assert.ok(result.review_reasons.includes("page_identity_changed"));
});

test("removing readiness expectations requires review rather than a silent PASS", () => {
  const base = comparisonFixture();
  base.page.readiness = { expected_final_url: base.page.final_url, ready_element_id: "ready", marker_check: "VISIBLE" };
  const current = structuredClone(base); delete current.page.readiness;
  assert.ok(compareSnapshots(base, current, { approvals: [] }).review_reasons.includes("capture_expectations_changed"));
});

test("CLI --no-fail cannot turn failed capture into PASS or overwrite a reviewed baseline", async (t) => {
  const fixture = await startReadinessServer(); t.after(() => fixture.close());
  const directory = await mkdtemp(path.join(tmpdir(), "passport-readiness-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const config = { ...fixture.config(), output_dir: path.join(directory, "evidence"), approvals_file: path.join(directory, "approvals.json") };
  const configPath = path.join(directory, "target.json"); await writeFile(configPath, JSON.stringify(config));
  const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));
  const run = promisify(execFile);
  await run(process.execPath, [cli, "baseline", "--config", configPath, "--ack-authorized"]);
  const baselinePath = path.join(config.output_dir, config.target_id, "baseline.json");
  const original = await readFile(baselinePath, "utf8");
  fixture.setState("redirect");
  for (const args of [["check", "--no-fail"], ["baseline", "--force-baseline"]]) {
    await assert.rejects(run(process.execPath, [cli, ...args, "--config", configPath, "--ack-authorized"]), (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /CAPTURE_WRONG_PAGE/);
      assert.doesNotMatch(error.stdout, /Status:.*PASS|Baseline captured/);
      return true;
    });
  }
  assert.equal(await readFile(baselinePath, "utf8"), original);
});
