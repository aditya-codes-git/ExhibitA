# ExhibitA status

Updated: 2026-10-08 (Asia/Calcutta).

The local app connects to the dedicated [ExhibitA Supabase project](https://supabase.com/dashboard/project/coponziasrruazpxsgyy) and PayPal Sandbox. Prisma reports all four migrations applied, including the additive agent-evidence migration. The private `exhibita` schema stores merchants, orders, captures, cases, and source-labeled agent events. The local API readiness check reported the database connected and PayPal Sandbox credentials verified.

The $25 Real Madrid jersey demo creates a saved case with the preset buyer request and a clearly labeled `SIMULATED_DEMO` action. A Sandbox buyer completed checkout for local order `c988aca6-6f84-4bac-8384-0a5b48eeb284`. The return page and saved case show a completed $25 USD capture (`8UA75761SL320530B`), and a direct database read matched the API's order, case, and capture records. The saved page was checked at desktop and mobile widths.

The new fictional Demo Sports Shop and guided case are implemented. Focused tests verify fixed product data, product-first/$25-only agent calls, duplicate run rejection, failure handling, and saved event contracts. The store and guided page were visually checked at desktop and 390px; an older completed case still renders with its `SIMULATED_DEMO` label. A **live Groq-driven case and buyer-approved capture are not yet verified** until a local `GROQ_API_KEY` is supplied and the Sandbox buyer approves checkout.

The earlier completed case confirms the Sandbox payment and application persistence. Neither the old nor new pilot proves that an external agent visited a shop, bought or shipped a jersey, or followed a verified buyer's external instructions. Public agent ingestion, verified webhooks, AI summaries, disputes, deployment, and merchant authentication remain future work.

The API is bound to loopback for this local demo; its order endpoints are unauthenticated and should not be exposed publicly.

`merchant-growth-ai` was paused with user authorization to make room under the free-project limit; `sih26` was not modified.
