# ExhibitA Frontend Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing ExhibitA merchant UI feel like a focused, premium evidence SaaS workspace while preserving every working Sandbox flow.

**Architecture:** Redesign the existing React pages and CSS in place. Keep the current routes, API calls, data contracts, and PayPal checkout behavior; change visual hierarchy, navigation, typography, spacing, status presentation, and responsive layout. No component library or new dependency.

**Tech Stack:** React 19, React Router, Tailwind CSS 4, existing `lucide-react`, Vite.

**Spec:** `docs/superpowers/specs/2026-10-07-jersey-evidence-flow-design.md` supplies evidence and payment truth boundaries; the visual brief below is specific to this refresh.

## Visual brief

The screenshot's clear sidebar and readable data are worth keeping. ExhibitA should no longer resemble a PayPal developer account: the primary object is an **evidence case**, while PayPal is one source within it. Use a quiet workspace: off-white canvas `#F7F9FA`, white surfaces, ink `#102A33`, muted text `#61717B`, border `#DDE5E8`, and restrained petrol/teal action color `#0B5863` with a soft tint `#E6F3F3`. Use green, amber, and red only for their actual status meanings. No purple, gradients, glass effects, decorative charts, or circular quick-action icons. Use the system font stack and existing icons.

The overview should answer, in order: **What cases/orders need attention? What was captured? Is the Sandbox ready?** Put recent records above the manual purchase form. Keep the $25 jersey demo prominent as the guided example, but label its agent step as simulated everywhere. Use real API data only; the three summary numbers remain scoped to the latest 20 returned orders.

## Global constraints

- Frontend-only scope: no API, database, payment, or route contract changes; preserve `/`, `/demo-case`, `/cases/:orderId`, `/return`, and `/cancel`.
- Preserve manual order creation, fixed $25 demo creation, approval links, capture on return, cancellation, refresh, and all loading/error states.
- A completed visual state requires a completed order **and** completed capture via existing `isCaseCaptureComplete`; readiness alone never means a payment succeeded.
- Clearly distinguish preset buyer request, `SIMULATED_DEMO` action, and PayPal Sandbox capture. Do not imply a real jersey purchase or external agent telemetry.
- Keep the mobile navigation usable, keyboard focus visible, contrast readable, and long IDs/instructions wrapping without horizontal scrolling.
- No new package, font download, backend endpoint, generic design-system framework, or fabricated metric.

## Review focus

- At 390px width, all navigation destinations remain reachable and the page has no horizontal overflow.
- With no orders, the overview shows a truthful empty state and zero counts; while loading or after an API failure, it shows unknown values rather than misleading zeros.
- A local order marked completed without a completed capture never receives a “Captured” badge.
- Long local/PayPal IDs and the full jersey instruction remain readable on desktop and mobile.
- Sandbox and simulated labels remain visible on the relevant pages; no purple styling survives.

## File map

- `apps/web/src/style.css`: small set of color/spacing primitives, shell, responsive navigation, and shared visual treatments.
- `apps/web/src/main.tsx`: app shell, overview hierarchy, recent orders, manual purchase, readiness, and return/cancel presentation.
- `apps/web/src/DemoCase.tsx`: guided example and start-test presentation.
- `apps/web/src/SavedCase.tsx`: evidence-first case detail and provenance/status presentation.

### Task 1: Give ExhibitA its own shell

**Files:** Modify `apps/web/src/style.css` and the `App`/`WorkspaceStrip` portion of `apps/web/src/main.tsx`.

**Interface:** Keep existing routes and link targets. Replace the purple Sandbox strip with a compact neutral/teal environment indicator; keep the Sandbox warning in readable text. Use a smaller, quieter sidebar with ExhibitA branding and an active state distinct from PayPal blue. At widths below 900px, expose the same navigation as a compact horizontal row rather than hiding it.

