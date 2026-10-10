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

The app starts without credentials. Configure the root `.env`; never send passwords or service keys in chat or commit them. Set `SUPABASE_URL` and `VITE_SUPABASE_URL` to the dedicated project's API URL. Set `SUPABASE_ANON_KEY` and `VITE_SUPABASE_ANON_KEY` to its publishable key. Vite reads the root `.env`, and only `VITE_` values reach the browser. See [Supabase setup](docs/SUPABASE_SETUP.md) and [PayPal setup](docs/PAYPAL_SETUP.md).

The merchant workspace now requires Supabase Auth. The login page supports email/password and Google; the fictional store remains public. For the existing demo records, add a unique test password as `DEMO_USER_PASSWORD` and a Supabase service-role key as `SUPABASE_SERVICE_ROLE_KEY` to the **local root** `.env`, then run `npm run db:deploy` and `npm run auth:provision-demo`. The command links the single existing merchant to the confirmed `DEMO_USER_EMAIL` account. Run it only against the dedicated ExhibitA project. It refuses zero/multiple merchants or an owner conflict and never resets an existing Auth user's password. Remove the service-role key from any deployed environment; it is needed only for this local command.

In Supabase Auth URL Configuration, allow `http://127.0.0.1:5173/auth/callback` for local Google sign-in and add the final HTTPS callback URL after deployment. Google sign-in requires the provider configuration in Supabase and Google Cloud. Each newly signed-in Google user gets a separate empty merchant workspace.

## Render deployment

The root `render.yaml` defines a Render Blueprint with a Node API and a static frontend. Connect the pushed GitHub repository to Render as a Blueprint and enter the requested environment values. Use the Supabase session-pooler URI for `DATABASE_URL` (port 5432), the project's Supabase URL and publishable key, PayPal Sandbox credentials, and a Groq key. The service-role key is local provisioning only and must never be added to Render. Both services use the free plan in Singapore; the API applies pending Prisma migrations at startup.

After Render creates the services, add the frontend URL and `/auth/callback` to Supabase Auth's redirect URL allowlist, and set the frontend site URL in Supabase Auth. Google sign-in also requires the Google OAuth provider to allow the Supabase callback URL. Use a strong password for the demo account before sharing the public app.

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
