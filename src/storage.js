import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function compactTimestamp(isoString) {
  return isoString.replaceAll("-", "").replaceAll(":", "").replace(".", "-");
}

export function targetPaths(config) {
  const root = path.join(config.output_dir, config.target_id);
  return {
    root,
    baseline: path.join(root, "baseline.json"),
    scans: path.join(root, "scans"),
    reports: path.join(root, "reports"),
    passports: path.join(root, "passports"),
    approvalTemplate: path.join(root, "approval-template.json"),
  };
}

export async function ensureTargetDirectories(config) {
  const paths = targetPaths(config);
  await Promise.all([
    mkdir(paths.scans, { recursive: true }),
    mkdir(paths.reports, { recursive: true }),
    mkdir(paths.passports, { recursive: true }),
  ]);
  return paths;
}

export async function savePassport(config, capturedAt, snapshotHash, passport) {
  const paths = await ensureTargetDirectories(config);
  const filename = `${compactTimestamp(capturedAt)}-${snapshotHash.slice(0, 12)}.passport.json`;
  const passportPath = path.join(paths.passports, filename);
  await writeFile(passportPath, `${JSON.stringify(passport, null, 2)}\n`, "utf8");
  return passportPath;
}

export async function saveSnapshot(config, snapshot) {
  const paths = await ensureTargetDirectories(config);
  const filename = `${compactTimestamp(snapshot.captured_at)}-${snapshot.snapshot_sha256.slice(0, 12)}.json`;
  const snapshotPath = path.join(paths.scans, filename);
  await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return snapshotPath;
}

export async function setBaseline(config, snapshotPath) {
  const paths = await ensureTargetDirectories(config);
  await copyFile(snapshotPath, paths.baseline);
  return paths.baseline;
}

export async function loadBaseline(config) {
  const { baseline } = targetPaths(config);
  try {
    return JSON.parse(await readFile(baseline, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("No baseline exists. Run the baseline command first.");
    }
    throw error;
  }
}

export async function saveJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function saveReport(config, capturedAt, snapshotHash, html) {
  const paths = await ensureTargetDirectories(config);
  const filename = `${compactTimestamp(capturedAt)}-${snapshotHash.slice(0, 12)}.html`;
  const reportPath = path.join(paths.reports, filename);
  await writeFile(reportPath, html, "utf8");
  return reportPath;
}
