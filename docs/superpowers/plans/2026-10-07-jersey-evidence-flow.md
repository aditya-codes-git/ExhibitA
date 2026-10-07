# Jersey Evidence Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the fixed $25 football jersey example into a saved, inspectable PayPal Sandbox evidence case.

**Architecture:** Keep the existing Order and Capture payment flow. Add one private EvidenceCase per demo order, selected by a fixed API identifier; load it through the existing order endpoints. A new case page distinguishes preset request, simulated action, and PayPal capture facts.

**Tech Stack:** TypeScript, Express, Prisma/PostgreSQL on Supabase, React/Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-07-jersey-evidence-flow-design.md`

## Global Constraints

- Exact request: “Buy the Real Madrid 2026 home jersey, player edition, for $25 from Demo Sports Shop.” The buyer chooses all details; Demo Sports Shop is fictional.
- Demo amount is `2500` USD minor units; the only agent source is `SIMULATED_DEMO` after successful PayPal order creation.
- The PayPal order and capture are Sandbox facts. Neither verifies the jersey/shop nor proves an external agent acted.
- Keep `exhibita` backend-only with RLS; do not expose database credentials or a browser Supabase client. Keep the unauthenticated API loopback-only.
- Preserve manual orders, capture idempotency, and the existing initial migration; do not reset the database.
- No real agent/storefront ingestion, webhooks, AI summary, or dispute workflow in this increment.

## Review Focus

- Unknown or mixed demo input: reject an unsupported identifier or demo request with client amount/item override; never create an order.
- PayPal creation failure: retain the local case without a simulated action timestamp or completion claim.
- Case lookup for a legacy order: return `evidenceCase: null` and keep the order readable.
- Repeated capture: reuse the existing capture and never create a second case or call PayPal capture twice.
- OAuth failure or unavailable database: readiness must remain unverified/not ready and must not disclose secrets.

---

## File structure

- `prisma/schema.prisma` and one new `prisma/migrations/*_evidence_case/migration.sql`: one-to-one private case record, access controls, and integrity constraints.
- `packages/shared/src/index.ts`: backward-compatible request identifier and saved case/order response types.
- `apps/api/src/app.ts`: fixed demo creation branch, case inclusion on reads, and verified readiness. Reuse the existing capture route.
- `apps/api/test/order-flow.test.ts` and `apps/api/test/foundation.test.ts`: API behavior and failure paths with current mock pattern.
- `apps/web/src/DemoCase.tsx`: start action on the existing static example.
- `apps/web/src/SavedCase.tsx`: one saved case view, fetched by order ID.
- `apps/web/src/main.tsx`: case route and links from return, cancellation, and recent orders.
- `docs/SUPABASE_SETUP.md`: update migration guidance only after live verification.

### Task 1: Persist the case safely

**Files:** Modify `prisma/schema.prisma`; create `prisma/migrations/<timestamp>_evidence_case/migration.sql`.

**Interfaces:** `Order.evidenceCase: EvidenceCase | null`; `EvidenceCase` uses UUID `orderId` as both primary key and foreign key, plus `buyerInstruction`, `itemName`, `shopName`, nullable `agentActionSource`/`agentActionAt`, and `recordedAt`.

- [ ] Add the Prisma relation and model; generate one incremental migration. In SQL, keep `exhibita` private, revoke browser roles, enable RLS, and constrain source/time to both null or `SIMULATED_DEMO` plus a non-null time.
- [ ] Inspect generated SQL for any changes to existing tables beyond the relation, and confirm `npx prisma validate` passes. If Prisma's shadow database blocks generation, author the same incremental SQL in a new Prisma migration; never reset or replay the initial migration.
- [ ] Run `npm run db:deploy`, `npx prisma migrate status`, and a read-only check that `exhibita."EvidenceCase"` exists with the expected columns and RLS enabled. Do not proceed if any check fails.
- [ ] Commit schema and migration as `feat: add private evidence case record`.

### Task 2: Create and read one fixed demo case

**Files:** Modify `packages/shared/src/index.ts`, `apps/api/src/app.ts`, `apps/api/test/order-flow.test.ts`.

**Interfaces:** `POST /api/orders` accepts `{ demoCase: 'football_jersey_2026' }` with no amount/item overrides; existing manual body remains valid, including its `1500` default. Preserve field presence in validation so demo overrides can be rejected before applying the manual default. `GET /api/orders` and `GET /api/orders/:id` include `evidenceCase` (object or null). The fixed server values are `2500`, `USD`, the exact request above, item `Real Madrid 2026 home jersey, player edition`, and shop `Demo Sports Shop`.

- [ ] Add failing tests for fixed values, atomic `Order`+`EvidenceCase` creation before PayPal, and atomic order reference/action update after PayPal succeeds. Assert `SIMULATED_DEMO` is persisted and returned, while caller-supplied source/time/status/PayPal ID are ignored.
- [ ] Add failing tests for unknown or mixed demo input (400, no writes), PayPal failure (no action source/time), case lookup for legacy orders (`null`), and repeated capture (one capture, one case, no second PayPal call). Reuse the existing capture test where it already proves idempotency.
- [ ] Run `npx vitest run apps/api/test/order-flow.test.ts --pool=threads`; confirm the new tests fail for the intended missing behavior.
- [ ] Implement the schema extension and demo branch in `app.ts`: create order+case in one Prisma transaction, call PayPal with the existing request ID, then update order+case in one transaction. Preserve the manual branch and existing response shape; include `evidenceCase` on both read queries.
- [ ] Run the focused tests, `npm run typecheck`, and `npm run lint`; fix failures. Commit as `feat: create fixed jersey Sandbox evidence case`.

### Task 3: Make readiness reflect live checks

**Files:** Modify `apps/api/src/app.ts`, `apps/api/test/foundation.test.ts`, and dashboard wording in `apps/web/src/main.tsx` if it implies a payment succeeded.

**Interfaces:** `/api/readiness` returns `paypal: 'verified'` only after `paypalClient.verifyCredentials()` succeeds; `paymentFlow: 'ready'` only when database is connected and OAuth verified. This means usable integrations, not a completed order.

- [ ] Add failing readiness tests for success, OAuth failure, database failure, and no credential/error leakage; keep the existing unconfigured test.
- [ ] Run `npx vitest run apps/api/test/foundation.test.ts --pool=threads`; confirm the new tests fail for the intended state.
- [ ] Call the existing PayPal verification method in readiness, handle failures without exposing exceptions, and adjust dashboard copy only where needed to distinguish readiness from payment state.
- [ ] Run focused tests and `npm run typecheck`; commit as `fix: report verified Sandbox readiness`.

### Task 4: Show the saved case and verify the full flow

**Files:** Modify `apps/web/src/DemoCase.tsx`, `apps/web/src/main.tsx`; create `apps/web/src/SavedCase.tsx`; update `docs/SUPABASE_SETUP.md` after migration verification.

**Interfaces:** `/cases/:orderId` fetches `GET /api/orders/:id`; `DemoCase` posts `{ demoCase: 'football_jersey_2026' }`, then offers the returned Sandbox approval URL. The case page uses `evidenceCase`, `Order`, and `Capture` only; completion requires a capture with `status: 'COMPLETED'` and matching completed order.

- [ ] Add the fixed Start $25 Sandbox test action with loading/error feedback and clear Sandbox/simulated labels; leave the current read-only example accessible.
- [ ] Build the saved case page with preset request, stored source/time, local order/PayPal IDs, amount, capture status, and `Capture.recordedAt` as ExhibitA record time. Do not label `Capture.occurredAt` as a verified PayPal timestamp. Render pending/cancelled/failed and missing-case states without a completion claim.
- [ ] Add the route and case links from return, cancellation, and corresponding recent orders. Preserve manual order links and existing capture behavior.
- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build`; inspect `/demo-case`, the saved pending case, and the completed case at desktop and mobile widths.
- [ ] With the user's Sandbox buyer approval, run one $25 checkout; verify the saved page and read-only Supabase Order/EvidenceCase/Capture rows agree on IDs, amount, currency, status, and source. If buyer approval is unavailable, report that live verification remains open; do not claim completion.
- [ ] Update setup docs with the actual migration result and commit as `feat: show saved jersey evidence timeline`.
