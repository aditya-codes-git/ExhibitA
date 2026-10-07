# ExhibitA status

Updated: 2026-10-08 (Asia/Calcutta).

The local app connects to the dedicated [ExhibitA Supabase project](https://supabase.com/dashboard/project/coponziasrruazpxsgyy) and PayPal Sandbox. Prisma reports all three migrations applied. The private `exhibita` schema stores merchants, orders, captures, and fixed demo evidence cases.

The $25 Real Madrid jersey demo creates a saved case with the preset buyer request and a clearly labeled `SIMULATED_DEMO` action. A Sandbox buyer completed checkout for local order `c988aca6-6f84-4bac-8384-0a5b48eeb284`. The return page and saved case show a completed $25 USD capture (`8UA75761SL320530B`), and a direct database read matched the API's order, case, and capture records. The saved page was checked at desktop and mobile widths.

This confirms the Sandbox payment and application persistence. It does not prove that a real agent visited a shop, bought a jersey, or followed a buyer's external instructions. Agent ingestion, webhooks, AI summaries, disputes, deployment, and merchant authentication remain future work.

The API is bound to loopback for this local demo; its order endpoints are unauthenticated and should not be exposed publicly.

`merchant-growth-ai` was paused with user authorization to make room under the free-project limit; `sih26` was not modified.
