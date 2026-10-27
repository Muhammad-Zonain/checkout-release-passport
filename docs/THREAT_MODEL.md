# Threat model

## Assets

- the reviewed checkout baseline and approval register;
- release-passport, snapshot, comparison, monitoring-event, alert, and HTML evidence;
- repository, commit, workflow, run, Action, and future vendor-event provenance;
- GitHub token or future vendor credential used by the caller; and
- the integrity of `PASS` and `REVIEW_REQUIRED` decisions.

## Trust boundaries

1. The authorized checkout or partner evidence source.
2. The GitHub-hosted or customer-controlled runner.
3. Downloaded locked npm packages and the optional Playwright Chromium runtime.
4. The caller repository, secrets store, Actions artifacts, and Issues API.
5. A future partner API, signed webhook, or durable export.

Checkout Release Passport has no maintainer-operated evidence service or telemetry endpoint.

## Principal threats and controls

| Threat | Current control | Residual boundary |
|---|---|---|
| Unauthorized checkout inspection | Configuration authorization record plus exact `ack_authorized: "true"`; main-frame origins are restricted | The operator is responsible for holding real written authorization |
| Payment, customer, cookie, credential, or query-secret retention | No form interaction; selected headers only; response bodies discarded; URL values/CSP nonces redacted before storage and hashing | A newly supported field must receive a separate minimization review |
| Baseline silently replaced | Normal checks require an existing reviewed baseline; replacement requires explicit baseline mode and force acknowledgement | Repository write access remains a powerful trust boundary |
| Evidence altered after creation | Canonical SHA-256 digests and verification commands; optional GitHub provenance attestation | A digest detects mismatch but does not independently identify the author |
| Unreviewed code or Action revision moves | Exact npm versions, lockfile integrity, full-SHA nested Actions, full-SHA recommendation for callers | Upstream defects or a compromised package at the pinned revision remain possible |
| Dependency lifecycle script execution | `npm ci --ignore-scripts` in CI and the composite Action | Playwright browser/OS package downloads remain a disclosed boundary |
| Token leakage | Token passed only to the issue synchronization process; token excluded from evidence and logs | Caller workflow and runner security remain customer responsibilities |
| Duplicate or replayed future vendor event | Pilot acceptance requires authenticated freshness, stable event/digest binding, and idempotency | Exact mechanism depends on the vendor interface and is not claimed before implementation |
| Vendor outage, stale export, or malformed evidence becomes `PASS` | Pilot contract requires fail-closed behavior | No vendor adapter exists in v0.4.1; it must be tested against the official interface |
| Point-in-time observation mistaken for continuous protection | Reports state capture mode, time, and limitations | Browser mode cannot prove every user, geography, consent, authentication, or attacker-evasion path |

## Non-goals

The product does not provide PCI DSS certification, QSA assessment, penetration testing, vulnerability scanning, malicious-code classification, attack blocking, incident response, or continuous real-user-session monitoring.

