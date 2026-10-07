# ExhibitA

ExhibitA helps merchants turn scattered AI-purchase activity into organized, evidence-backed transaction records using PayPal and AI.

The first increment is a working development foundation. The merchant dashboard, end-to-end payment flow, agent timeline, AI analysis, and dispute operations are **not implemented yet**. See [STATUS](docs/STATUS.md) for verified results.

## Stack

React + Vite + TypeScript + Tailwind CSS; Express + TypeScript; Prisma + **Supabase PostgreSQL**. npm workspaces separate the web app, API, and shared validation. Target Node.js 24 LTS.

## Local development

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Open [the local setup screen](http://127.0.0.1:5173). API health is at [port 3001](http://127.0.0.1:3001/api/health). Both servers bind to loopback for this development-only foundation. Keep `PORT=3001` unless you also update the Vite proxy.

The app starts without credentials and shows integrations as unconfigured. Configure secrets only in the root `.env`; never send them in chat or commit them. See [Supabase setup](docs/SUPABASE_SETUP.md) and [PayPal setup](docs/PAYPAL_SETUP.md).

## Checks

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run db:validate
npm run build
npm audit
```

Tests cover environment handling, health/readiness behavior, and a PayPal adapter with mocked HTTP. They do not establish a working Sandbox payment flow. `npm run paypal:probe` checks real Sandbox OAuth when credentials are configured; it does not create an order or charge anything.

## Database

The dedicated [ExhibitA Supabase project](https://supabase.com/dashboard/project/coponziasrruazpxsgyy) is in Mumbai. The initial schema was applied through the connector and checked with rollback-only test records. Application-to-database connectivity still needs a local connection string.

**Before the first Prisma deployment to this already-initialized project, follow the baseline instructions in [Supabase setup](docs/SUPABASE_SETUP.md).** Do not run a reset or create a second initial migration.

## Project notes

- [Architecture](docs/ARCHITECTURE.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [API reference](docs/API_REFERENCE.md)
- [Verification status](docs/STATUS.md)
- [Feasibility and limitations](docs/FEASIBILITY_REPORT.md)
- [Security boundaries](docs/SECURITY.md)

Licensed under [MIT](LICENSE).