- [ ] Establish the exact palette above as CSS variables or Tailwind theme tokens in `style.css`; apply one consistent type scale, 8–12px radius, subtle borders, and restrained shadows. Remove the existing purple and PayPal-like blue shell treatments.
- [ ] Update sidebar/topbar copy and spacing to identify **ExhibitA / Evidence workspace / Sandbox**. Keep links to overview, demo case, purchase, orders, and integrations; show active route and visible keyboard focus.
- [ ] Inspect `/` and `/demo-case` at desktop, 768px, and 390px. Verify every destination is reachable by keyboard and touch, no purple remains, and no horizontal overflow occurs.
- [ ] Run `npm run typecheck`, `npm run lint`, and `npm run format:check`; commit `style: establish ExhibitA workspace shell`.

### Task 2: Make the overview evidence-first

**Files:** Modify `Dashboard` and `StatusBadge` in `apps/web/src/main.tsx`, plus only the CSS needed in `style.css`.

**Interface:** Reuse the existing `/api/readiness`, `/api/orders`, `refreshOrders`, and manual-order handler. Preserve the latest-20 scope and currency formatting. Change `StatusBadge` to consume the order, using existing `isCaseCaptureComplete(order)` for “Captured”; pending and error remain distinct.

- [ ] Replace the large hero plus duplicate circular quick-access row with a compact page header: “Transaction evidence,” a one-line purpose, and one primary action to open the $25 guided demo.
- [ ] Keep the three real summary values but reduce their visual weight and label them “Latest 20 orders,” “Captured orders,” and “Captured amount · USD” so they cannot be mistaken for all-time totals.
- [ ] Place recent orders immediately after the summary. Render a scannable record row/card with amount, case type (jersey demo or manual order), capture-aware status, created time, and “View record.” Keep refresh, empty, loading, and error states; allow long IDs to wrap or stay behind the detail link.
- [ ] Move the manual Sandbox purchase form below the records as a secondary tool. Compress integration readiness into a clear status section beneath it; retain the existing recheck control and configuration/error guidance.
- [ ] Verify populated, empty, pending, and error states at desktop and 390px. Specifically check that an order without a completed capture never says “Captured.” Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run format:check`; commit `style: prioritize evidence on overview`.

### Task 3: Unify case and checkout states

**Files:** Modify `apps/web/src/DemoCase.tsx`, `apps/web/src/SavedCase.tsx`, return/cancel views in `apps/web/src/main.tsx`, and necessary `style.css` rules.

**Interface:** Keep the same request text, fixed demo identifier, API parsing, links, and capture logic. Only presentation and copy may change. Never promote a simulated action or pending payment into verified evidence.

- [ ] Present `/demo-case` as one guided example with a readable buyer request, clearly marked scripted action, and a single strong “Start $25 Sandbox test” action. Keep the saved-order and PayPal approval links plus errors.
- [ ] Present `/cases/:orderId` as an evidence record: compact header with status, then request, simulated action, and payment facts in source order. Give each step a source label and timestamp role; keep the note that PayPal does not verify the product/shop/agent. Preserve legacy manual-order and missing-case states.
- [ ] Restyle `/return` and `/cancel` to use the same status colors, spacing, buttons, and wording. Keep success, pending, error, and cancellation visibly different; do not change capture behavior.
- [ ] Browser-check all five routes at desktop and 390px using the existing completed $25 case plus a pending/manual order. Confirm focus, contrast, wrapping, no horizontal overflow, and no purple. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build`; commit `style: unify evidence and checkout views`.

## Done when

The merchant can scan real recent cases first, open the completed jersey record, and immediately tell preset input from simulated activity and confirmed Sandbox payment. The UI works at desktop and mobile widths, all existing workflows still pass, and the styling has no purple or PayPal-page imitation.

**Next milestone:** After this refresh, follow the genuine agent-activity pilot in [`docs/PRODUCT_DIRECTION.md`](../../PRODUCT_DIRECTION.md). The frontend work must not pre-label simulated events as real in anticipation of it.
