# Security and scope rules

Checkout Release Passport is an authorized technical-control evidence and alerting tool, not a penetration-testing or attack-blocking tool.

## Allowed use

- Local demonstration pages.
- A website owned by the operator.
- A staging or production page for which the operator has explicit written authorization.
- Passive release-time or scheduled navigation that loads the resources the page normally requests.
- Main-document navigation restricted to the configured origin and any additional origins explicitly listed in `authorization.allowed_navigation_origins`.
- A repository-owned GitHub issue created with the caller's short-lived `github.token` after the caller explicitly enables `alert_mode: github-issue`.

## Not allowed

- Scanning a merchant checkout without authorization.
- Filling or submitting forms.
- Entering real or test card data.
- Attempting purchases, authentication, bypasses, fuzzing, exploitation, or load testing.
- Collecting cookies, form values, cardholder data, personal data, or response bodies.

## Data minimization

The engine stores script hashes and metadata. URL query values and Content-Security-Policy nonce values are redacted before storage. Stored URL fingerprints are computed from the redacted URL, so query values cannot survive indirectly through query-dependent hashes. Script response bodies and inline-script text are hashed in memory and discarded. Only selected security headers are retained; `set-cookie` and other sensitive headers are not stored.

Target URLs containing embedded usernames or passwords are rejected. Stored URLs remove credentials and fragments and replace every query value with a redaction marker.

Because URL query values are removed before URL fingerprinting, a query-value-only URL change is intentionally not represented by the URL fingerprint. If the downloaded script bytes change, the separate content fingerprint still changes. This is a deliberate privacy-versus-URL-version-detail tradeoff.

## Product claim

Reports must say that the product supports evidence collection. They must not claim to certify PCI DSS compliance or guarantee security. Formal applicability and compliance decisions remain with the merchant and its qualified assessor.

P1/P2/P3 values rank human-review workflow urgency. They must not be described as vulnerability severity, confirmation of malicious code, or proof of compromise.

Browser capture is still point-in-time observation. It is not real-user-session monitoring and may not observe scripts that depend on unconfigured interaction, consent state, authentication, geography, device type, feature flags, or attacker evasion.

## Data flow and telemetry

Checkout Release Passport has no maintainer-operated account, analytics
endpoint, or telemetry callback.

It navigates to the configured authorized target and to resources that the
page normally requests during the configured observation.

Generated evidence remains in the caller's local workspace or GitHub Actions
workspace and artifacts unless the caller deliberately copies or exports it.

The Action does not send collected checkout evidence to the maintainer.

When GitHub issue alerting is enabled, only the generated redacted alert summary is sent to the caller repository's own GitHub Issues API. The `github.token` is not included in snapshots, reports, passports, monitoring events, alert files, or console output.

Third-party resources loaded by the configured checkout remain subject to the
checkout operator's own architecture, providers, policies, and authorization.

## Future partner-interface boundary

v0.4.1 does not claim a working or approved third-party vendor adapter. Any future API, signed-webhook, or durable-export adapter must use an authorized sandbox or customer scope, least-privilege credentials, authenticated freshness checks, replay/idempotency controls, fail-closed handling, and the same evidence-minimization rules. See [`PARTNER_INTEGRATION_PILOT.md`](PARTNER_INTEGRATION_PILOT.md) and [`THREAT_MODEL.md`](THREAT_MODEL.md).
