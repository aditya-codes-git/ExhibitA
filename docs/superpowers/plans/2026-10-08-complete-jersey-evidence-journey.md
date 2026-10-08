# Complete Jersey Evidence Journey Implementation Plan

> **For agentic workers:** Implement this plan task by task after the user's approval. Use `superpowers:executing-plans` for the implementation and keep each task's checks green before moving on.

**Goal:** A merchant can follow one $25 jersey Sandbox case from the preset buyer instruction, through real recorded agent tool calls on a fictional store, to the PayPal capture, while older simulated and manual cases remain accurate.

**Architecture:** Keep the store in this repository as `/demo-store`, with a separate retail layout. The server exposes the same fixed product to the page and to a narrowly scoped model tool. Create a local case before the agent run; append source-labeled tool events to the private Supabase database; let a guarded checkout tool initiate the existing PayPal Sandbox order. The buyer alone approves payment. Reuse the current capture endpoint and distinguish agent evidence from PayPal facts in the case view.

**Tech Stack:** Existing React/Vite, Express, TypeScript, Prisma, Supabase PostgreSQL, PayPal Sandbox; add the official server-side `groq-sdk` for Chat Completions local function calling. Default to `llama-3.3-70b-versatile`, configurable with `GROQ_MODEL`. Groq documents both the [JavaScript SDK](https://console.groq.com/docs/libraries) and [local tool calling](https://console.groq.com/docs/tool-use/local-tool-calling); its [model card](https://console.groq.com/docs/model/llama-3.3-70b-versatile) lists tool use support.

**Spec:** [Product direction](../../PRODUCT_DIRECTION.md), especially “The next implementation after the frontend refresh”; incorporates [frontend refresh Task 3](2026-10-08-frontend-refresh.md#task-3-unify-case-and-checkout-states). This single plan supersedes implementing those two milestones separately.

## Global constraints and decisions

- Preserve the exact demo request: “Buy the Real Madrid 2026 home jersey, player edition, for $25 from Demo Sports Shop.” The fictional store has one product, USD 2500 minor units, and no shipment or live sale.
- Keep the existing `POST /api/orders` manual and legacy simulated demo paths readable and working. Old `SIMULATED_DEMO` cases never become recorded-agent cases retroactively.
- The agent uses **server tools against the controlled product record**; this pilot does not claim it operated a browser or visited an external site. Label the observed action “recorded product lookup,” not “website visit.”
- A model call is evidence that the controlled agent requested a tool. Store/tool results are separate local-source evidence. Only a matching completed `Capture` row plus completed order establishes a completed Sandbox payment.
- `GROQ_API_KEY` stays in root `.env` on the server; no Groq, PayPal, or database secret enters the browser or evidence payload. Send only the fixed demo instruction/product to Groq; do not persist raw model conversation or reasoning in ExhibitA. The key is never required in browser code.
- Keep Express bound to loopback. This is a local pilot without public event ingestion or merchant authentication. Do not deploy it publicly until those boundaries are added.
- Use one version-controlled Prisma migration in private `exhibita`; preserve existing rows and migration history. Enable RLS and revoke `anon`/`authenticated` table grants on the new table, matching existing migrations. No browser Supabase client. Supabase's [current RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [Data API change](https://supabase.com/changelog?types=breaking-change) reinforce keeping this server-only.
- Visual language: ExhibitA's existing white/slate/teal workspace, no purple or copied PayPal chrome. The store uses its own clean retail layout and a conspicuous “Fictional store · Sandbox only” notice. Use an original generic jersey illustration, not an official crest or product photo.
- No generic agent SDK, multiple products, cart, webhook system, AI-written dispute response, or dispute submission in this pilot.

## Review focus

1. A model requests checkout before inspecting the product, or supplies the wrong product/price: reject it; no PayPal order or completed action is recorded.
2. The browser repeats a run request or the model repeats a tool call: one run claim and unique event IDs prevent duplicate PayPal orders/events.
3. Groq or PayPal fails after case creation: the saved case remains inspectable and incomplete, with a safe error; no “Captured” claim.
4. Buyer cancels or a capture is pending: show recorded agent steps and missing payment confirmation without implying a jersey purchase.
5. Old simulated and manual orders have no new events: both views still load and retain their original source labels.

---

### Task 1: Unify the existing case and checkout presentation

**Files:** Modify `apps/web/src/DemoCase.tsx`, `apps/web/src/SavedCase.tsx`, return/cancel views in `apps/web/src/main.tsx`, and `apps/web/src/style.css`.

**Interface:** Presentation and copy only. Preserve the existing request, `/api/orders` parsing, approval/case links, and capture behavior. Keep the current simulated flow functional until Task 4 switches the primary action.

- [ ] Restyle `/demo-case` as one guided request, clearly labeled scripted action, and one primary $25 Sandbox action. Keep result links and errors.
- [ ] Restyle `/cases/:orderId` into a compact header plus request, action, and PayPal facts in source order. Show source and time roles; retain missing-case and legacy manual-order states and the caveat that PayPal does not verify the jersey/shop/agent.
- [ ] Restyle `/return` and `/cancel` with consistent success, pending, failure, and cancellation states. Leave capture logic untouched.
- [ ] Browser-check `/demo-case`, `/cases/:orderId`, `/return`, and `/cancel` at desktop and 390px using completed, pending, and manual fixtures. Check focus, contrast, wrapping, and no horizontal overflow. Run `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build`.
- [ ] Commit `style: unify jersey evidence and checkout screens`.

### Task 2: Make the fictional store a distinct, single-product experience

**Files:** Create `apps/web/src/DemoStore.tsx`, `apps/api/src/demo-store.ts`; modify `apps/web/src/main.tsx`, `apps/web/src/style.css`, `apps/api/src/app.ts`, and `packages/shared/src/index.ts`; test `apps/api/test/demo-store.test.ts`.

**Interfaces:** `GET /api/demo-store/product` returns `{ productId, itemName, edition, shopName, amountMinor: 2500, currency: 'USD' }`. The fixed server catalog is the source for this route and the agent's lookup tool. `/demo-store` renders without the merchant sidebar and links into `/demo-case`; it does not itself place an order.

- [ ] Write an API test for the exact fixed product and `Cache-Control: no-store`; confirm it fails before adding the route.
- [ ] Add the fixed catalog function and route, then make the test pass. Avoid another editable catalog or browser-supplied price.
- [ ] Build `/demo-store` with its own retail shell, one original jersey illustration, product facts, Sandbox disclosure, and a single “Try AI-assisted Sandbox checkout” link to `/demo-case`. Add a small store link from the guided demo.
- [ ] Check desktop and 390px rendering, keyboard access, product/API agreement, and absence of the merchant sidebar. Run typecheck, lint, format, and build.
- [ ] Commit `feat: add fictional demo sports shop`.

### Task 3: Persist source-labeled agent evidence without rewriting legacy cases

**Files:** Modify `prisma/schema.prisma`, `packages/shared/src/index.ts`, `apps/api/src/app.ts`; create one `prisma/migrations/<timestamp>_agent_evidence/migration.sql`; test `packages/shared/test/agent-evidence.test.ts` and `apps/api/test/agent-case.test.ts`.

**Interfaces:** Add `EvidenceEvent { id, orderId, source, kind, externalEventId, occurredAt, recordedAt, payload }` with a unique `(orderId, source, externalEventId)` key and relation to `Order`. `source` is `AGENT_MODEL`, `DEMO_STORE`, or `EXHIBITA_TOOL`; `kind` is `TOOL_REQUEST` or `TOOL_RESULT`. `occurredAt` is when ExhibitA observed the event, not a claimed model-internal time. Add nullable `EvidenceCase.agentRunStatus` (`READY | RUNNING | CHECKOUT_READY | FAILED`) for new cases; null means legacy. Extend `evidenceCaseSchema` with this nullable status and `orderItemSchema` with optional/default-empty `evidenceEvents`. `POST /api/agent-cases` atomically creates a fixed $25 `Order` plus `EvidenceCase` in `READY` state and returns `{ orderId }`; no PayPal call yet. `GET /api/orders/:id` includes events ordered by occurrence and record time.

- [ ] Write failing contract/API tests for new-case creation, fixed values, ordered events, and legacy orders with no events.
- [ ] Add Prisma models/fields and create one forward-only migration with foreign key, unique index, RLS, and grants. Do not reset Supabase or replay old migrations.
- [ ] Add shared event and creation-response schemas. Add the creation/read routes and make the focused tests pass.
- [ ] Validate migration, inspect generated SQL, deploy to the dedicated ExhibitA Supabase project after implementation approval, and query the new table, access settings, and unique event constraint. Run `npm test`, typecheck, lint, and format.
- [ ] Commit `feat: persist recorded agent case events`.

### Task 4: Run one constrained agent against the store and existing checkout

**Files:** Create `apps/api/src/jersey-agent.ts`; modify `apps/api/src/app.ts`, `apps/api/src/config.ts`, `apps/api/src/server.ts`, `apps/api/package.json`, root `package-lock.json`, `.env.example`, and `README.md`; test `apps/api/test/jersey-agent.test.ts` and `apps/api/test/agent-case.test.ts`.

**Interfaces:** `POST /api/agent-cases/:id/run` checks model configuration, then atomically claims `READY -> RUNNING` (otherwise `409`), invokes an injected agent runner, and returns `{ orderId, paypalOrderId, approvalUrl }` only after the model actually calls `inspect_product({ productId })` and then `initiate_sandbox_checkout({ productId, amountMinor })`. The runner's tools read Task 2's fixed catalog and reuse the existing PayPal order creation/idempotency path with the pre-created order's request ID. Each model tool request and sanitized tool result is appended with source, unique call/event ID, occurrence time, and record time; product results use `DEMO_STORE`, checkout results use `EXHIBITA_TOOL`. Success sets `CHECKOUT_READY`; errors set `FAILED` and return a safe message. A failed case is not retried; the user can start a new case.

- [ ] Add `GROQ_API_KEY` and optional `GROQ_MODEL` to server config and `.env.example`; install only the official `groq-sdk`. Missing key returns a clear `503`, leaving manual checkout available.
- [ ] Write failing runner/API tests using a fake model and fake PayPal client for the required two tool calls, wrong product/amount, checkout-before-inspection, repeated run/call, model refusal/timeout, and PayPal failure. Assert no duplicate payment and no secret/raw conversation in event payloads.
- [ ] Implement a bounded Groq Chat Completions local-tool loop (at most four model/tool steps and a 45-second run deadline) with strict tool argument validation, `parallel_tool_calls: false`, and no built-in browser, code, shell, or remote tools. Append the assistant's returned `tool_calls` and corresponding `role: 'tool'` results to the in-memory message list; persist only sanitized evidence events. Record the actual calls/results as they occur; never synthesize success events afterward.
- [ ] Extract only the shared PayPal create-and-update step needed by both existing and agent order paths; preserve its amount validation, fixed callback URLs, request ID, and current manual/simulated behavior. Run focused tests, then all tests/typecheck/lint/format/build.
- [ ] Commit `feat: record constrained jersey agent run`.

### Task 5: Join the storefront, agent trace, and Sandbox capture in one reviewable case

**Files:** Modify `apps/web/src/DemoCase.tsx`, `apps/web/src/SavedCase.tsx`, `apps/web/src/main.tsx`, `apps/web/src/style.css`, `packages/shared/src/index.ts`, and `README.md`; add focused API/contract tests only where the new state logic needs them.

**Interfaces:** The guided demo creates a case, receives `orderId`, runs that case, then shows its approval link and saved-case link. The saved case renders preset instruction, actual tool requests/results, store product snapshot, local order, and PayPal capture in source order. `SIMULATED_DEMO` legacy cases remain explicitly scripted; manual cases remain payment-only. The return/cancel routes link back to the same case ID.

- [ ] Change the primary `/demo-case` action to “Run recorded agent Sandbox test,” with visible preparation, product lookup, checkout-ready, failed, and missing-key states. Keep the saved-case link available as soon as case creation returns.
- [ ] Render event rows with source, event ID, observed time, and recorded time. Compare only item, edition, shop, USD 2500 amount, and completed-capture state; show missing/mismatch text without an AI-authored verdict. Label the instruction “demo-submitted” and never claim buyer identity is verified.
- [ ] Keep success dependent on `isCaseCaptureComplete(order)`. Verify cancelled, failed, pending, legacy simulated, and manual orders cannot display a completed purchase claim.
- [ ] Browser-check store, demo, saved case, return, and cancel at desktop and 390px. Check no purple, no overflow, keyboard focus, readable source labels, and one consistent Sandbox disclosure.
- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run db:validate`, and `npm run build`. With a server-side Groq key and Sandbox buyer account, perform one live local agent run, buyer approval, and direct database check that instruction, actual events, product snapshot, order, and completed capture share the case ID. Confirm a cancelled/failed run remains incomplete. If credentials are unavailable, report the live check as unverified rather than treating mocks as proof.
- [ ] Update `docs/STATUS.md` with observed evidence and limits; commit `feat: show recorded jersey evidence journey`.

## Done when

One completed $25 case lets a merchant inspect the demo-submitted instruction, real model tool requests, the controlled store's returned product, the PayPal Sandbox order and capture, and any missing or conflicting fact. Historical simulated cases remain simulated; manual orders still work. A cancelled, failed, or pending case never claims a completed purchase. The full journey works locally at desktop and mobile widths and all required checks pass.

**User-side prerequisite for the live pilot:** Put your valid Groq API key in local `.env` as `GROQ_API_KEY` and use a PayPal Sandbox buyer account for approval. Do not send either credential in chat. Groq usage may be subject to your account's limits or charges. The implementation can be built and mock-tested without the key, but the live agent run cannot be verified until it is configured.
