# v0.4.1 update and functional practice

Prepared: 27 September 2026. This is an unpublished candidate until the release steps are complete.

## Three questions about this update

**Should I update?** Evaluate the corrected v0.4.1 candidate first. Keep the published v0.3.1 release in place until the corrected candidate passes its required CI checks and separate-repository proof. Do not publish the earlier candidate without these checks.

**What was the technical gap?** A checkout could redirect to a login page that has matching scripts and headers. Comparing that evidence alone does not establish that the intended checkout was captured. The corrected scanner checks the expected final origin/path and an optional configured readiness element. A wrong page, unsuccessful HTTP response, missing configured marker or navigation timeout fails the capture. An earlier successful report is not evidence for the failed invocation.

**What does a functional test add?** It performs user actions and checks their expected results. In the owned practice fixture, two notebooks priced at $10 each must total $20. The deliberately broken fixture shows $19. The same test must fail on that incorrect total and pass again on the healthy fixture.

| Check | Question | Example result |
|---|---|---|
| Capture readiness | Did the intended checkout page load? | Unexpected login page → error |
| Passport evidence | Did approved script/header evidence change? | Relevant change → REVIEW_REQUIRED |
| Functional test | Did the agreed user action produce the expected result? | 2 × $10 = $19 → FAIL |

These checks have different scopes. The functional practice does not verify real payment processing, every browser, every checkout or PCI compliance.

## What the candidate includes

- HTTP status and page-identity checks in both capture modes.
- An optional page-ready element: HTML presence in static mode and visibility in browser mode.
- Error exit code 1 even when `--no-fail` is supplied.
- Protection against replacing a reviewed baseline after a failed capture.
- A separate functional demo with the same test for healthy, broken and recovery cases, plus JSON and readable HTML results.
- CI steps that run actual browser verification and preserve practice results.
- Documentation distinguishing unpublished work, evidence coverage and functional practice.

## Run the owned demo locally

Use Node.js 22 LTS and open a terminal in the corrected repository checkout.

```bash
npm ci --ignore-scripts --no-audit --no-fund
npx --no-install playwright install chromium
npm run practice
```

Open `http://127.0.0.1:4180/checkout` in your browser.

1. Click **Add notebook** twice.
2. Confirm that the cart count is **2**.
3. Click **Open checkout**.
4. Confirm that the total is **$20.00**.
5. Click **Create demo order** and check the synthetic confirmation. No real payment is made.
6. Open **Broken total fixture** and repeat the steps. The total is now **$19.00**, an intentional defect.

Press Ctrl+C in the terminal to stop the server.

## Watch the automated test

```bash
npm run practice:watch
```

This command opens a browser, starts and stops its own temporary fixture server, and runs all three cases. Do not start a separate server for this command.

Expected console output:

```text
healthy: PASS; expected PASS; verified.
broken-total: FAIL; expected FAIL; verified.
recovery: PASS; expected PASS; verified.
```

The broken case must fail specifically at the **Checkout total** assertion, with expected $20 and actual $19. A browser crash or unrelated error does not count as successful verification of the negative case.

For headless verification:

```bash
npm run practice:proof
```

To run only the broken fixture as a normal test:

```bash
npm run practice:broken
```

This command must exit with code **1**. Do not change the expected value to $19 to obtain a passing result. The requirement is $20; the test should catch the implementation error.

Reports are written to `evidence/functional-practice/<run-time>/report.html`. Screenshots contain only the synthetic practice page.

## Understand three parts of the test

**Locator:** identifies the button or element.

```js
page.getByRole("button", { name: "Add notebook", exact: true })
```

**Action:** performs an operation on that element.

```js
await page.getByRole("button", { name: "Add notebook", exact: true }).click();
```

**Assertion:** checks an independently specified expected result.

```js
await checkText(page, "total", "$20.00", "Checkout total");
```

The `checkText` helper compares actual text with the expected text and throws `FunctionalCheckFailed` when they differ. The flow is in `examples/functional-practice/flow.mjs`, the page is in `examples/functional-practice/checkout.html`, and the runner is in `scripts/verify-functional-demo.mjs`.

## A short practice exercise

Explain these three points before adapting the example:

1. Why must two notebooks total $20?
2. Why should the test fail when it sees $19?
3. Why does a script-evidence PASS not prove that payment succeeds?

Then change the exercise to three notebooks and an expected total of $30. Derive the expected value from the requirement, not from whatever the page currently displays.

## Troubleshooting

| Message | Meaning | Next action |
|---|---|---|
| Executable doesn't exist | Matching Chromium is not installed | Run `npx --no-install playwright install chromium` |
| CAPTURE_WRONG_PAGE | Unexpected redirect or wrong page configuration | Review the expected URL and session/cart state |
| CAPTURE_MARKER_MISSING | The configured checkout-ready element was not found | Choose a meaningful marker; do not disable the check just to obtain PASS |
| CAPTURE_HTTP_ERROR | The document response was unsuccessful | Investigate the site/server response |
| CAPTURE_NAVIGATION_FAILED | Navigation failed or timed out | Check the network, fixture server, navigation permissions and timeout |
| Checkout total expected $20, received $19 | The functional test caught an incorrect total | Expected in this practice; record a reproducible defect in an authorised client test |

When requesting help, share the command and a non-sensitive error message. Do not share credentials, tokens, card details or customer screenshots.

## Release checklist for maintainers

1. Review and commit the corrected candidate; keep v0.4.1 unpublished.
2. Push the candidate and prepare its pull request. Inspect Product proof, CodeQL and dependency review.
3. Resolve CI failures before merging. Do not bypass failed checks to accelerate a release.
4. Verify the separate consumer workflow against the exact reviewed Action SHA. A release tag is not required to test a pushed candidate commit.
5. Publish only after the agreed review and verification are complete. If the released commit differs, update the consumer pin and reverify that revision. Verify release-integrity artifacts.
6. Align public release links and website claims with the actual published state. The corrected consumer branch preserves the existing website rather than including the earlier vendor-pilot website draft.
7. Keep the earlier LinkedIn video labelled as historical v0.3.1 creator-maintained evidence. Do not describe it as new functional or customer proof.

Connect accounts through the official sign-in flow. Never place credentials in a chat, configuration file or repository. Review which repositories and actions the integration can access.

## Delivery boundary

This update fixes a capture gap and provides a functional delivery rehearsal. It does not prove buyer demand. A first functional engagement should have one authorised simple flow, one repository, written expected results and agreed acceptance criteria. The practice runner intentionally accepts only its own loopback fixture; a real client workflow requires separate authorisation and implementation.

Do not describe the practice as an existing third-party integration, customer deployment or real payment test.
