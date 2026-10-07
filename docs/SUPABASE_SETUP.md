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

## Initial migration and Prisma baseline

The exact SQL in `prisma/migrations/20261005000100_initial/migration.sql` has already been applied to this project's private `exhibita` schema using the Supabase connector. Supabase records that application in its own migration history. Prisma's `_prisma_migrations` table has **not** been initialized because local database credentials were unavailable.

After configuring the connection, inspect the schema and confirm that it matches the migration, then adopt the existing migration **on this initialized project only**:

```powershell
npx prisma migrate resolve --applied 20261005000100_initial
npx prisma migrate status
npm run db:deploy
```

These commands have not yet been run. Do not run `db:deploy` before baselining this existing schema. On a truly empty replacement project, skip `migrate resolve` and run `db:deploy` to apply the actual SQL instead. Prisma is the source of truth for subsequent application migrations; keep SQL and migration history aligned.

The migration targets Supabase and references its built-in `anon` and `authenticated` roles. It is not a portable migration for an unconfigured standalone PostgreSQL server.

## Access model and verification

The private `exhibita` schema contains Merchant, Order, and Capture. All three tables have RLS enabled and no browser policies. `anon` and `authenticated` have no table SELECT privileges. Supabase's security advisor reported only three informational `rls_enabled_no_policy` notices, which are intentional for this backend-only foundation. See [the advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Connector SQL tests inserted related records, verified rejection of negative amounts and duplicate capture IDs, and rolled back. A final count showed all three tables empty. These checks do not verify the application's credentials, network path, Prisma role permissions, or application-level persistence.

Reference: [Supabase Prisma guide](https://supabase.com/docs/guides/database/prisma).
