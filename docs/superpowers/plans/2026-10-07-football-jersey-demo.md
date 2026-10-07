# Football Jersey Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a clearly simulated example in which an agent follows the buyer's exact $25 jersey request.

**Architecture:** Keep the fixture and page in the frontend. Add one route and navigation link; leave the API, Supabase schema, PayPal flow, and recorded orders untouched.

**Tech Stack:** React, TypeScript, React Router, existing Tailwind CSS and Lucide icons.

**Spec:** `docs/superpowers/specs/2026-10-07-football-jersey-evidence-design.md`

## Global Constraints

- Buyer instruction: “Buy the Real Madrid 2026 home jersey, player edition, for $25 from Demo Sports Shop.”
- Demo Sports Shop is fictional. Label the page and agent action **Simulated example**.
- The example is unrelated to the existing $0.01 PayPal capture and must not appear in the orders list.
- Add no database tables, API routes, seed commands, dependencies, or $25 PayPal transaction.
- Do not imply actual agent telemetry, a completed purchase, persistent evidence, AI analysis, or dispute readiness.

## Review Focus

- Direct navigation to `/demo-case` renders the example without depending on database readiness.
- The buyer instruction and simulated action name the same jersey, edition, store, and $25 price.
- Simulation labels remain visible on a narrow mobile viewport.
- The page contains no PayPal order or capture IDs and does not change the real orders list.
- Returning to the dashboard leaves the existing payment flow usable.

---

### Task 1: Add the read-only demo page

**Files:**

- Create: `apps/web/src/DemoCase.tsx`
- Modify: `apps/web/src/main.tsx`

**Interfaces:**

- `DemoCase.tsx` exports `DemoCase(): JSX.Element` (or an inferred React component return type).
- `main.tsx` registers `Route path="/demo-case"` and a sidebar link labeled `Simulated case`.

- [ ] **Step 1: Check the baseline.** Open `/demo-case` locally; it currently shows the not-found route.
- [ ] **Step 2: Implement `DemoCase` as a static page.** Show the exact buyer instruction, a matching simulated agent checkout, a two-step timeline, a simple requested-versus-action match, and a link back to the dashboard. Keep all copy in this component; use existing layout and styling patterns.
- [ ] **Step 3: Register the route and navigation link.** Change only the route/sidebar area of `main.tsx`; do not add the case to order-fetching code or payment totals.
- [ ] **Step 4: Run checks.** Run `npm run typecheck --workspaces --if-present`, `npm run lint`, `npm run format:check`, and `npm run build -w @exhibita/web`; each must exit 0.
- [ ] **Step 5: Browser-check the Review Focus.** Open `/demo-case` directly, verify all five focus points including a narrow viewport, then return to `/` and confirm the real orders are unchanged.
- [ ] **Step 6: Commit only the page and route changes.** Use a commit message describing the simulated jersey case.
