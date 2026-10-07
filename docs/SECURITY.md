# Security boundaries

This foundation is for local development and is not production-ready.

- API and Vite bind to loopback. The new order read/write routes are unauthenticated; add merchant authorization before exposing transaction data or deploying.
- Database credentials and PayPal secrets belong only in the root `.env` or server environment. The frontend has no database or payment credentials.
- API configuration errors name invalid fields without disclosing their values. Readiness suppresses database driver messages. PayPal errors report HTTP status or a generic transport/validation failure, not provider payloads.
- PayPal's API origin is fixed to Sandbox. Requests time out after 15 seconds and do not follow redirects. Approval links must use the expected Sandbox origin.
- Local order/capture persistence is implemented and mock-tested. Real Sandbox checkout, merchant authorization, reconciliation, and webhook verification remain unverified or unimplemented.
- Money uses integer USD minor units. Capture parsing requires exactly two decimal places and rejects amounts that disagree with the local order. SQL requires positive amounts and USD. Separate persisted request IDs support idempotent create/capture operations.
- Supabase tables live in a private schema, have RLS enabled, and have no browser policies or browser SELECT grants. Future backend roles need explicit privileges and application-level merchant authorization.
- No personal data or payment card data is seeded. Database verification used synthetic records and rolled them back.
- The MIT license is included; public repository visibility and hackathon compliance have not been verified.

## Dependency note

Initial installation reported advisories in Prisma CLI's transitive `deepmerge-ts` and `mysql2` dependencies. Root overrides select patched `deepmerge-ts@8.0.2` and `mysql2@3.24.5`; ESLint was updated to the supported major 10. The subsequent installation audit reported zero vulnerabilities. Recheck these overrides when upgrading Prisma; local schema generation/build checks do not guarantee compatibility of unused Prisma Studio or MySQL features.
