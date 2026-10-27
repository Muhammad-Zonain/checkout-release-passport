# Partner integration pilot

## Current status

Checkout Release Passport v0.4.1 is a partner-ready release candidate for one paid technical integration pilot.

There is currently no claimed third-party vendor adapter, vendor endorsement, customer deployment, PCI certification, or independent validation. A vendor-specific adapter will be built only with the vendor's written participation, documented interface, and authorized sandbox or durable export.

## Integration outcome

The pilot connects evidence from a payment-page security platform to a customer's GitHub release workflow. The vendor remains the source of runtime or payment-page security observations. Checkout Release Passport adds a repository-owned release decision and evidence record bound to the relevant repository, commit, workflow, run, and reviewed baseline.

Target sequence:

```text
vendor evidence received
-> normalized and minimized
-> approved-baseline comparison
-> PASS or REVIEW_REQUIRED
-> JSON/HTML evidence retained in GitHub
-> controlled change produces review evidence
-> recovery returns PASS
```

The exact mapping is finalized against the partner's official API, signed webhook, or durable export. The existing browser-observation engine remains available for deterministic testing; it is not presented as a replacement for the partner's runtime product.

## Required partner inputs before adapter work starts

All of the following are required:

1. A named technical integration owner.
2. Written permission to use the selected API, signed webhook, or durable export.
3. Sandbox, demo tenant, or synthetic fixture data containing no cardholder data, credentials, cookies, or customer personal data.
4. Interface documentation, authentication method, rate limits, event-delivery behavior, and data-retention constraints.
5. A written mapping for at least one normal event, one controlled review-required event, and one recovery event.
6. Written acceptance criteria and the person authorized to accept the pilot.
7. A commercial path: paid pilot, licensing discussion, or vendor-referred customer installation.

If any item is missing, the vendor adapter does not start. This prevents speculative compatibility claims and unpaid custom engineering with no route to use.

## Fixed acceptance sequence

The agreed sandbox or synthetic fixture must prove:

1. A normal vendor evidence record maps to `PASS`.
2. A controlled, agreed change maps to the expected `REVIEW_REQUIRED` finding and review priority.
3. The result binds the vendor event identifier or export digest to GitHub repository, commit, workflow, and run provenance.
4. Redacted JSON and readable HTML evidence are retained in the customer-controlled GitHub workflow.
5. Duplicate delivery is idempotent and cannot create duplicate review records.
6. Missing, stale, malformed, unauthenticated, or out-of-scope vendor evidence fails closed and never becomes `PASS`.
7. Recovery or rollback returns `PASS` and resolves the matching review lifecycle.
8. No secret, token, cookie, cardholder data, form value, or customer personal data appears in stored evidence or logs.
9. The partner integration owner verifies the agreed results in writing.

Partner-specific behavior that cannot be tested with the supplied sandbox or fixtures is explicitly excluded from acceptance.

## Security and data boundary

- Use only authorized sandbox, demo, or customer scopes documented in writing.
- Prefer read-only API credentials, short-lived tokens, or signed webhooks with least privilege.
- Keep vendor credentials in the customer's or vendor's GitHub secret store; never place them in configuration, evidence, logs, issues, email, or support messages.
- Store vendor event IDs and evidence digests only when needed for traceability.
- Redact URL query values and CSP nonces before storage or hashing.
- Do not receive or store payment data, checkout form submissions, cookies, complete response bodies, or customer personal data.
- Record delivery freshness and authentication state. Unknown or unverifiable state cannot produce `PASS`.
- Document vendor API limits, outage behavior, replay handling, and evidence-retention responsibilities in the final handover.

See [`THREAT_MODEL.md`](THREAT_MODEL.md), [`SECURITY_AND_SCOPE.md`](SECURITY_AND_SCOPE.md), and [`SUPPLY_CHAIN_SECURITY.md`](SUPPLY_CHAIN_SECURITY.md).

## Commercial scope

### Accepted technical integration pilot: USD 1,500

- One partner interface: official API, signed webhook, or durable export.
- One vendor-owned sandbox/demo tenant or synthetic fixture set.
- One GitHub repository workflow.
- One agreed normal -> controlled review -> recovery sequence.
- JSON/HTML evidence, verification, and written handover.
- Payment is due only after the written acceptance sequence succeeds.
- If the agreed acceptance sequence fails, the pilot fee is USD 0.

Taxes, payment-processing fees, currency conversion, and any vendor/platform fees are handled only as stated in the written order. No interest, late-interest charge, or financing term is used.

### Vendor-referred customer installation: USD 1,500 fixed

After a successful partner pilot, each separately authorized referred-customer installation is scoped and accepted in writing. It does not include 24/7 monitoring by TransferVerity, PCI assessment, incident response, penetration testing, attack blocking, or work outside the agreed interface and repository.

These are published offer terms, not claims of current revenue, customers, or partner commitment.

## Stop conditions

Stop or decline the pilot when:

- the vendor will not name an integration owner;
- no authorized sandbox, API, webhook, or durable export is available;
- acceptance cannot be written and tested;
- the requested wording implies PCI certification, security guarantee, or endorsement that does not exist;
- the scope requires unauthorized checkout observation or sensitive payment/customer data;
- the only proposed relationship is an unpaid badge or listing with no paid, licensed, or referred-customer path; or
- work expands beyond the fixed acceptance scope without a written change.

## Contact

For a vendor integration discussion, email [hello@transferverity.com](mailto:hello@transferverity.com?subject=Vendor%20GitHub%20Evidence%20Integration).

Do not email credentials, access tokens, private customer URLs, cardholder data, cookies, or private repository content.

