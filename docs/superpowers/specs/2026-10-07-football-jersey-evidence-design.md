# Football jersey demo case

## Purpose

Show the simplest possible example of a buyer instruction and the agent action that followed it. The buyer gives a specific request: “Buy the Real Madrid 2026 home jersey, player edition, for $25 from Demo Sports Shop.” Demo Sports Shop is fictional. In the example, the agent follows that request exactly; it does not choose the team, jersey, edition, or price independently.

## Scope and presentation

Add one read-only demo page to the existing frontend. It shows two steps: the buyer's exact instruction and a simulated agent checkout for the same item and price. Label the whole page and the agent step **Simulated example**. Show a simple side-by-side match between requested item/price and simulated action. There are no missing-constraint flags, dispute conclusions, or AI-generated claims in this example.

Keep the case as a local frontend fixture. This example does not need new Supabase tables, API endpoints, seed commands, or a real $25 PayPal Sandbox payment. It is not linked to the existing $0.01 completed capture. The existing payment dashboard and records remain unchanged. A link from the dashboard may open the demo page, but the demo must never appear among verified orders or captures.

## Verification and limits

Check that the page renders the exact request, the matching simulated action, the $25 amount, and visible simulation labels. Confirm that it shows no PayPal order or capture ID. Run the frontend TypeScript and production build checks. This demonstrates the intended evidence presentation only; it does not establish actual agent telemetry, a completed jersey purchase, persistent evidence, AI analysis, or dispute readiness.
