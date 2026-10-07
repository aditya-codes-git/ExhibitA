# ExhibitA architecture

ExhibitA helps merchants reconstruct AI-assisted purchases from records with explicit provenance. PayPal responses, merchant statements, independently captured agent activity, simulated activity, and AI inferences must remain distinguishable. A hash detects changes; it does not prove that the original record was truthful or complete.

## Decisions

- React, Vite, TypeScript, Tailwind CSS, React Router, and Lucide for the web application.
- Node.js, Express, TypeScript, and REST for a modular monolith.
- **Supabase-hosted PostgreSQL**, explicitly selected by the user on 2026-10-05. Dedicated project `coponziasrruazpxsgyy` was created in Hackathon, Mumbai, after the user authorized pausing `merchant-growth-ai` to free a project slot.
- Prisma owns the application schema and version-controlled migrations. The Express backend accesses the database; the browser does not receive database credentials or service-role keys.
- npm workspaces: `apps/web`, `apps/api`, and `packages/shared`.
- A provider-independent AI adapter with schema-validated, evidence-referenced results will be added after the payment and evidence flow works. No provider selected yet.

## First increment

Create a runnable web/API foundation with health and readiness checks, environment validation, shared schemas, and initial merchant/order/capture tables. The web page displays actual API readiness and the next setup steps. Missing credentials must not produce a false connected status.

Implement a Sandbox-only PayPal client behind the API boundary and test its authentication and request behavior with explicitly mocked HTTP responses. Do not expose payment mutation routes until persistence, ownership, idempotency, and the buyer approval flow are connected.

Initial tables use the private `exhibita` schema, not a browser-exposed API schema. Keep Row Level Security enabled as defense in depth; an intentionally scoped backend database role will need appropriate privileges. Avoid modifying existing Supabase projects or shared schemas.

## Payment increment after the foundation

Persist a local order and stable operation IDs before calling PayPal. Create a Sandbox order server-side, redirect the buyer through approval, and capture through a protected API operation. Validate amount, currency, merchant ownership, and provider responses. Retry an uncertain request using the same PayPal request ID, then reconcile with PayPal before allowing another operation. Persist the capture ID and status atomically with the corresponding evidence event.

Use a server-selected demonstration product and price initially. A return URL parameter is not payment confirmation. Only verified PayPal API responses or verified webhook events can advance payment state.

## Later increments

1. Add agent sessions and evidence records with occurrence and ingestion timestamps, source, external ID, and verification state.
2. Verify webhook signatures; deduplicate by external event ID and tolerate event reordering.
3. Add evidence-grounded AI analysis and merchant review of supported claims.
4. Test dispute operations against the actual Sandbox account and document limitations.
5. Add merchant authentication and authorization before exposing transaction data; finish demo and submission requirements.

## Verification boundaries

Compilation, mocked HTTP tests, database execution, real Sandbox operations, and deployed verification are separate evidence categories. Neither configured credentials nor a successful build establishes a working payment integration.
