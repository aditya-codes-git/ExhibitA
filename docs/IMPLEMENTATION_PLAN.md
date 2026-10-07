# ExhibitA foundation implementation plan

**Goal:** Establish the smallest locally runnable foundation for a real PayPal Sandbox purchase flow.

**Architecture:** React calls an Express API. Express will own PayPal credentials and database access through Prisma to a dedicated Supabase PostgreSQL database.

**Specification:** The user handoff and `docs/ARCHITECTURE.md`. The handoff already selects the stack, workflow, and foundation-first execution; this plan preserves those choices.

## Tasks

- [x] Configure npm workspaces, strict TypeScript, linting, formatting, build and test commands.
- [x] Add shared health response validation and API configuration validation. Test absent configuration and rejected malformed configuration without leaking values.
- [x] Add API liveness and readiness endpoints. Test unconfigured and failing database behavior, then implement. The frontend should distinguish reachable API from connected database.
- [x] Define Prisma merchant, order, and capture models in a private schema; generate and inspect the initial SQL migration. Applied through the authenticated connector to the newly provisioned dedicated database; local Prisma connection/baseline remains pending.
- [x] Implement a Sandbox-only PayPal adapter using OAuth, validated outputs, request timeouts, and caller-supplied stable request IDs. Write tests first for authentication failures, correct money strings, idempotency headers, and malformed responses.
- [x] Build a minimal frontend that loads API health, displays real readiness, and handles loading/error states. No polished dashboard or simulated transaction success.
- [x] Run formatting, lint, type checking, tests, builds, schema validation, and HTTP startup smoke checks.
- [x] Record exact outcomes, environment variables, external integration limitations, and the next real Sandbox test in STATUS and FEASIBILITY_REPORT.

## Review focus

- A configured URL is not evidence of database connectivity.
- No secret value may enter a browser response, build, test output, or tracked file.
- A failed or malformed PayPal response must never look like a completed payment.
- USD values use integer minor units converted to fixed decimal strings.
- No migration or test may touch either unrelated existing Supabase project.

## Next increment

Connect authenticated order creation, buyer approval, capture, and persistence; then run with real Sandbox credentials. Add evidence and AI only after this vertical flow is verified.

## Execution notes

- A dedicated Supabase project was provisioned after the user authorized pausing merchant-growth-ai. Existing application data was not migrated or modified.
- The connector applied the initial SQL before local credentials existed; Prisma history adoption is explicitly documented in SUPABASE_SETUP.md.
- Independent review found a malformed-URL redaction bug. Two regression tests reproduced it, the fix passed, and the final suite has 20 passing tests.
- The documented port-3001 development proxy limitation remains. All code/build/browser checks are complete for this increment; real Sandbox and app-database integration remain blocked on local credentials.
