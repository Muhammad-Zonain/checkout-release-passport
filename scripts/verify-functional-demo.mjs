import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { startPracticeServer } from "../examples/functional-practice/server.mjs";
import { FunctionalCheckFailed, runCheckoutFlow } from "../examples/functional-practice/flow.mjs";

const args = process.argv.slice(2);
const mode = args.find((arg) => arg.startsWith("--mode="))?.slice(7) ?? "proof";
if (args.some((arg) => arg !== "--headed" && !["--mode=proof", "--mode=healthy", "--mode=broken"].includes(arg))) throw new Error("Use --headed and/or --mode=proof|healthy|broken.");
const cases = mode === "healthy" ? [["healthy", "none", "PASS"]] : mode === "broken" ? [["broken", "total", "PASS"]] : [["healthy", "none", "PASS"], ["broken-total", "total", "FAIL"], ["recovery", "none", "PASS"]];
const directory = path.resolve("evidence/functional-practice", new Date().toISOString().replaceAll(":", "-"));
await mkdir(directory, { recursive: true });
const results = [];
const fixture = await startPracticeServer();
let browser;
try {
  browser = await chromium.launch({ headless: !args.includes("--headed"), slowMo: args.includes("--headed") ? 350 : 0 });
  for (const [name, fault, expected] of cases) {
    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1100, height: 900 } });
    const page = await context.newPage();
    const result = { case: name, expected, actual: "PASS", accepted: false, detail: "All agreed assertions passed.", screenshot: `${name}.png` };
    try { await runCheckoutFlow(page, `${fixture.origin}/checkout?fault=${fault}`); }
    catch (error) {
      result.actual = error instanceof FunctionalCheckFailed ? "FAIL" : "ERROR";
      result.detail = error.message;
      result.check = error.check ?? null;
    }
    result.accepted = result.actual === expected && (expected !== "FAIL" || result.check === "Checkout total");
    await page.screenshot({ path: path.join(directory, result.screenshot), fullPage: true });
    await context.close();
    results.push(result);
    console.log(`${name}: ${result.actual}; expected ${expected}; ${result.accepted ? "verified" : "NOT VERIFIED"}. ${result.detail}`);
  }
} catch (error) {
  results.push({ case: "runner", expected: "RUN", actual: "ERROR", accepted: false, detail: error.message });
  console.error("Browser verification did not complete. Install Chromium with: npx --no-install playwright install chromium");
} finally {
  await browser?.close(); await fixture.close();
}
const successful = results.length === cases.length && results.every((result) => result.accepted);
const evidence = { kind: "creator-owned-functional-practice", created_at: new Date().toISOString(), mode, verified: successful, customer_validation: false, real_payment_processed: false, results };
await writeFile(path.join(directory, "results.json"), JSON.stringify(evidence, null, 2) + "\n");
const escape = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
await writeFile(path.join(directory, "report.html"), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Functional practice results</title><style>body{max-width:1000px;margin:40px auto;padding:24px;font:17px/1.5 system-ui;color:#183540}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:12px;border-bottom:1px solid #ccc}img{max-width:100%;border:1px solid #ddd}code{white-space:pre-wrap}</style><h1>Functional checkout practice</h1><p>Verification: <strong>${successful ? "COMPLETED" : "INCOMPLETE / FAILED"}</strong></p><p>Creator-owned fixture. No real payment, merchant access or customer validation. A deliberate FAIL proves the negative case only when the expected total assertion failed.</p><table><tr><th>Case</th><th>Expected</th><th>Actual</th><th>Accepted</th></tr>${results.map((r) => `<tr><td>${escape(r.case)}</td><td>${escape(r.expected)}</td><td>${escape(r.actual)}</td><td>${r.accepted ? "Yes" : "No"}</td></tr>`).join("")}</table>${results.map((r) => `<h2>${escape(r.case)}</h2><p><code>${escape(r.detail)}</code></p>${r.screenshot ? `<img alt="${escape(r.case)} practice result" src="${escape(r.screenshot)}">` : ""}`).join("")}</html>`);
console.log(`Report: ${path.join(directory, "report.html")}`);
process.exitCode = successful ? 0 : 1;
