# ExhibitA status

Updated: 2026-10-05 (Asia/Calcutta).

The dedicated [ExhibitA Supabase project](https://supabase.com/dashboard/project/coponziasrruazpxsgyy) exists in the Hackathon organization, Mumbai. Its initial private-schema migration was applied and tested through the Supabase connector. The local app has **not** been connected to it: `DATABASE_URL` is unset, and Prisma migration history still needs the documented [baseline step](SUPABASE_SETUP.md). PayPal Sandbox credentials are configured locally, but OAuth and checkout have not been verified.

The app now includes local test-order creation, PayPal Sandbox order and capture calls, order/capture persistence, readiness checks, and a merchant dashboard inspired by the supplied PayPal screenshots. Capture parsing rejects non-USD, invalid or nonpositive amounts, and amounts that disagree with the local order. Creation uses fixed local return URLs; capture persistence and order completion share a database transaction. These paths have mock tests but **no real PayPal Sandbox checkout or live application-to-Supabase persistence test** because the database connection is unset.

Verification this turn: 32 tests pass; lint and production build pass. The dashboard was browser-checked with the integrations unconfigured. The interface reports configuration and stored captures without claiming an AI-agent audit trail or verified dispute evidence. Agent activity ingestion, webhooks, AI summaries, disputes, deployment, merchant authentication, and production security remain outside this demo.

The API is bound to loopback for local development. Its order read/write endpoints are unauthenticated; do not expose it publicly or use real merchant data until authorization and error handling are hardened. The `paymentFlow` readiness field still reports `not_implemented` while the real end-to-end Sandbox flow is unverified.

The workspace remains uncommitted and unpushed. `merchant-growth-ai` was paused with user authorization to make room under the free-project limit; `sih26` was not modified.
