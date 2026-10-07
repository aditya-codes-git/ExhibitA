# Supabase setup

## Selected project

- Name: ExhibitA
- Organization: Hackathon
- Region: Mumbai (`ap-south-1`)
- Reference: `coponziasrruazpxsgyy`
- [Dashboard](https://supabase.com/dashboard/project/coponziasrruazpxsgyy)
- Supabase reported $0/month for provisioning on the selected free plan.

The first creation attempt hit the account's two-active-free-project limit. The user explicitly authorized pausing `merchant-growth-ai`; it was paused and ExhibitA was created successfully. `sih26` was not modified.

## Configure the application connection

1. Copy the root `.env.example` to `.env` if it does not already exist.
2. In ExhibitA's dashboard, open **Connect** and copy its **session pooler** PostgreSQL URI (port 5432). Use the actual host and user shown; do not construct them from the project reference.
3. Fill `DATABASE_URL` locally with that URI and the database password. Percent-encode special characters in the password. Use TLS as described by the Connect dialog. Never paste the password or URI into chat.
4. Optionally put a separate direct or session-mode migration URI in `DIRECT_URL`; otherwise migrations use `DATABASE_URL`. Transaction-pooler port 6543 is not a migration connection.
5. Restart `npm run dev`. `/api/readiness` queries `SELECT 1` through Prisma. Only a successful query reports `connected`.

Do not use the Supabase publishable key or service-role API key as a database password. This foundation does not use the Supabase browser SDK, Auth, or Storage. Before production, provision a dedicated backend role with explicit privileges and design merchant authorization. An administrative connection is acceptable only for initial developer setup, and must stay server-side.

## Migrations

Prisma migration history is initialized on the dedicated ExhibitA project. The initial migration, `20261007180918_evidence_case`, and `20261008001005_fix_evidence_case_action_pair` are applied. The second adds only the private `exhibita."EvidenceCase"` table and its relation to Order; the third closes a null-handling gap in its source/time constraint. For later migrations, run `npm run db:deploy` with the configured server-side connection. Do not run `prisma migrate resolve` again on this project.

The migration targets Supabase and references its built-in `anon` and `authenticated` roles. It is not a portable migration for an unconfigured standalone PostgreSQL server.

## Access model and verification

The private `exhibita` schema contains Merchant, Order, Capture, and EvidenceCase. All four tables have RLS enabled and no browser policies. `anon` and `authenticated` have no table SELECT privileges. The EvidenceCase source/time pair and order relation are constrained in PostgreSQL. See [Supabase's advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

The local API readiness endpoint has verified database connectivity and PayPal Sandbox OAuth. A saved $25 jersey demo order and EvidenceCase were checked against the API and direct database reads. A PayPal capture is only confirmed when a matching completed Capture row exists; creating the order alone does not prove payment.

Reference: [Supabase Prisma guide](https://supabase.com/docs/guides/database/prisma).
