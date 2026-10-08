# ExhibitA

ExhibitA helps merchants turn scattered AI-purchase activity into organized, evidence-backed transaction records using PayPal and AI.

The local demo has a merchant dashboard, a fictional single-product jersey store, and a guided Sandbox case. With a server-side Groq key, its constrained agent reads the fixed store record and requests a $25 PayPal Sandbox checkout through recorded tools. ExhibitA stores each tool request/result beside the PayPal order and capture in Supabase. Historical `SIMULATED_DEMO` cases remain explicitly scripted. See [STATUS](docs/STATUS.md) for verified results and limits.

## Stack

React + Vite + TypeScript + Tailwind CSS; Express + TypeScript; Prisma + **Supabase PostgreSQL**. npm workspaces separate the web app, API, and shared validation. Target Node.js 24 LTS.

## Local development

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Open [the local setup screen](http://127.0.0.1:5173). API health is at [port 3001](http://127.0.0.1:3001/api/health). Both servers bind to loopback for this development-only foundation. Keep `PORT=3001` unless you also update the Vite proxy.

The fictional [Demo Sports Shop](http://127.0.0.1:5173/demo-store) leads to the [guided case](http://127.0.0.1:5173/demo-case). Add `GROQ_API_KEY` to the server-side `.env` to run the recorded agent; `GROQ_MODEL` optionally overrides the default `qwen/qwen3.8-27b`. No OpenAI API key is used. The saved case appears before the agent runs; if Groq or PayPal fails, it remains incomplete and inspectable. A Sandbox buyer must approve checkout separately, and only a completed capture is displayed as a completed payment. The store is illustrative and does not sell or ship merchandise.

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

Automated tests cover the API, guarded agent sequence, and payment behavior with mocks. A separate live Sandbox buyer checkout and direct Supabase read verified one historical scripted $25 case; see [STATUS](docs/STATUS.md). `npm run paypal:probe` checks real Sandbox OAuth when credentials are configured; it does not create an order or charge anything.

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
