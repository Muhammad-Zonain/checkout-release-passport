# Changelog

All notable changes to Checkout Release Passport are documented here.

## 0.4.1 - unreleased

### Added

- Added expected final-page identity and optional HTML readiness-marker checks before any baseline or current snapshot is stored.
- Added owned functional checkout practice with a shared healthy/broken/recovery test, readable reports and synthetic screenshots.
- Added static and real-browser regression cases for HTTP errors, same-origin login redirects, missing markers and timeout; CI must execute browser verification without skips.

- Added scheduled operational monitoring support with an example six-hour GitHub Actions workflow.
- Added machine-readable monitoring events and review-alert payloads to every check artifact.
- Added optional repository-owned GitHub issue alerting that opens or updates on `REVIEW_REQUIRED` and resolves after a later `PASS`.
- Added P1/P2/P3 workflow review prioritization with structured findings. Priorities are explicitly not vulnerability severities.
- Added script-integrity evidence status, expired-approval status, control-coverage summaries, configurable review ownership, response targets, and expected monitoring intervals.
- Added JSON schemas for approval registers, monitoring events, and alert payloads.
- Added a written partner-integration pilot contract with required inputs, fixed acceptance criteria, data boundaries, commercial terms, and stop conditions.
- Added a threat model, supply-chain security guide, CODEOWNERS, Dependabot configuration, CodeQL, dependency review, and a release-integrity workflow.
- Added source provenance and SBOM attestation steps for published releases.

### Changed

- Increased default evidence retention from 30 to 90 days, configurable from 1-90 days.
- Strengthened approval-register validation, including completed owner, purpose, approver, real dates, unique identifiers, and supported matching modes.
- Expanded the HTML and GitHub summaries with integrity gaps, approval expiry, prioritized findings, and operational-control boundaries.
- Repositioned the engine from release-only evidence to release-time plus scheduled checkout script control while retaining local-first, client-owned evidence.
- Pinned direct npm dependencies to reviewed exact versions and pinned CI/nested GitHub Actions to full commit SHAs.
- Disabled CI package-manager caching, disabled npm lifecycle scripts during CI/Action installation, and made Playwright invocation refuse undeclared `npx` packages.
- Repositioned public documentation toward one paid vendor-integration pilot without claiming an existing vendor adapter, endorsement, customer, certification, or independent validation.

### Security hardening

- Reject non-2xx browser document responses rather than treating matching scripts/headers on an error page as a successful capture.
- Reject unexpected same-origin redirects; preserve the existing baseline and fail the Action on unsuccessful capture, including when `--no-fail` is used.
- Compare recorded page identity and readiness-policy changes; label functional checkout coverage separately in the report.

- Reject target URLs with embedded credentials and strip credentials from every stored URL.
- Restrict main-document redirects to the configured origin plus explicitly authorized navigation origins.
- Preserve duplicate external-script occurrences during comparison rather than collapsing them by URL.
- Redact Content-Security-Policy nonce values and URL query values from selected stored security headers.
- Compute requested-page, final-page, and script-source URL fingerprints only after query-value redaction, preventing query secrets from surviving indirectly through hashes.
- Added regression tests for CSP nonce/report URL redaction and query-value-independent URL fingerprints.

### Boundaries

- v0.4.1 does not contain or claim an approved third-party vendor adapter.
- v0.4.1 does not claim PCI DSS certification, QSA assessment, penetration testing, proof of compromise, attack blocking, real-user-session monitoring, a vendor endorsement, customer deployment, or independent validation.

## v0.3.1

### Security hardening

- Pinned the nested `actions/upload-artifact` dependency to the reviewed
  full commit SHA for `v7.0.1`.
- Documented immutable caller pinning and nested dependency boundaries.
- Preserved all existing inputs, outputs, evidence formats, and workflow
  behavior.

## 0.3.0 - 2026-07-20

### Added

- Added an explicit `operation: baseline` onboarding mode to the GitHub Action.
- Added baseline, snapshot, approval-template, comparison, target, and passport-digest outputs.
- Added separate, target-specific artifacts for baseline and check operations.
- Added the Action repository and requested Action ref to release-passport provenance.
- Added generator name, version, and capture mode to every release passport.
- Added a safe, manual baseline workflow example and onboarding documentation.

### Fixed

- Updated the scanner's reported engine version to match the public release.
- Corrected the repository owner in reusable workflows and local proof provenance.
- Prevented normal multi-target baseline/check artifacts from sharing one generic name.
- Included the immutable current snapshot in every check artifact.
- Made scanner-version and capture-mode changes require human review.
- Refused to overwrite an existing baseline unless an explicit force option is supplied.

### Trust signals

- Added public workflow, Marketplace, release, and license badges to the README.

## 0.2.0 - 2026-07-19

- First public validation release.
- Added the composite GitHub Action, release passport JSON, HTML evidence report, digest verification, workflow provenance, and automated safety tests.
