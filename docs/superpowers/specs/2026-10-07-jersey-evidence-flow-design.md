# Persisted football jersey evidence case

## Purpose

Turn the approved static jersey example into one inspectable Sandbox case. The buyer's instruction is exact: “Buy the Real Madrid 2026 home jersey, player edition, for $25 from Demo Sports Shop.” The scripted demo action follows that request; the agent does not choose the product, edition, shop, or price. Demo Sports Shop is fictional. PayPal Sandbox provides a real test order and capture, while the agent action remains explicitly simulated.

Success means a merchant can open one saved case and distinguish the preset buyer request, the simulated action, and the PayPal-verified payment facts. The case remains useful when the buyer cancels or capture fails; it must not imply a completed purchase without a completed capture.

## Approach and scope

Add a one-to-one `EvidenceCase` record in the private `exhibita` schema, linked to the existing `Order`. It stores the exact instruction, selected item, fictional shop, and—only after PayPal order creation succeeds—the fixed `SIMULATED_DEMO` action source and server timestamp. The existing `Order` and `Capture` records remain the source for PayPal IDs, amount, status, and capture record time. An `EvidenceCase` is a local application record, not independent agent telemetry or buyer identity proof.

This is smaller than a generic event-ingestion system and keeps demo-specific fields off ordinary orders. Adding nullable demo fields directly to `Order` would be slightly quicker but would blur that boundary. A real external agent, third-party storefront integration, webhook ingestion, AI analysis, and disputes remain later work. No new Supabase project or browser-side database client is needed.

## Case flow

1. The existing `/demo-case` page continues to show the read-only example and offers a clearly labeled **Start $25 Sandbox test** action. It must explain that the PayPal payment is a Sandbox test and the agent step is simulated.
2. The action calls the existing order-creation API with a fixed demo-case identifier. The server, not browser-entered text, selects the exact instruction, item, shop, USD currency, and `2500` minor-unit amount. Ordinary manual test orders retain their current behavior.
3. The API creates the local `Order` and its `EvidenceCase` together before calling PayPal. After PayPal returns an order ID and approval URL, it updates the order reference and simulated action time/source in one database transaction. A failed PayPal call leaves no completed action. This action means **the demo flow initiated the requested PayPal order**, not that a jersey was bought or that an AI agent visited a website.
4. The buyer approves or cancels in PayPal Sandbox. The existing capture endpoint remains the only path that advances the local order to `COMPLETED`, using its validated PayPal capture response and idempotency key. A repeated capture request must not duplicate the capture or case.
5. A saved case view loads its order, case record, and capture from the existing order-by-ID API by local order ID. The return and cancellation pages link to it, as does the corresponding recent order. It shows occurrence and recorded times where available, source labels, PayPal IDs, and the exact $25 amount. The completed state appears only for a completed capture. Cancelled, pending, and failed cases show the evidence collected so far without a success claim.

## Data and trust boundaries

- `EvidenceCase` has a unique `orderId`, exact `buyerInstruction`, `itemName`, `shopName`, nullable `agentActionSource` and `agentActionAt`, and `recordedAt`. Source and action time are set together after PayPal order creation; the only source value in this flow is `SIMULATED_DEMO`. It must be rendered as such, including in API responses.
- The request and selection are preset by the local demo flow. They are not independently verified buyer instructions. The action timestamp comes from the ExhibitA server and does not prove that an external AI agent acted.
- The PayPal capture confirms the test payment's ID, amount, currency, and status; it does **not** independently confirm the jersey's identity, edition, or fictional shop. Show `Capture.recordedAt` as ExhibitA's record time. The current parser can fall back to server time for `occurredAt`, so the view must not label that field as a verified PayPal timestamp.
- The new table stays in the private `exhibita` schema with the same backend-only access model and RLS posture as the existing tables. No Supabase key or database credential enters the browser. The local unauthenticated API remains loopback-only; deployment requires merchant authentication and authorization first.
- Validate the fixed demo identifier at the API boundary. Do not accept a client-supplied source label, action time, PayPal ID, or completion status as evidence. Render stored instruction text as text, never HTML.
- Existing orders have no case record and remain readable. The static example must not appear as a verified order until a Sandbox order has actually been created.

## Readiness and user interface

Use the existing PayPal client's OAuth verification for readiness rather than equating configured credentials with verified credentials. `paymentFlow: ready` means the database responds and Sandbox OAuth succeeds; it does not assert that a particular purchase succeeded. The dashboard must communicate that distinction and avoid the current hard-coded `not_implemented` label once these checks pass. A saved case's payment state comes from its own order and capture, not readiness.

The saved case view may reuse the static page's two-step presentation, but it must identify which fields are stored and which facts are PayPal-verified. Do not show an AI-generated summary, missing-evidence verdict, or dispute recommendation in this increment.

## Migration and verification

Prisma is the schema source of truth. The existing initial migration is recorded and `prisma migrate status` reported the database up to date on 2026-10-07. Create one new version-controlled migration for `EvidenceCase`; do not reset the database or replay the initial migration. Verify the migration against the dedicated ExhibitA Supabase project before exercising the app.

Automated checks cover fixed request values, atomic local order/case creation, source labeling, successful and failed PayPal order creation, capture idempotency, legacy orders without a case, and readiness semantics. Then perform one $25 PayPal Sandbox buyer approval and confirm that the saved case, `Order`, and `Capture` agree in Supabase. This last step needs the user's Sandbox buyer action; test mocks or a successful build alone do not establish it.
