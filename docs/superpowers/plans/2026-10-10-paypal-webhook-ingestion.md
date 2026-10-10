# PayPal Sandbox Webhook Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (if selected) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Receive cryptographically verified PayPal Sandbox events, persist one minimized receipt per event, and add matched events to the local order evidence timeline.

**Architecture:** A dedicated verifier checks PayPal's signature against the exact raw request body and a safely fetched Sandbox certificate. An unauthenticated webhook route verifies first, then transactionally writes a globally deduplicated receipt and, when an order matches, a `PAYPAL` evidence event. Webhooks do not change payment or order status.

**Tech Stack:** Node.js 24, TypeScript, Express 5, Node `crypto`, Prisma 7, PostgreSQL/Supabase, Vitest, Render.

**Spec:** `docs/superpowers/specs/2026-10-10-paypal-webhook-ingestion-design.md`

## Global Constraints

- Accept PayPal Sandbox events only; retain the current synchronous capture flow as the payment-state source.
- Verify against the original raw request bytes before parsing or writing any event data.
- Fetch certificates only from HTTPS PayPal Sandbox certificate endpoints; reject redirects and bound the fetch time.
- Never store full webhook bodies or personal data; keep only normalized event fields and safe status/amount details.
- Deduplicate globally by PayPal event ID; persist unmatched verified receipts and attach them when a later delivery can be linked.
- Keep webhook storage in private schema `exhibita`, with RLS enabled and direct `PUBLIC`, `anon`, and `authenticated` access revoked.
- Return 2xx only after the verified event is durably stored or already stored; fail closed when configuration or persistence is unavailable.

## Review Focus

- Raw-body whitespace/field changes invalidate signatures; test altered body rejects before database access.
- A hostile `paypal-cert-url` cannot reach arbitrary hosts or redirect; test disallowed host, path, and redirect.
- Event delivery repeats or first arrives before its local order mapping; test global dedupe and later attachment.
- Missing webhook ID or database failure must return retryable 503 rather than acknowledge lost evidence; test both.
- Malformed envelope or unexpected resource shape must not create timeline evidence or persist personal fields; test schema rejection and payload minimization.

---

### Task 1: PayPal raw-body signature verifier

**Files:**

- Create: `apps/api/src/paypal-webhook.ts`
- Test: `apps/api/test/paypal-webhook.test.ts`

**Interfaces:** `PayPalWebhookVerifier.verify(rawBody: Buffer, headers: PayPalSignatureHeaders, webhookId: string): Promise<boolean>`. `PayPalSignatureHeaders` contains `transmissionId`, `transmissionTime`, `certUrl`, `authAlgo`, and `transmissionSig`. Verify `transmissionId|transmissionTime|webhookId|crc32` (decimal CRC32 of the original bytes) using RSA-SHA256. Permit only HTTPS `api.sandbox.paypal.com` or `api-m.sandbox.paypal.com` certificate paths under `/v1/notifications/certs/`; return `false` for an invalid signature and throw a sanitized error when certificate retrieval is unavailable.

- [ ] **Step 1: Add failing signature tests** for a valid RSA-SHA256 signature over PayPal's transmission message, a body altered after signing, unsupported algorithm, a disallowed certificate host/path, a redirect, fetch failure, and repeated verification reusing the cached certificate.
- [ ] **Step 2: Run** `npm test -- apps/api/test/paypal-webhook.test.ts`; confirm the verifier imports fail because the module is absent.
- [ ] **Step 3: Implement `PayPalWebhookVerifier`** using Node `crypto`, raw-body CRC32, HTTPS Sandbox certificate host/path allowlisting, `redirect: 'error'`, a bounded timeout, and an in-memory certificate cache with bounded lifetime. Do not add a dependency for CRC32.
- [ ] **Step 4: Run** `npm test -- apps/api/test/paypal-webhook.test.ts`; expect all cryptographic and URL-safety tests to pass.
- [ ] **Step 5: Commit** the verifier and its tests as `feat: verify PayPal webhook signatures`.

