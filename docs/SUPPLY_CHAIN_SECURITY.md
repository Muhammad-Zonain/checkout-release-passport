# Supply-chain security

## What v0.4.1 pins

- Direct npm dependencies use exact versions in `package.json` and an integrity-bearing `package-lock.json`.
- CI and nested GitHub Actions use reviewed full commit SHAs, with the corresponding release version recorded in comments.
- CI uses `npm ci --ignore-scripts --no-audit --no-fund` and disables package-manager caching.
- The composite Action uses `npx --no-install` so `npx` cannot select an undeclared package.
- Dependabot proposes npm and GitHub Actions updates; dependency review blocks newly introduced high-severity dependency findings in pull requests.
- CodeQL analyzes JavaScript on main, pull requests, and a weekly schedule.

Direct runtime pins for v0.4.1 are `parse5` `7.3.0` and `playwright` `1.61.1`. They match the committed lockfile. A newly published version is not adopted automatically; it first goes through the update process below.

GitHub Action refs verified against their official tag repositories on 2026-08-15:

| Action | Version comment | Full commit SHA |
|---|---|---|
| `actions/checkout` | `v6.1.0` | `d23441a48e516b6c34aea4fa41551a30e30af803` |
| `actions/setup-node` | `v6.5.0` | `249970729cb0ef3589644e2896645e5dc5ba9c38` |
| `actions/upload-artifact` | `v7.0.1` | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` |
| `actions/attest` | `v4.2.2` | `1e69f48acb82d1966a394da916b4c1698aa569d6` |
| `actions/dependency-review-action` | `v5.0.0` | `a1d282b36b6f3519aa1f3fc636f609c47dddb294` |
| `github/codeql-action` | `v4.37.7` | `ff2f1c621b7f889edc0d3c761ac2e6a3f8cdb0dd` |

“Verified” here means the version-to-SHA mapping was checked against the official Git tag repository. It is not a statement that every upstream line was independently audited or is defect-free.

Full commit SHAs prevent a referenced Action revision from moving. They do not prove that the pinned code is defect-free. Lockfile integrity verifies downloaded npm package bytes against the lock record; it does not replace code review or upstream security monitoring.

## Runtime download boundary

The composite Action installs its locked npm dependencies when it runs. Browser mode also asks the pinned Playwright package to install its matching Chromium build and operating-system packages. Those downloads are a disclosed runtime dependency boundary.

For environments that prohibit runtime browser downloads:

- use a reviewed self-hosted runner image with the matching Playwright browser already installed;
- set `install_browser: "false"`; and
- maintain and review that runner image through the customer's own supply-chain process.

Static mode does not need Chromium, but it observes HTML-declared scripts rather than the complete runtime browser path. Do not represent static-mode evidence as equivalent to runtime browser observation.

## Release integrity

When a GitHub release is published, `release-integrity.yml`:

1. checks out the released tag by full workflow-controlled reference;
2. verifies the release tag matches `package.json`;
3. installs locked dependencies without lifecycle scripts;
4. runs the test suite and local PASS -> REVIEW_REQUIRED -> recovery proof;
5. creates a source archive and SPDX SBOM;
6. creates SHA-256 checksums;
7. asks GitHub's official attestation Action to generate provenance and SBOM attestations; and
8. uploads the archive, SBOM, and checksums as workflow artifacts.

The release workflow must complete successfully before v0.4.1 is described as a verified published release. An attestation establishes build provenance; it is not a PCI certificate, vulnerability assessment, vendor endorsement, or guarantee that the software is secure.

## Caller pinning

Readable tags are convenient for evaluation:

```yaml
uses: Muhammad-Zonain/checkout-release-passport@v0.4.1
```

Production callers should replace the tag with the full 40-character commit SHA from the reviewed GitHub release. Dependabot or another controlled update process can then propose future revisions for review.

## Update process

1. Review the upstream release notes and security advisories.
2. Update one dependency or Action family at a time where practical.
3. Retain exact versions and regenerate the lockfile with the intended npm version.
4. Review the complete diff, including transitive lockfile changes.
5. Run tests and the local acceptance lifecycle.
6. Require CI, CodeQL, and dependency review to pass before merge.
7. Publish a new immutable release; do not move an existing release tag.
