# Changelog

All notable changes to this SDK are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [0.1.0] - 2026-04-24

Initial public release.

- Typed models for the core API surface.
- Bearer-token auth with exponential-backoff retry on 429 and 5xx responses (honors Retry-After).
- Webhook signature verification helper for the Stripe-compatible `X-Abundera-Signature` header.
- MIT licensed.
