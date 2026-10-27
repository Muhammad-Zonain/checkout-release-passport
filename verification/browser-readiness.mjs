import test from "node:test";
import assert from "node:assert/strict";
import { scanPage } from "../src/scanner.js";
import { startReadinessServer } from "./owned-readiness-server.mjs";

// Run explicitly with npm run test:browser. Missing Chromium is a failure,
// never a skip or a mocked browser success.
test("browser capture verifies a visible marker on the intended checkout", async (t) => {
  const fixture = await startReadinessServer(); t.after(() => fixture.close());
  const result = await scanPage(fixture.config("browser"));
  assert.equal(result.page.readiness.marker_check, "VISIBLE");
  assert.equal(result.scripts.length, 1);
});

for (const [state, code] of [
  ["http500", "CAPTURE_HTTP_ERROR"], ["http404", "CAPTURE_HTTP_ERROR"],
  ["redirect", "CAPTURE_WRONG_PAGE"], ["late-redirect", "CAPTURE_WRONG_PAGE"],
  ["missing", "CAPTURE_MARKER_MISSING"], ["hidden", "CAPTURE_MARKER_MISSING"],
  ["timeout", "CAPTURE_NAVIGATION_FAILED"],
]) {
  test(`real browser refuses ${state}`, async (t) => {
    const fixture = await startReadinessServer(); t.after(() => fixture.close());
    fixture.setState(state);
    await assert.rejects(scanPage(fixture.config("browser")), (error) => error.code === code);
  });
}
