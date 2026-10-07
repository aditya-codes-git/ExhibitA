# ExhibitA

ExhibitA helps merchants turn scattered AI-purchase activity into organized, evidence-backed transaction records using PayPal and AI.

The local demo has a merchant dashboard, a saved jersey evidence case, and a verified PayPal Sandbox capture stored in Supabase. The agent action is explicitly simulated; real agent evidence, AI analysis, and dispute operations are future work. See [STATUS](docs/STATUS.md) for verified results and [product direction](docs/PRODUCT_DIRECTION.md) for the next milestone.

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

Automated tests cover the API and payment behavior with mocks. A separate live Sandbox buyer checkout and direct Supabase read verified one completed $25 demo case; see [STATUS](docs/STATUS.md). `npm run paypal:probe` checks real Sandbox OAuth when credentials are configured; it does not create an order or charge anything.

## Database

The dedicated [ExhibitA Supabase project](https://supabase.com/dashboard/project/coponziasrruazpxsgyy) is in Mumbai. The local application connects through a server-side database URL; Prisma migration history is current.

For future schema changes, follow [Supabase setup](docs/SUPABASE_SETUP.md). Do not reset the project or replay the initial migration.

## Project notes

- [Architecture](docs/ARCHITECTURE.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [API reference](docs/API_REFERENCE.md)
- [Verification status](docs/STATUS.md)
- [Feasibility and limitations](docs/FEASIBILITY_REPORT.md)
- [Security boundaries](docs/SECURITY.md)
- [Product direction and next milestone](docs/PRODUCT_DIRECTION.md)

Licensed under [MIT](LICENSE).
