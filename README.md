# Checkout Release Passport

[![Product proof](https://github.com/Muhammad-Zonain/checkout-release-passport/actions/workflows/proof.yml/badge.svg)](https://github.com/Muhammad-Zonain/checkout-release-passport/actions/workflows/proof.yml)
[![GitHub Marketplace](https://img.shields.io/badge/GitHub%20Marketplace-Checkout%20Release%20Passport-2ea44f?logo=github)](https://github.com/marketplace/actions/checkout-release-passport)
[![Latest release](https://img.shields.io/github/v/release/Muhammad-Zonain/checkout-release-passport)](https://github.com/Muhammad-Zonain/checkout-release-passport/releases/latest)
[![License](https://img.shields.io/github/license/Muhammad-Zonain/checkout-release-passport)](LICENSE)

> A local-first checkout release evidence gate for ecommerce agencies.

Software bills of materials describe code and packages. They do not necessarily record what a browser actually received at checkout, which security-impacting headers changed, who approved the change, or whether a release should stop.

Checkout Release Passport creates that per-release record for an **authorized** staging checkout.

## What a passport contains

- Browser-observed external and inline script identifiers.
- SHA-256 fingerprints without retaining script source bodies.
- Selected security-impacting HTTP headers.
- Comparison with an approved baseline.
- Human approval status and documented justification.
- GitHub repository, commit, workflow and run provenance when used in CI.
- `PASS` or `REVIEW_REQUIRED` release decision.
- JSON passport, JSON comparison and a readable HTML report.

## What it does not claim

This project is not PCI DSS certification, a QSA assessment, a penetration test, a legal opinion, complete attack prevention, or a replacement for appropriately scoped continuous production monitoring.

It never authorizes itself. The operator must own the target or hold explicit written authorization.

## GitHub Action

Add a target configuration to the caller repository, then use:

```yaml
- name: Create checkout release passport
  uses: Muhammad-Zonain/checkout-release-passport@v0.3.0
  with:
    operation: check
    config_path: .checkout-evidence/staging.json
    ack_authorized: "true"
    install_browser: "true"
    fail_on_review: "true"
```

The Action uploads the passport, comparison and HTML report before enforcing the gate. A review-required result therefore preserves evidence even when the job fails.

Eligible GitHub repositories can optionally apply GitHub's Sigstore-backed artifact attestation to the generated passport. This links the artifact to its repository, workflow and commit so a recipient can verify its provenance with the GitHub CLI. See [`examples/github-workflow-attested.yml`](examples/github-workflow-attested.yml). A provenance attestation still does not certify that the checkout is secure or compliant.

See [`examples/github-workflow.yml`](examples/github-workflow.yml) for a complete workflow.

### One-time baseline onboarding

Every check intentionally requires a previously reviewed baseline. To create one without cloning this repository:

1. Copy [`examples/github-baseline-workflow.yml`](examples/github-baseline-workflow.yml) into the caller repository.
2. Run that workflow manually against a checkout you own or are explicitly authorized to inspect.
3. Download the baseline artifact.
4. Review `baseline.json` and every entry in `approval-template.json`.
5. Commit the reviewed baseline at `<output_dir>/<target_id>/baseline.json`, and save the completed approvals document at the configured `approvals_file` path.
6. Enable the regular check workflow.

Never regenerate the baseline automatically before every check; doing so would erase the comparison point the gate is designed to protect.

`output_dir` and `approvals_file` are resolved relative to the configuration file. Baseline creation refuses to overwrite an existing baseline unless `force_baseline: "true"` is deliberately supplied for an approved reset.

Scanner-version or capture-mode changes produce `REVIEW_REQUIRED`. Existing pre-`v0.3.0` baselines should therefore be recreated and reviewed once before normal checks resume.

## Local quick start

Requirements: Node.js 20 or later.

```bash
npm ci
npm test
```

For browser mode, install Chromium once:

```bash
npx playwright install chromium
```

Run only against an owned or explicitly authorized target:

```bash
node src/cli.js baseline --config path/to/target.json --ack-authorized
node src/cli.js check --config path/to/target.json --ack-authorized
node src/cli.js verify-passport --file path/to/generated.passport.json
```

Exit codes:

- `0`: `PASS`
- `2`: `REVIEW_REQUIRED`
- `1`: configuration or runtime error

## Safe local proof

The repository includes a harmless local checkout fixture:

```bash
npm run verify:passport
```

That command starts the owned fixture, produces a PASS passport with synthetic GitHub provenance, verifies the generated artifact and stops the fixture.

## Configuration

```json
{
  "target_id": "agency-staging-checkout",
  "name": "Agency Staging Checkout",
  "url": "https://staging.example.test/checkout",
  "output_dir": "../evidence",
  "approvals_file": "approvals.json",
  "authorization": {
    "confirmed": true,
    "confirmed_by": "Named environment owner",
    "confirmed_at": "2026-07-19",
    "scope_note": "Written authorization covers this staging checkout and passive browser observation",
    "reference": "CHANGE-1234"
  },
  "scan": {
    "mode": "browser",
    "wait_until": "networkidle",
    "timeout_ms": 30000,
    "post_load_wait_ms": 1000
  }
}
```

The CLI additionally requires `--ack-authorized`. The GitHub Action additionally requires `ack_authorized: "true"`. These controls are deliberate; neither replaces the operator's obligation to hold real permission.

## Privacy boundaries

The evidence format intentionally excludes:

- cardholder data;
- form values and checkout submissions;
- passwords and account credentials;
- cookies;
- URL query values;
- complete response bodies;
- complete inline or external script source bodies.

See [`docs/SECURITY_AND_SCOPE.md`](docs/SECURITY_AND_SCOPE.md) for the full boundary.

## Why this is different

The initial wedge is not another broad production monitoring dashboard. It is a release artifact that can live beside the pull request, deployment record and client handoff:

`checkout change → browser observation → baseline comparison → named approval → release passport`

The open Action is the distribution layer. Future paid agency capabilities, if validated, may include multi-client policy templates, signed passport history, delegated approval, retention controls and managed onboarding.

## Maintainer

**Muhammad Zonain**  
MSc Computer Systems Engineering  
GitHub: [@Muhammad-Zonain](https://github.com/Muhammad-Zonain)

For support, please use this repository's Issues tab.
