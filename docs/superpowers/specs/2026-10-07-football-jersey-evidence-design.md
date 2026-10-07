# Football jersey evidence case

## Purpose and boundary

Add ExhibitA's first inspectable agent-evidence case. The buyer's instruction is “Buy me a football jersey.” In the fictional scenario, an agent selects a Real Madrid 2026 home jersey, player edition, priced at $25 from a fictional demo shop. The case demonstrates how a merchant can inspect the instruction, the agent's choice, and unanswered questions.

This is a **simulated case**, not a PayPal transaction. It must not be attached to the existing $0.01 Sandbox capture or presented as proof that a jersey was bought or delivered. No new PayPal order or capture is part of this increment.

## Data and provenance

Keep the case in Supabase's private `exhibita` schema, separate from `Order` and `Capture`. A minimal `EvidenceCase` stores a stable ID, the default demo merchant ID, title, `SIMULATED` classification, instruction text, selected item text, selected price in integer USD cents, fictional seller label, and creation time. `EvidenceEvent` stores its case ID, event type, short description, source label, occurrence time, and ingestion time. Event types for this case are buyer instruction, agent selection, and simulated checkout. Every displayed event must visibly say that its source is a demo scenario; timestamps are generated when the case is seeded and are not claimed as historical buyer or agent telemetry.

An idempotent server-side seed command creates this one case and its events with stable IDs. Re-running it does not duplicate evidence. The seed never modifies PayPal orders or captures. The API offers read-only case and event endpoints for the local dashboard. No browser write endpoint is needed for this first slice.

## Review logic and interface

The case page shows the instruction and selection side by side, then a timestamped event list with source labels. It shows four **review questions**: the buyer did not specify a team, edition, size, or spending limit. These are missing constraints in the example, not findings of agent misconduct or payment fraud. The $25 price is a scenario value, not a verified charge.

Use straightforward, deterministic text for this one case. Do not call it an AI summary or infer buyer intent from the sparse prompt. The existing dashboard links to the case and labels it “Simulated evidence case.” Keep the current PayPal order list separate, with its verified capture data unchanged.

## Failure handling and safety

If the database is unavailable or the case has not been seeded, show a clear unavailable/empty state; do not substitute fabricated live data. Validate API output and seed input. Keep `exhibita` private with RLS enabled and no browser grants. The API remains loopback-only and unauthenticated for local demonstration; the case must not be exposed publicly until merchant authorization is implemented. Do not put secrets, real buyer identities, or a real store URL in the fixture.

## Verification

Run the seed twice and verify one case and exactly three events. Read the case through the API and page, confirming the simulated labels, $25 amount, four review questions, and absence of a PayPal capture link. Re-run tests, lint, type checking, and the production build. Confirm the existing $0.01 PayPal order and capture are unchanged. This verifies the demo evidence slice, not independent agent telemetry, AI analysis, or dispute submission.
