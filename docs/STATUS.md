# ExhibitA status

Updated: 2026-10-10 (Asia/Calcutta).

The deployed app connects to the dedicated [ExhibitA Supabase project](https://supabase.com/dashboard/project/coponziasrruazpxsgyy) and PayPal Sandbox. Prisma reports all six migrations applied, including agent evidence and PayPal webhook receipts. The private `exhibita` schema stores merchants, orders, captures, cases, source-labeled agent events, and minimized webhook receipts. The Render API health check returns 200.

The $25 Real Madrid jersey demo creates a saved case with the preset buyer request and a clearly labeled `SIMULATED_DEMO` action. A Sandbox buyer completed checkout for local order `c988aca6-6f84-4bac-8384-0a5b48eeb284`. The return page and saved case show a completed $25 USD capture (`8UA75761SL320530B`), and a direct database read matched the API's order, case, and capture records. The saved page was checked at desktop and mobile widths.

The new fictional Demo Sports Shop and guided case are implemented. Focused tests verify fixed product data, product-first/$25-only agent calls, duplicate run rejection, failure handling, and saved event contracts. The store and guided page were visually checked at desktop and 390px; an older completed case still renders with its `SIMULATED_DEMO` label. A live run with Groq's `qwen/qwen3.8-27b` created a fresh case and recorded four events in sequence: model product lookup request, store product result, model $25 checkout request, and PayPal order result. Supabase readback confirms the case is `CHECKOUT_READY`, the local order is `PAYPAL_ORDER_CREATED`, and its amount is 2500 USD cents. PayPal buyer approval and the capture are still pending, so this is not yet a completed-payment result.

The earlier completed case confirms the Sandbox payment and application persistence. Neither the old nor new pilot proves that an external agent visited a shop, bought or shipped a jersey, or followed a verified buyer's external instructions. A signed Sandbox webhook receiver is deployed, but the PayPal Sandbox listener still needs to be registered and its generated ID added to Render before a real event can be verified. AI summaries and a dispute workspace remain future work.

The API is deployed on Render and serves the frontend. Merchant endpoints require a Supabase bearer session. PayPal webhook ingestion is public by design, signature-verified, minimized, and disabled until `PAYPAL_WEBHOOK_ID` is configured.

`merchant-growth-ai` was paused with user authorization to make room under the free-project limit; `sih26` was not modified.
