# Checkout Release Passport — Separate-Repository Installation Proof — Static Demo

[![Separate-repository static demo](https://github.com/Muhammad-Zonain/checkout-release-passport-consumer-proof/actions/workflows/consumer-proof.yml/badge.svg)](https://github.com/Muhammad-Zonain/checkout-release-passport-consumer-proof/actions/workflows/consumer-proof.yml)

This repository is maintained by the creator of Checkout Release Passport.

It demonstrates that a separate caller repository can resolve and run the public Action release referenced by the GitHub Marketplace listing:

```yaml
uses: Muhammad-Zonain/checkout-release-passport@v0.3.0
```

The current workflow uses a harmless, repository-owned checkout fixture in **static capture mode**. It invokes the released Action and requires a `PASS` result.

It does not collect payment data, submit a checkout form, or contact a third-party checkout.

## What a green run demonstrates

- GitHub can resolve the public `v0.3.0` Action tag.
- The released Action can run from a separate caller repository.
- The Action can create a one-time onboarding baseline in the caller repository.
- The Action installs its required Node.js dependencies in the caller repository.
- The caller repository's approved baseline can be compared with a current static observation.
- The Action returns `PASS`.
- The workflow uploads the generated passport, comparison, snapshot, and HTML report.
- The repository's verification script recomputes the passport digest and checks caller and Action provenance.

## Current scope

This is a **static-mode installation demo**.

The current configuration uses:

```json
{
  "mode": "static"
}
```

The workflow uses:

```yaml
install_browser: "false"
```

It must not be described as a browser acceptance demo until a browser-mode workflow has completed successfully.

## Run it

Open:

**Actions → Separate-repository installation proof — static demo → Run workflow**

The expected result is a green workflow run containing:

```text
Decision: PASS
Capture mode: Static
```

## Disclosure

This repository is maintained by the creator of Checkout Release Passport.

It demonstrates cross-repository installation and a static-mode fixture acceptance sequence.

It is not an independent audit, external customer validation, certification, or third-party endorsement.

This repository does not demonstrate PCI DSS compliance, production security, complete attack prevention, or continuous production monitoring.
