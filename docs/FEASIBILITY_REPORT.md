# ExhibitA feasibility report

Checked: 2026-10-05. Documentation checks do not prove account-specific access.

## Current evidence

Dedicated Supabase project `coponziasrruazpxsgyy` is healthy in Mumbai. After the user authorized pausing `merchant-growth-ai`, ExhibitA was created and its Merchant/Order/Capture schema applied. Connector SQL tests used rollback-only synthetic records; all three tables have RLS enabled, no browser SELECT grants, and zero rows afterward. Application connectivity and Prisma migration-history adoption remain unverified without a local connection string.

The PayPal environment variables are unset. No OAuth token, order, approval, capture, webhook, refund, or dispute operation has been verified against Sandbox.

The repository initially contained no application code. The local foundation now builds, its setup screen renders, and 20 tests pass, including mocked PayPal requests and secret-redaction checks. No public payment mutation routes exist yet. The PayPal developer-dashboard setup remains user-reported, not independently verified.

## Documentation findings

- The [PayPal Orders v2 reference](https://developer.paypal.com/api/orders/v2) documents separate create, show, and capture operations.
- [PayPal authentication](https://developer.paypal.com/api/rest/authentication/) requires server-side credential handling.
- [PayPal dispute testing](https://developer.paypal.com/platforms/disputes/test-go-live/) documents Sandbox-only dispute creation, buyer-side prerequisites, and authentication assertions. This is a possible testing route, not confirmation that this account can use it.
- [Supabase's Prisma guide](https://supabase.com/docs/guides/database/prisma) supports a server-side Prisma integration and describes session-pooler connections for environments without direct IPv6 connectivity. Copy the exact connection details from the selected project's Connect dialog.
- [Prisma system requirements](https://www.prisma.io/docs/orm/v7/reference/system-requirements) recommend supported LTS Node releases. The installed Node 25 is an odd-numbered release; target Node 24 LTS for reproducibility and deployment and report local verification separately.

## Open questions

1. Configure the provisioned database connection locally, verify application connectivity, and baseline Prisma history for the already-applied initial migration.
2. Verify merchant-app OAuth and the full buyer approval/capture flow with actual Sandbox responses.
3. Confirm webhook signature verification and duplicate handling against a reachable HTTPS endpoint.
4. Test dispute scopes, account eligibility, buyer-side credentials, and supported transitions.
5. Verify an AI provider's actual API access before choosing a model.
6. Identify the exact hackathon event and verify its current official rules, deadline, license, and video requirements. No deadline is assumed.
7. Validate merchant demand and competing products with real evidence; no customer or market validation has been performed.
