# Changelog

All notable changes to Checkout Release Passport are documented here.

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