### Task 2: Durable receipt schema

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261010120000_paypal_webhook_events/migration.sql`
- Verify: generated Prisma client under `apps/api/src/generated/prisma/`

**Interfaces:** `PayPalWebhookEvent` has `paypalEventId String @unique @db.VarChar(120)`, `eventType String @db.VarChar(120)`, `resourceType String @db.VarChar(80)`, `resourceId String @db.VarChar(120)`, nullable `paypalOrderId String? @db.VarChar(64)`, `occurredAt`, `verifiedAt`, `recordedAt`, nullable `orderId String? @db.Uuid` with an optional `Order` relation, and minimized `payload Json @db.JsonB`. `EvidenceEvent` accepts source `PAYPAL` and kind `PAYPAL_WEBHOOK`; matched timeline events use the PayPal event ID as `externalEventId`.

- [ ] **Step 1: Add schema declarations and the additive SQL migration** for the receipt model and `Order` relation, extend the evidence source/kind constraints, and create a unique PayPal timeline-event index. Enable RLS and revoke direct `PUBLIC`, `anon`, and `authenticated` grants on the receipt table.
- [ ] **Step 2: Run** `npm run db:validate` and `npm run db:generate`; expect Prisma schema validation and client generation to pass.
- [ ] **Step 3: Review migration SQL** for additive-only behavior, `ON DELETE SET NULL` on an optional order link, global event-ID uniqueness, and private-table grants/RLS.
- [ ] **Step 4: Commit** schema and migration as `feat: persist PayPal webhook receipts`.

### Task 3: Public verified webhook route

**Files:**

- Create: `apps/api/src/paypal-webhook-event.ts` for envelope validation, order-ID extraction, and privacy-minimized payload mapping.
- Modify: `apps/api/src/app.ts` for the raw-body route before JSON parsing and bearer-auth middleware.
- Modify: `apps/api/src/config.ts` and `apps/api/src/server.ts` for optional `PAYPAL_WEBHOOK_ID` and verifier wiring.
- Modify: `.env.example`, `render.yaml`, and `docs/PAYPAL_SETUP.md` for server-only configuration and setup steps.
- Test: `apps/api/test/paypal-webhook.test.ts`

**Interfaces:** `parsePayPalWebhookEvent(rawBody: Buffer)` validates and returns normalized fields: `paypalEventId`, `eventType`, `resourceType`, `resourceId`, optional `paypalOrderId`, `occurredAt`, and minimized JSON payload. `createApp` accepts an injected verifier with the Task 1 interface for isolated route tests.

- [ ] **Step 1: Add failing route tests** for no bearer token required, missing ID returns 503, missing/malformed headers or invalid signature return 400 without DB writes, database failures return 503, and valid events return minimal acknowledgements.
- [ ] **Step 2: Add failing persistence tests** for matched receipt plus timeline event in one transaction, unmatched receipt retention, replay deduplication, and later matched delivery linking the existing receipt without duplicate evidence. Assert stored JSON excludes buyer/seller emails and full resource payloads.
- [ ] **Step 3: Implement envelope normalization** for `CHECKOUT.ORDER.*` events and resource `supplementary_data.related_ids.order_id`; if an event has only a capture resource ID, resolve it through the existing `Capture.paypalCaptureId` relation.
- [ ] **Step 4: Implement `POST /api/paypal/webhook`** using `express.raw({ type: 'application/json', limit: '256kb' })` before `express.json()`. Verify raw bytes before parsing, fail closed when ID/verifier/database is missing, and transactionally upsert the receipt plus matched timeline event.
- [ ] **Step 5: Configure the server-only webhook ID** in the parsed runtime config and Render Blueprint; keep it optional so existing deployments start with the endpoint safely disabled until a Sandbox webhook is registered.
- [ ] **Step 6: Update PayPal setup docs** with `https://exhibita.onrender.com/api/paypal/webhook`, the Sandbox-only warning, and the exact recommended events: `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.DENIED`, and `PAYMENT.CAPTURE.REFUNDED`.
- [ ] **Step 7: Run** `npm test -- apps/api/test/paypal-webhook.test.ts`; expect signature, route, privacy, duplicate, and unmatched-order cases to pass.
- [ ] **Step 8: Commit** route and setup changes as `feat: receive verified PayPal webhook events`.

### Task 4: Release and Sandbox handoff

**Files:**

- Verify: full repository and production deployment.
- Update if needed: `docs/STATUS.md` and `docs/PAYPAL_SETUP.md`.

**Interfaces:** Render continues to deploy `origin/main`; the webhook ID is supplied separately after the user registers the Sandbox listener and is never stored in the repository or frontend.

- [ ] **Step 1: Run full checks** with `npm test`, `npm run lint`, `npm run typecheck`, `npm run db:validate`, and `npm run build`; expect all tests, static checks, and production builds to pass.
- [ ] **Step 2: Push the approved implementation to `main`** and monitor Render's automatic deployment; confirm the additive migration applies and `/api/health` remains 200.
- [ ] **Step 3: Verify the deployed listener** fails closed with 503 while `PAYPAL_WEBHOOK_ID` is unset and does not write on invalid requests.
- [ ] **Step 4: Hand off registration**: user adds `https://exhibita.onrender.com/api/paypal/webhook` to the PayPal Sandbox app, selects the five documented events, and provides the generated non-secret webhook ID. Set only that ID in Render and redeploy.
- [ ] **Step 5: Verify an actual Sandbox event** after the webhook is registered: return 2xx to PayPal, confirm one durable receipt, and for a matched order confirm one `PAYPAL` timeline event; replay the same event and confirm counts do not change.

## Self-review

- Spec coverage: Tasks 1–4 cover raw-body signature verification, Sandbox certificate safety, durable minimized receipts, matched and unmatched events, global dedupe, privacy, private-schema protections, endpoint responses, configuration, deployment, and the required user-side ID step. Order/capture mutation, simulator test-ID mode, UI changes, and live PayPal are explicitly excluded.
- Step scan: Every task names files, interface or output, a focused test, implementation, and verification/commit. The plan keeps test boundaries explicit and does not ask the implementer to guess required field names or response codes.
- Type consistency: `PayPalSignatureHeaders`, `PayPalWebhookVerifier.verify`, normalized event fields, `PayPalWebhookEvent`, and `PAYPAL_WEBHOOK` are used consistently across tasks.
- Review focus: Each of the five failure classes maps to tests in Tasks 1 or 3.
- Proportion: Four tasks follow verifier, database, API integration, and deployment boundaries; no UI or order-state work is added.
