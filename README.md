# Checkout Release Passport

[![Product proof](https://github.com/Muhammad-Zonain/checkout-release-passport/actions/workflows/proof.yml/badge.svg)](https://github.com/Muhammad-Zonain/checkout-release-passport/actions/workflows/proof.yml)
[![GitHub Marketplace](https://img.shields.io/badge/GitHub%20Marketplace-Checkout%20Release%20Passport-2ea44f?logo=github)](https://github.com/marketplace/actions/checkout-release-passport)
[![Latest release](https://img.shields.io/github/v/release/Muhammad-Zonain/checkout-release-passport)](https://github.com/Muhammad-Zonain/checkout-release-passport/releases/latest)
[![License](https://img.shields.io/github/license/Muhammad-Zonain/checkout-release-passport)](LICENSE)

**GitHub-native checkout release evidence for safer ecommerce deployments.**

[Product Website](https://muhammad-zonain.github.io/checkout-release-passport-consumer-proof/) ·
[GitHub Marketplace](https://github.com/marketplace/actions/checkout-release-passport) ·
[Separate-Repository Installation Proof — Static Demo](https://github.com/Muhammad-Zonain/checkout-release-passport-consumer-proof)

> A local-first checkout release evidence gate for ecommerce agencies and merchant-controlled checkout teams.

Software bills of materials and source-code diffs describe code and package changes. They do not necessarily record what a browser actually received at checkout, which selected security-impacting headers changed, who reviewed the change, or whether a release requires human attention.

Checkout Release Passport creates a per-release evidence record for a checkout that the operator owns or is explicitly authorized to inspect.

## What the product does

Checkout Release Passport can:

- observe external and inline scripts received by the checkout;
- create SHA-256 fingerprints without retaining complete script source bodies;
- retain selected security-impacting HTTP headers;
- compare a current observation with a previously reviewed baseline;
- evaluate documented approvals and justifications;
- record GitHub repository, commit, workflow, run, and Action provenance;
- return `PASS` or `REVIEW_REQUIRED`;
- export a JSON passport, JSON comparison, immutable snapshot, and readable HTML report;
- upload evidence before enforcing a review-required GitHub Actions gate.

## Release decisions

### `PASS`

The current observation matches the reviewed baseline and required approval records.

### `REVIEW_REQUIRED`

A relevant script, fingerprint, selected header, capture mode, scanner version, approval, or justification differs from the reviewed baseline.

`REVIEW_REQUIRED` does not automatically mean that a release is malicious or insecure. It means a documented human review is required before the release proceeds.

## What the product does not claim

Checkout Release Passport is an evidence collector and release-control tool.

It is not:

- PCI DSS certification;
- a QSA assessment;
- a penetration test;
- a vulnerability scanner;
- legal advice;
- complete attack prevention;
- customer validation;
- an independent audit;
- a replacement for appropriately scoped continuous production monitoring.

The tool never authorizes itself. The operator must own the target or hold explicit written authorization.

````markdown
## GitHub Action quick start

Add an authorized target configuration to the caller repository.

### Convenient versioned reference

This form is easy to read and follows the published `v0.3.0` release:

```yaml
- name: Create checkout release passport
  uses: Muhammad-Zonain/checkout-release-passport@008bd7a28e42c556069868a05b0d723f77f162e5 # v0.3.0
  with:
    operation: check
    config_path: .checkout-evidence/staging.json
    ack_authorized: "true"
    install_browser: "true"
    fail_on_review: "true"
```

The Action uploads the generated evidence before enforcing a `REVIEW_REQUIRED` gate. This preserves the evidence even when the workflow job subsequently fails.

See [`examples/github-workflow.yml`](examples/github-workflow.yml) for a complete check workflow.

## One-time baseline onboarding

Every normal check requires a previously reviewed baseline.

To create the initial baseline from a caller repository:

1. Copy [`examples/github-baseline-workflow.yml`](examples/github-baseline-workflow.yml) into the caller repository.
2. Add the authorized target configuration.
3. Run the baseline workflow manually.
4. Download the generated baseline onboarding artifact.
5. Review the observed scripts, selected headers, and generated approval template.
6. Complete the approval and justification records.
7. Commit the reviewed baseline to:

   ```text
   <output_dir>/<target_id>/baseline.json
   ```

8. Save the completed approvals file at the configured `approvals_file` path.
9. Enable the normal check workflow.

````markdown
Example baseline Action step using immutable production pinning:

```yaml
- name: Create baseline onboarding artifact
  uses: Muhammad-Zonain/checkout-release-passport@008bd7a28e42c556069868a05b0d723f77f162e5 # v0.3.0
  with:
    operation: baseline
    config_path: .checkout-evidence/staging.json
    ack_authorized: "true"
    install_browser: "true"
```

Do not regenerate the baseline automatically before every check. Doing so would erase the comparison point that the release gate is designed to protect.

Baseline creation refuses to overwrite an existing baseline unless an explicit reviewed reset uses:

```yaml
force_baseline: "true"
```

Scanner-version or capture-mode changes intentionally produce `REVIEW_REQUIRED`.

## Action inputs

| Input | Required | Default | Purpose |
|---|---:|---:|---|
| `operation` | No | `check` | Use `baseline` during explicit onboarding or `check` for a normal comparison. |
| `config_path` | Yes | — | Path to the authorized target configuration in the caller repository. |
| `ack_authorized` | Yes | — | Must be exactly `"true"` only for a target the operator owns or is explicitly authorized to inspect. |
| `install_browser` | No | `"true"` | Installs Playwright Chromium for browser-mode configurations. |
| `fail_on_review` | No | `"true"` | Fails the job after evidence upload when the decision is `REVIEW_REQUIRED`. |
| `force_baseline` | No | `"false"` | Allows an explicitly reviewed replacement of an existing baseline. |
| `artifact_suffix` | No | `default` | Provides a safe unique suffix when an operation runs more than once in one job. |

## Action outputs

Depending on the selected operation, the Action exposes:

- `status`
- `target_id`
- `snapshot_path`
- `baseline_path`
- `approval_template_path`
- `passport_id`
- `passport_path`
- `report_path`
- `comparison_path`
- `passport_sha256`

Possible `status` values are:

```text
BASELINE_CREATED
PASS
REVIEW_REQUIRED
```

## Example target configuration

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

The CLI additionally requires:

```text
--ack-authorized
```

The GitHub Action additionally requires:

```yaml
ack_authorized: "true"
```

These controls are deliberate, but neither replaces the operator's obligation to hold real authorization.

## Local quick start

Requirements:

```text
Node.js 20 or later
```

Install dependencies and run the tests:

```bash
npm ci
npm test
```

For browser capture mode, install Chromium once:

```bash
npx playwright install chromium
```

Run only against a target that you own or are explicitly authorized to inspect:

```bash
node src/cli.js baseline --config path/to/target.json --ack-authorized
node src/cli.js check --config path/to/target.json --ack-authorized
node src/cli.js verify-passport --file path/to/generated.passport.json
```

CLI exit codes:

| Exit code | Meaning |
|---:|---|
| `0` | `PASS` |
| `2` | `REVIEW_REQUIRED` |
| `1` | Configuration or runtime error |

## Safe local proof

This repository includes a harmless, repository-owned local fixture.

Run:

```bash
npm run verify:passport
```

The command starts the local fixture, generates a `PASS` passport with synthetic GitHub provenance, verifies the resulting artifact, and then stops the fixture.

## Evidence and privacy boundaries

The evidence format intentionally excludes:

- cardholder data;
- payment form submissions;
- form values;
- passwords and account credentials;
- cookies;
- URL query values;
- complete response bodies;
- complete inline-script bodies;
- complete external-script source bodies.

Script content is fingerprinted rather than retained as complete source. Only selected security-impacting headers are preserved.

The tool must not be used to:

- inspect a checkout without authorization;
- fill or submit checkout forms;
- enter real or test card data;
- attempt purchases;
- attempt authentication bypasses;
- perform exploitation, fuzzing, or load testing;
- collect customer or cardholder data.

See [`docs/SECURITY_AND_SCOPE.md`](docs/SECURITY_AND_SCOPE.md) for the complete security and scope rules.

## GitHub artifact provenance

Eligible GitHub repositories may optionally apply GitHub's Sigstore-backed artifact attestation to a generated passport.

See:

[`examples/github-workflow-attested.yml`](examples/github-workflow-attested.yml)

Artifact provenance can help connect an artifact with its repository, workflow, and commit. It does not certify that the observed checkout is secure or compliant.

## Separate-repository static demo

The following repository demonstrates that the released public Action can be called from a separate GitHub repository in static capture mode:

[Separate-Repository Installation Proof — Static Demo](https://github.com/Muhammad-Zonain/checkout-release-passport-consumer-proof)

That repository is maintained by the creator of Checkout Release Passport.

It demonstrates cross-repository installation and a static-mode fixture acceptance sequence. It is not:

- an independent audit;
- external customer validation;
- certification;
- a third-party endorsement;
- a browser-mode acceptance demo.

The repository must not be described as a browser acceptance demo until a browser-mode workflow has completed successfully.

## Why this is different

Checkout Release Passport is not positioned as another broad production monitoring dashboard.

It creates a release artifact that can live beside the pull request, deployment record, approval record, and client handoff:

```text
checkout change
→ browser observation
→ reviewed baseline comparison
→ named approval
→ release passport
```

The public Action is free to self-install.

Paid implementation services, when requested, cover configuration, baseline review, controlled acceptance testing, evidence verification, handover, and setup support.

## Documentation and examples

- [`docs/SECURITY_AND_SCOPE.md`](docs/SECURITY_AND_SCOPE.md)
- [`examples/github-workflow.yml`](examples/github-workflow.yml)
- [`examples/github-baseline-workflow.yml`](examples/github-baseline-workflow.yml)
- [`examples/github-workflow-attested.yml`](examples/github-workflow-attested.yml)
- [`schemas`](schemas)
- [`CHANGELOG.md`](CHANGELOG.md)

## Support and private fit checks

For public product questions, bug reports, or documentation feedback, use this repository's Issues tab.

For a private fit check:

```text
hello@transferverity.com
```

Send only non-sensitive architecture details.

Do not send credentials, secrets, private URLs, customer data, card data, cookies, or private repository content.

## Maintainer

**Muhammad Zonain**

MSc Computer Systems Engineering

GitHub: [@Muhammad-Zonain](https://github.com/Muhammad-Zonain)

Product website:

[https://muhammad-zonain.github.io/checkout-release-passport-consumer-proof/](https://muhammad-zonain.github.io/checkout-release-passport-consumer-proof/)

## License

Licensed under the [Apache License 2.0](LICENSE).
