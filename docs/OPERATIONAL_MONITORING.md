# Operational monitoring guide

Checkout Release Passport v0.4.1 adds a scheduled operational layer to the existing release gate. Evidence remains in the caller repository and GitHub Actions artifacts.

## What this workflow is for

Use it when an authorized ecommerce team wants to:

1. maintain a browser-observed checkout script inventory;
2. document each script's owner, approval, business purpose, expiry, and integrity method;
3. compare scripts, selected security-impacting headers, and network origins with a reviewed baseline;
4. run the same control after releases and on a schedule;
5. create one repository-owned issue when review is required; and
6. resolve that issue after rollback or an approved recovery returns `PASS`.

PCI SSC describes payment-page script authorization, integrity, inventory, and change/tamper monitoring as relevant objectives for Requirements 6.4.3 and 11.6.1. Applicability, implementation sufficiency, and compliance validation remain decisions for the entity, its acquirer or payment brand, and its assessor. See [PCI SSC's payment-page security guidance announcement](https://blog.pcisecuritystandards.org/new-information-supplement-payment-page-security-and-preventing-e-skimming).

## 1. Configure the target

Add a `monitoring` block to the authorized target configuration:

```json
{
  "monitoring": {
    "expected_interval_hours": 24,
    "review_owner": "Ecommerce Engineering",
    "response_target_hours": 4
  }
}
```

The authorization block defaults main-document navigation to the configured URL origin. List any separately authorized redirect origin explicitly:

```json
{
  "authorization": {
    "allowed_navigation_origins": [
      "https://checkout.example.com",
      "https://payments.example-provider.com"
    ]
  }
}
```

Embedded URL credentials are rejected. A main-frame redirect outside this list is blocked; third-party script origins observed as part of the authorized page remain visible in evidence and review findings.

- `expected_interval_hours` accepts 1-168.
- `review_owner` is written into the report and alert.
- `response_target_hours` is an operational target, not a guarantee.

The generated event explicitly says that configuration alone does not prove the schedule ran. Retain and review actual workflow run history.

## 2. Review the baseline and approval register

Run the baseline workflow manually. Download its artifact, inspect every observed script and selected header, complete the approval register, and commit only the reviewed baseline and approvals.

An approval entry must include:

- unique approval ID;
- exact or permitted external-prefix match;
- owner;
- written business purpose;
- approver;
- real approval date;
- optional expiry date; and
- integrity method when documented.

Placeholders, duplicate IDs, invalid dates, an expiry before approval, expired approvals, and future-dated approvals cannot silently create an active authorization.

## 3. Enable scheduled checks and issue alerts

Copy [`../examples/github-monitoring-workflow.yml`](../examples/github-monitoring-workflow.yml) into `.github/workflows/` in the caller repository.

Agencies with multiple authorized targets can use the matrix pattern in [`../examples/github-monitoring-matrix-workflow.yml`](../examples/github-monitoring-matrix-workflow.yml). Each target keeps its own baseline, approval register, artifact, and deduplicated issue marker.

The job uses minimum repository permissions:

```yaml
permissions:
  contents: read
  issues: write
```

The example runs at minute 17 every six hours. GitHub notes that scheduled workflows can be delayed during high load, run only from the default branch, and may be disabled after prolonged inactivity in public repositories. Review [GitHub's schedule-event documentation](https://docs.github.com/actions/using-workflows/events-that-trigger-workflows) before treating workflow configuration as cadence evidence.

## 4. Understand the decision and priority

| Result | Meaning | Normal action |
|---|---|---|
| `PASS` / `NONE` | No configured drift or approval/integrity gap was found | Retain evidence; resolve any matching open alert issue |
| `REVIEW_REQUIRED` / `P1` | Immediate workflow review, such as an unapproved script, third-party script change, missing integrity evidence, or removal of a high-impact header | Freeze or roll back according to the team's change and incident procedures; investigate promptly |
| `REVIEW_REQUIRED` / `P2` | Prompt review, such as an expired approval, first-party script change, header change, or new third-party origin | Assign the named owner and document acceptance or rollback |
| `REVIEW_REQUIRED` / `P3` | Planned review, such as a removed script or evidence-engine/capture-mode transition | Confirm the change and update reviewed records deliberately |

These priorities are not CVSS scores, vulnerability severities, or proof of compromise.

## 5. Retain and verify evidence

Every check artifact contains:

- immutable snapshot JSON;
- comparison JSON;
- readable HTML report;
- release-passport JSON;
- monitoring-event JSON; and
- review-alert JSON.

The default retention is 90 days. Repository, organization, or enterprise limits can reduce the effective maximum.

Verify artifact content digests locally:

```bash
node src/cli.js verify-passport --file path/to/file.passport.json
node src/cli.js verify-event --file path/to/file.event.json
node src/cli.js verify-alert --file path/to/file.alert.json
```

Digest verification detects artifact content mismatch. It does not authenticate the creator; use separately reviewed GitHub provenance or artifact attestation when signer authenticity is required.

## 6. Acceptance sequence

Before a customer handover, demonstrate:

```text
reviewed checkout       -> PASS
controlled script drift -> P1 REVIEW_REQUIRED + issue open/update
rollback                 -> PASS + matching issue resolved
```

The repository-owned demo can verify this lifecycle without external targets:

```bash
npm run verify:monitoring
```

## Boundaries

This workflow does not provide PCI DSS certification, a QSA assessment, legal advice, penetration testing, proof of compromise, malicious-behavior analysis, attack blocking, or real-user-session monitoring. It observes the configured state at each authorized run and makes the resulting evidence actionable inside GitHub.
