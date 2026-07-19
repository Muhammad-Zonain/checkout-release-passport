# Security and scope rules

This MVP is an evidence collector, not a penetration-testing tool.

## Allowed use

- Local demonstration pages.
- A website owned by the operator.
- A staging or production page for which the operator has explicit written authorization.
- One passive navigation that loads the resources the page normally requests.

## Not allowed

- Scanning a merchant checkout without authorization.
- Filling or submitting forms.
- Entering real or test card data.
- Attempting purchases, authentication, bypasses, fuzzing, exploitation, or load testing.
- Collecting cookies, form values, cardholder data, personal data, or response bodies.

## Data minimization

The engine stores script hashes and metadata. URL query values are redacted. Script response bodies and inline-script text are hashed in memory and discarded. Only selected security headers are retained; `set-cookie` and other sensitive headers are not stored.

## Product claim

Reports must say that the product supports evidence collection. They must not claim to certify PCI DSS compliance or guarantee security. Formal applicability and compliance decisions remain with the merchant and its qualified assessor.
