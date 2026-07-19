# Days 1–7: evidence-engine execution plan

## End-of-week outcome

By the end of day 7, the engine must prove this exact sequence:

1. Capture an authorized checkout-page baseline.
2. Store script and security-header evidence without sensitive content.
3. Confirm that an unchanged page returns `PASS`.
4. Detect an added script, modified script, or security-header change.
5. Mark an unapproved script as requiring human review.
6. Generate an HTML report containing hashes, approvals, changes, scope, and limitations.

Anything not necessary for that sequence is outside the first-week scope.

## Day 1 — Freeze the scope and safety boundary

### Work

- Read `docs/SECURITY_AND_SCOPE.md`.
- Install Node.js 20+ and run `npm install`.
- Run `npm test`.
- Open `examples/demo-target.json` and understand the authorization record.
- Start the harmless local v1 demonstration.

### Understand

- The product is an evidence ledger, not a vulnerability scanner.
- It must never collect card data, cookies, form values, or script bodies.
- Every target requires explicit authorization.

### Acceptance check

The CLI refuses to run when `--ack-authorized` is missing or the configuration lacks an authorization record.

## Day 2 — Understand the capture engine

### Work

- Read `src/scanner.js` in these sections: URL observation, script hashing, header selection, and snapshot creation.
- Run static mode against demo v1.
- Inspect the generated immutable scan JSON.
- On your own computer, install Playwright Chromium and repeat with browser mode.

### Understand

- Static mode sees scripts declared in HTML but does not execute JavaScript.
- Browser mode observes runtime-loaded resources but must still perform no interaction.
- External script bodies are hashed in memory and then discarded.

### Acceptance check

The snapshot contains script metadata, SHA-256 hashes, selected security headers, network origins, privacy declarations, and its own digest.

## Day 3 — Verify privacy and evidence integrity

### Work

- Inspect `src/privacy.js` and `src/hash.js`.
- Add a harmless query string to a local script URL and confirm its value is redacted in stored evidence.
- Confirm that `set-cookie` is absent from snapshots.
- Change one byte in a demo script and confirm its content hash changes.

### Understand

- A content hash proves that bytes changed; it does not prove whether the change was malicious.
- The snapshot digest makes later tampering detectable.
- Evidence should be minimized because checkout environments may contain sensitive information.

### Acceptance check

No response body, inline-script text, cookie, form value, or URL query value appears in an evidence file.

## Day 4 — Baseline and change comparison

### Work

- Read `src/compare.js` and `src/storage.js`.
- Capture demo v1 as the baseline.
- Check demo v1 again and confirm `PASS`.
- Start demo v2 and run another check.

### Understand

- The baseline represents an approved state, not merely the latest state.
- Added, removed, and modified scripts need separate treatment.
- A changed security header can alter checkout risk even if no script tag changes.

### Acceptance check

Demo v2 identifies one added script, one modified script, and one Content-Security-Policy change.

## Day 5 — Human approval workflow and report

### Work

- Read `src/approvals.js` and `src/report.js`.
- Inspect `examples/demo-approvals.json`.
- Confirm the two known scripts are marked approved.
- Confirm the newly added script is marked unapproved.
- Open the generated HTML report in a browser.

### Understand

- The system must never approve a script automatically merely because it exists in the baseline.
- Every approval needs an owner, business purpose, approver, approval date, and optional expiry date.
- Approval and integrity are different: an approved script can still change and require review.

### Acceptance check

The report clearly separates approved scripts, unapproved scripts, and modified approved scripts.

## Day 6 — Test failure and edge cases

### Work

- Run all automated tests.
- Temporarily expire one local approval and verify it becomes unapproved.
- Temporarily remove a script and verify removal is detected.
- Test a page with no scripts.
- Test an invalid URL and missing authorization.

### Understand

- A useful compliance control must fail safely.
- Missing evidence is not the same as evidence of safety.
- Runtime or network errors must be visible, not silently treated as success.

### Acceptance check

All tests pass, invalid configurations are rejected, and evidence gaps appear as warnings or review conditions.

## Day 7 — Prepare the controlled demonstration

### Work

- Run the complete v1 baseline → v1 PASS → v2 REVIEW sequence.
- Save one PASS report and one REVIEW_REQUIRED report.
- Record a 60–90 second screen demonstration.
- Write a one-sentence product explanation:

> The engine records every approved checkout script, detects content or policy changes, and creates an audit-ready evidence trail without touching payment data.

- Prepare a list of technical questions for agencies; do not build the dashboard yet.

### Acceptance check

A technical agency owner can understand the problem, view a detected change, and inspect the evidence report in under two minutes.

## Final go/no-go checklist

Continue to an authorized agency pilot only when every item is true:

- [ ] Authorization is mandatory in configuration and command execution.
- [ ] The engine performs no checkout interaction.
- [ ] Sensitive content is not stored.
- [ ] Baseline evidence is immutable and digest-addressed.
- [ ] Unchanged evidence returns `PASS`.
- [ ] Added, removed, and modified scripts are detected.
- [ ] Security-header changes are detected.
- [ ] Explicit approvals include owner and business purpose.
- [ ] Unapproved scripts produce `REVIEW_REQUIRED`.
- [ ] The report states that it does not certify compliance.
- [ ] All automated tests pass.
- [ ] Browser mode is verified locally before making runtime-coverage claims.

If any item is false, remain in the evidence-engine phase and do not approach a merchant with a paid production claim.
