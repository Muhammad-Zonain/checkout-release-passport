# Checkout Release Passport

[![Product proof](https://github.com/Muhammad-Zonain/checkout-release-passport/actions/workflows/proof.yml/badge.svg)](https://github.com/Muhammad-Zonain/checkout-release-passport/actions/workflows/proof.yml)
[![CodeQL](https://github.com/Muhammad-Zonain/checkout-release-passport/actions/workflows/codeql.yml/badge.svg)](https://github.com/Muhammad-Zonain/checkout-release-passport/actions/workflows/codeql.yml)
[![GitHub Marketplace](https://img.shields.io/badge/GitHub%20Marketplace-Checkout%20Release%20Passport-2ea44f?logo=github)](https://github.com/marketplace/actions/checkout-release-passport)
[![Latest release](https://img.shields.io/github/v/release/Muhammad-Zonain/checkout-release-passport)](https://github.com/Muhammad-Zonain/checkout-release-passport/releases/latest)
[![License](https://img.shields.io/github/license/Muhammad-Zonain/checkout-release-passport)](LICENSE)

**Repository-owned script/header evidence for an authorised checkout, with explicit page-readiness checks and a separate functional practice example.**

[Product website](https://checkout.transferverity.com) ·
[GitHub Marketplace](https://github.com/marketplace/actions/checkout-release-passport) ·
[Creator-maintained consumer proof](https://github.com/Muhammad-Zonain/checkout-release-passport-consumer-proof) ·
[Start here: update and practice](docs/START_HERE.md)

## Release status and scope

This branch prepares **v0.4.1; it is not yet a published release**. It adds operational evidence, privacy hardening and capture-readiness checks. The latest public release verified on 27 September 2026 was v0.3.1. Publish v0.4.1 only after the candidate's required CI and separate-repository browser proof pass.

The Action itself captures script/header evidence; it does not click through a cart or make payments. The separate owned practice fixture demonstrates a functional test: add two notebooks, verify a $20 total, and create a synthetic confirmation. Its deliberately broken $19 total must fail the same test. It is training evidence, not a customer checkout integration.

**No third-party vendor adapter, vendor endorsement, customer deployment, PCI certification, or independent validation is currently claimed.** A vendor-specific adapter will be built only with the vendor's written participation, official interface documentation, authorized sandbox or durable export, fixed acceptance criteria, and a commercial path.

The Action observes an explicitly authorized checkout, compares the result with a reviewed baseline, and retains redacted release evidence inside the caller's GitHub workflow. Vendor integration remains an optional, unvalidated commercial hypothesis, not a prerequisite for this engine or a promised source of paid work.

## What exists today

The Action can:

- reject unsuccessful HTTP documents and unexpected final origins/paths before baseline creation or comparison;
- optionally require a named HTML readiness marker (present in static HTML, visible in browser mode);

- observe external and inline scripts received by an authorized checkout;
- create SHA-256 fingerprints without retaining complete script source bodies;
- retain selected security-impacting HTTP headers;
- compare the current observation with a reviewed baseline;
- evaluate documented script owners, approvals, business purposes, integrity methods, and expiry dates;
- distinguish observed fingerprints, declared SRI, and integrity-evidence gaps;
- bind evidence to GitHub repository, commit, workflow, run, and Action provenance;
- return `PASS` or `REVIEW_REQUIRED`;
- rank workflow urgency as `P1`, `P2`, `P3`, or `NONE` without calling it vulnerability severity;
- export JSON evidence and a readable HTML report;
- run after a release or on a schedule;
- optionally open/update one deduplicated GitHub review issue and resolve it after recovery; and
- upload evidence before enforcing a review-required release gate.

## Partner integration objective

For a participating vendor, the intended responsibility split is:

| Layer | Responsibility |
|---|---|
| Payment-page security vendor | Runtime observation, security event, or durable evidence export from its own product |
| Checkout Release Passport | Minimized normalization, reviewed-baseline decision, GitHub provenance, evidence artifact, and review lifecycle |
| Vendor/customer | Authorization, credential custody, acceptance criteria, investigation, compliance decisions, and operational response |

Target lifecycle:

```text
vendor evidence
-> authenticated and freshness-checked
-> minimized normalization
-> approved-baseline comparison
-> PASS or REVIEW_REQUIRED
-> repository-owned JSON/HTML evidence
-> recovery PASS
```

The exact adapter, authentication, event mapping, replay handling, and outage behavior are deliberately not guessed in this repository. They are defined and tested against the participating vendor's official interface during the paid pilot.

See [`docs/PARTNER_INTEGRATION_PILOT.md`](docs/PARTNER_INTEGRATION_PILOT.md).

## Evidence coverage

| Control objective | Current engine evidence |
|---|---|
| Script inventory | Browser-observed external and inline scripts, party, source, attributes, and fingerprints |
| Authorization and necessity | Named owner, approver, approval date, expiry, and written business purpose |
| Integrity evidence | Observed SHA-256 fingerprint and declared SRI status; missing evidence becomes a review finding |
| Change detection | Added, removed, or modified scripts; selected security-header drift; new network origins |
| Actionability | P1/P2/P3 findings, GitHub summary, optional issue lifecycle, and retained evidence |
| Cadence | Configured expected interval plus GitHub Actions run history; configuration alone is never treated as proof that a run occurred |

This supports technical evidence for script-management and change-detection objectives. It does not determine PCI DSS applicability, implementation sufficiency, or compliance.

## Decision meanings

### `PASS`

The current observation matches the reviewed baseline and the configured approval requirements. It means only that the configured check passed at that time.

### `REVIEW_REQUIRED`

A relevant script, fingerprint, selected header, network origin, capture mode, engine version, approval, justification, expiry, or integrity-evidence status needs documented human review.

`REVIEW_REQUIRED` does not automatically mean malicious code, a vulnerability, or compromise. `P1`, `P2`, and `P3` rank workflow urgency only.

## Claims the product does not make

Checkout Release Passport is not:

- PCI DSS certification or a QSA assessment;
- a penetration test or vulnerability scanner;
- legal advice;
- complete attack prevention or incident response;
- real-user-session monitoring or attack blocking;
- proof that every dynamic, geographic, consent-dependent, authenticated, or attacker-evasion path was observed;
- an independent audit or third-party endorsement; or
- customer or buyer validation.

The tool never authorizes itself. The operator must own the target or hold explicit written authorization.

## GitHub Action quick start

After the `v0.4.1` release is published and its release-integrity workflow passes, an evaluation can use the readable tag:

```yaml
- name: Create checkout release passport
  uses: Muhammad-Zonain/checkout-release-passport@v0.4.1
  with:
    operation: check
    config_path: .checkout-evidence/staging.json
    ack_authorized: "true"
    install_browser: "true"
    fail_on_review: "true"
```

For production, replace `v0.4.1` with the full 40-character commit SHA from the reviewed release. A full SHA prevents the selected Action revision from moving without an explicit workflow update.

The Action pins its own nested Actions to reviewed full commit SHAs. See [`docs/SUPPLY_CHAIN_SECURITY.md`](docs/SUPPLY_CHAIN_SECURITY.md) for npm, browser-download, SBOM, attestation, and update boundaries.

## One-time baseline onboarding

Every normal check requires a reviewed baseline.

1. Copy [`examples/github-baseline-workflow.yml`](examples/github-baseline-workflow.yml) into the caller repository.
2. Add an authorized target configuration.
3. Run the baseline workflow manually.
4. Download the generated baseline onboarding artifact.
5. Review every observed script and selected header.
6. Complete the generated approval register.
7. Commit only the reviewed `baseline.json` and approvals file.
8. Enable the normal check or monitoring workflow.

Do not regenerate the baseline before each check. That would erase the comparison point. Replacing an existing baseline requires an explicit reviewed reset with `force_baseline: "true"`.

## Capture readiness: configure this before a customer deployment

```json
"capture_expectations": {
  "expected_final_url": "https://staging.example.test/checkout",
  "ready_element_id": "checkout-ready"
}
```

Use a stable element id that identifies the actual checkout, not a shared header or login page. A marker that means cart/session readiness should only appear after that state is ready. Browser mode waits for visibility; static mode checks only presence in received HTML. Neither proves functional correctness.

Without explicit expectations, the final origin/path must equal the configured target URL (query values and fragments excluded); the marker check is labelled `NOT_CONFIGURED`. An intentional redirect must be declared with an authorised expected final URL. Missing markers, navigation timeouts and unacceptable HTTP statuses exit with code **1**, produce no new PASS/recovery decision, and do not reset the baseline. `--no-fail` suppresses a review gate only; it cannot suppress a capture error. Existing review issues are not resolved after a failed capture.

Adding or changing the readiness policy causes `REVIEW_REQUIRED` against an older baseline. Review and deliberately approve the new baseline; do not weaken the marker to obtain a green run.

## Scheduled monitoring and repository issues

Copy [`examples/github-monitoring-workflow.yml`](examples/github-monitoring-workflow.yml). The example grants only:

```yaml
permissions:
  contents: read
  issues: write
```

When `alert_mode: github-issue` is enabled, `REVIEW_REQUIRED` creates or updates one target-specific issue. A later `PASS` adds recovery evidence and closes the matching issue. The caller's token is never written to evidence or logs.

## Inputs

| Input | Required | Default | Purpose |
|---|---:|---:|---|
| `operation` | No | `check` | `baseline` for explicit onboarding or `check` for comparison |
| `config_path` | Yes | — | Authorized target configuration in the caller repository |
| `ack_authorized` | Yes | — | Must be exactly `"true"` only for a target the operator may inspect |
| `install_browser` | No | `"true"` | Install matching Playwright Chromium for browser mode |
| `fail_on_review` | No | `"true"` | Fail after evidence upload on `REVIEW_REQUIRED` |
| `force_baseline` | No | `"false"` | Permit an explicitly reviewed baseline replacement |
| `artifact_suffix` | No | `default` | Safe unique suffix for repeated operations in one job |
| `alert_mode` | No | `none` | `github-issue` for issue lifecycle or `none` for artifacts only |
| `github_token` | Conditional | empty | Required only for `github-issue`; pass `${{ github.token }}` with `issues: write` |
| `retention_days` | No | `90` | Evidence retention from 1 to 90 days |

## Outputs

Depending on the operation, the Action exposes:

- `status`, `target_id`, and `review_priority`;
- `snapshot_path`, `baseline_path`, and `approval_template_path`;
- `passport_id`, `passport_path`, and `passport_sha256`;
- `report_path` and `comparison_path`; and
- `monitoring_event_path` and `alert_path`.

Possible status values are `BASELINE_CREATED`, `PASS`, and `REVIEW_REQUIRED`.

## Example target configuration

```json
{
  "target_id": "authorized-staging-checkout",
  "name": "Authorized Staging Checkout",
  "url": "https://staging.example.test/checkout",
  "output_dir": "../evidence",
  "approvals_file": "approvals.json",
  "authorization": {
    "confirmed": true,
    "confirmed_by": "Named environment owner",
    "confirmed_at": "2026-08-15",
    "scope_note": "Written authorization covers this staging checkout and passive browser observation",
    "reference": "CHANGE-1234",
    "allowed_navigation_origins": ["https://staging.example.test"]
  },
  "scan": {
    "mode": "browser",
    "wait_until": "networkidle",
    "timeout_ms": 30000,
    "post_load_wait_ms": 1000
  },
  "monitoring": {
    "expected_interval_hours": 24,
    "review_owner": "Ecommerce Engineering",
    "response_target_hours": 4
  }
}
```

The CLI also requires `--ack-authorized`. Neither acknowledgement replaces the operator's obligation to hold real authorization.

## Local verification

Requirements: Node.js 20 or later.

```bash
npm ci
node --test
bash scripts/verify-passport-demo.sh
```

Browser mode needs the matching Chromium runtime:

```bash
npx --no-install playwright install chromium
```

Then verify browser errors and the separate functional exercise:

```bash
npm run test:browser
npm run practice:proof
```

`npm run practice:watch` runs the owned exercise visibly on a desktop. `npm run practice:broken` must exit with code 1 because the total is wrong. `npm run practice` opens the manual exercise at `http://127.0.0.1:4180/checkout`. Full explanation: [update and practice guide](docs/START_HERE.md).

The local repository-owned fixture proves:

```text
PASS -> P1 REVIEW_REQUIRED -> rollback PASS
```

It verifies passport, monitoring-event, prioritized-finding, and alert-lifecycle digests without contacting GitHub or any external checkout.

## Evidence and privacy boundary

Stored evidence intentionally excludes:

- cardholder data and payment form submissions;
- form values, passwords, credentials, cookies, and `set-cookie`;
- URL query values and CSP nonce values, including through query-dependent URL hashes;
- complete response bodies;
- complete inline-script bodies; and
- complete external-script source bodies.

Script bodies are hashed in memory and discarded. Stored URL query parameter names remain visible, but values are replaced before the URL fingerprint is created. This means query-value-only URL changes are deliberately not evidence; downloaded script-byte changes remain observable through the script content fingerprint.

Only selected security-impacting headers are retained. See [`docs/SECURITY_AND_SCOPE.md`](docs/SECURITY_AND_SCOPE.md) and [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md).

## Data flow and telemetry

Checkout Release Passport has no maintainer-operated account, analytics endpoint, evidence service, or telemetry callback.

Generated evidence stays in the caller's local or GitHub Actions workspace and artifacts unless the caller deliberately exports it. The Action does not send checkout evidence to TransferVerity.

The configured checkout can load its normal third-party resources. Those requests remain subject to the checkout operator's architecture, providers, policy, and authorization.

## Creator-maintained consumer proof

The separate repository demonstrates that a released public Action can run from another GitHub repository in browser mode:

[checkout-release-passport-consumer-proof](https://github.com/Muhammad-Zonain/checkout-release-passport-consumer-proof)

It demonstrates unchanged `PASS`, controlled `REVIEW_REQUIRED`, and recovery `PASS`. It is maintained by the same creator and is not independent customer validation, an audit, certification, or third-party endorsement.

## Documentation

- [`docs/PARTNER_INTEGRATION_PILOT.md`](docs/PARTNER_INTEGRATION_PILOT.md)
- [`docs/SECURITY_AND_SCOPE.md`](docs/SECURITY_AND_SCOPE.md)
- [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md)
- [`docs/SUPPLY_CHAIN_SECURITY.md`](docs/SUPPLY_CHAIN_SECURITY.md)
- [`docs/OPERATIONAL_MONITORING.md`](docs/OPERATIONAL_MONITORING.md)
- [`docs/V0.4.1_RELEASE_NOTES.md`](docs/V0.4.1_RELEASE_NOTES.md)
- [`SECURITY.md`](SECURITY.md)
- [`SUPPORT.md`](SUPPORT.md)
- [`CHANGELOG.md`](CHANGELOG.md)

## Support and partner enquiries

Use GitHub Issues for non-sensitive bugs, product questions, feature requests, and documentation corrections.

For a vendor integration discussion, email:

[hello@transferverity.com](mailto:hello@transferverity.com?subject=Vendor%20GitHub%20Evidence%20Integration)

For a suspected vulnerability, do not open a public issue. Follow [`SECURITY.md`](SECURITY.md).

Never send credentials, tokens, secrets, private URLs, customer data, card data, cookies, or private repository content.

## Maintainer

**Muhammad Zonain**

MSc Computer Systems Engineering

GitHub: [@Muhammad-Zonain](https://github.com/Muhammad-Zonain)

LinkedIn: [Muhammad Zonain](https://www.linkedin.com/in/muhammad-zonain-4ab27558/)

Website: [checkout.transferverity.com](https://checkout.transferverity.com)

## License

Licensed under the [Apache License 2.0](LICENSE).
