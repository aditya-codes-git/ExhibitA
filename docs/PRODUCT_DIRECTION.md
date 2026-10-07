# ExhibitA product direction

## What we are building

ExhibitA is a **merchant-side evidence workspace for AI-assisted purchases**. It joins a buyer's available instructions, the actions an agent actually took, merchant order facts, and PayPal payment facts into one case. Every claim shows its source and time. When the sources disagree or a fact is missing, the case says so instead of filling the gap with an AI guess.

The merchant's job is to understand what happened and prepare a well-supported response when a customer questions a transaction. ExhibitA should shorten that investigation and help the merchant assemble a reviewable evidence packet. AI may summarize and organize evidence, but each material sentence must link back to records a person can inspect. The merchant remains responsible for the response.

This is not a payment processor, an autonomous shopping agent, a way to prove an unseen buyer prompt from a PayPal capture, or a promise to win disputes. PayPal confirms payment facts; an agent integration can provide action facts; a merchant system can provide product and fulfillment facts. Their trust levels must stay distinct.

## Where we are now

The current local demo stores a preset $25 jersey request, a clearly labeled `SIMULATED_DEMO` action, and a completed PayPal Sandbox capture in Supabase. That proves the payment and persistence flow, but **not** that an external agent visited a store or bought a jersey. The [frontend refresh plan](superpowers/plans/2026-10-08-frontend-refresh.md) makes this evidence boundary easier to see. It does not add new sources.

## The next implementation after the frontend refresh

Build **one genuine agent-activity evidence pilot** for the same jersey story. The store and jersey sale are fictional, while the agent interaction, evidence recording, and PayPal Sandbox API/approval/capture flow actually run. PayPal calls this a mock transaction in a virtual test environment, not a live payment ([Sandbox guide](https://developer.paypal.com/sandbox-testing/overview/)). Keep the pilot narrow:

1. Build a tiny Demo Sports Shop page with the specified Real Madrid 2026 home jersey, player edition, at $25 and a clear checkout handoff. This is a controlled fictional store for the demonstration; it does not sell or ship a jersey.
2. Give a constrained AI agent the detailed buyer request. Let it inspect the demo product and initiate the existing PayPal Sandbox order through recorded tools. Capture the tool requests/results automatically as the agent acts; do not hand-author a timeline after the fact. The buyer still approves the Sandbox payment.
3. Link the instruction, agent tool events, merchant product snapshot, local order, and PayPal order/capture by one case ID. Store source, external/event ID, occurred time, recorded time, and a small relevant payload for each event. Deduplicate retries. Never put credentials, payment details, or raw private conversation history into the evidence record.
4. Show the actual sequence in the saved case. Compare only concrete fields—item, edition, shop, amount, and final capture state. Mark the instruction as demo-submitted unless its authorship is independently verified. If an action is missing or differs, show that gap plainly.

**Done when:** a merchant opens one completed $25 case and can inspect the original demo instruction, actual recorded agent tool calls on our fictional store, the product selected, and the PayPal Sandbox capture with source labels. A cancelled or failed run remains an incomplete case, not a completed purchase. Existing manual orders still work. The UI must say “Sandbox test purchase,” never “real jersey purchased.”

This pilot should run locally with one controlled agent and one product. It does not need a generic agent SDK, multiple stores, a public ingestion endpoint, an LLM-written dispute response, or an automated dispute submission. Those would obscure whether the core evidence chain is trustworthy.

## Path from pilot to product

1. **Reliable evidence intake.** Add merchant authorization before public access. Accept consented agent-platform/merchant events through authenticated integrations, capture product/price and fulfillment records, verify PayPal webhooks, and reconcile event ordering and duplicates. PayPal's [webhook guidance](https://developer.paypal.com/api/rest/webhooks) requires authenticity verification; a received POST alone is not a trusted payment fact.
2. **Evidence analysis.** Compare the buyer's available constraints with observed actions and payment/fulfillment facts. Generate a concise, cited summary, missing-evidence list, and conflict list. Separate facts from inferences and require merchant review.
3. **Dispute workspace.** Match a case to a dispute, map available documents and facts to the dispute's requested evidence, and prepare a merchant-approved packet. PayPal documents a [Disputes API evidence flow](https://developer.paypal.com/platforms/disputes/handle-disputes/use-disputes-api/); test account eligibility and Sandbox behavior before promising direct submission.
4. **Production trust.** Add tenant isolation, least-privilege access, retention/deletion controls, audit history, source verification, monitoring, and deployment. Measure whether merchants can reconstruct cases faster and whether AI-written claims remain traceable to evidence.

PayPal's [agentic commerce services](https://developer.paypal.com/agentic-commerce-services/about/) may become useful evidence sources, but their access requires onboarding. ExhibitA should complement those commerce flows, not duplicate their catalog or checkout features.

## Product test

For any case, a merchant should be able to answer four questions without guessing: **What was requested? What did the agent demonstrably do? What did the merchant and PayPal record? What is still unknown?** If the interface cannot answer those with source-linked records, a polished summary is premature.
