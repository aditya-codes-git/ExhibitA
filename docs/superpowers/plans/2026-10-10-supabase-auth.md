# Supabase Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email/password and Google sign-in, protect merchant records by verified Supabase identity, and provide a safe local demo-account setup.

**Architecture:** The browser uses Supabase Auth and sends its access token to the existing Express API. The API verifies tokens with Supabase Auth, resolves one merchant per verified user, and scopes every data operation to that merchant. A local-only provisioning script links the existing demo merchant to one confirmed test account.

**Tech Stack:** React 19, React Router 7, Supabase Auth, Express 5, Prisma 7, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-10-supabase-auth-design.md`

## Global Constraints

- Keep the fictional `/demo-store` product page and `/api/demo-store/product` public.
- Require authentication for readiness and all merchant order, capture, and agent-case API routes.
- Use only the verified Supabase Auth user ID for ownership; ignore client-supplied identity and user metadata.
- Keep `exhibita` data server-side; browser code receives only Supabase URL and anon/publishable key.
- Never place `SUPABASE_SERVICE_ROLE_KEY` or the demo password in browser variables, deployed runtime configuration, source, or logs.
- Preserve all existing orders, captures, cases, and evidence events.

## Review Focus

- Missing, malformed, expired, or invalid bearer tokens return 401 without database access.
- A valid second user cannot read, capture, run, or mutate the demo user's records.
- The provisioning script refuses ambiguous merchant ownership and never resets an existing account password.
- OAuth callback errors and disallowed redirect targets do not leave a false signed-in UI.
- Existing payment return and cancellation routes preserve their query parameters through login.

---

### Task 1: Supabase session and sign-in UI

**Files:**

- Add `@supabase/supabase-js` to `apps/web/package.json`.
- Create `apps/web/src/supabase.ts` for browser client initialization from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Create `apps/web/src/auth.tsx` for session state, sign-in, Google OAuth, and sign-out.
- Create `apps/web/src/Login.tsx` for accessible email/password and Google forms with loading/error states.
- Modify `apps/web/src/main.tsx` to wrap routes in auth state, protect merchant routes, keep `/demo-store` public, and handle `/auth/callback`.
- Add `apps/web/src/auth.test.ts` for auth helper behavior using a mocked Supabase client.
- Modify `.env.example` with browser-safe Vite auth variables and update README setup instructions.

**Interfaces:** `useAuth()` returns `{ user, loading, signInWithPassword(email, password), signInWithGoogle(), signOut() }`. `RequireAuth` preserves the intended path and query string when redirecting to `/login`.

- [ ] **Step 1: Add failing auth helper tests** for session restoration, email sign-in success/error, Google redirect initiation, and logout using a mocked client.
- [ ] **Step 2: Run** `npm test -- --run apps/web/src/auth.test.ts`; confirm the tests fail because the auth module is absent.
- [ ] **Step 3: Add the Supabase browser client and auth context** with `onAuthStateChange` cleanup and the specified interface.
- [ ] **Step 4: Add login and callback routes**; use Supabase `signInWithOAuth({ provider: 'google', options: { redirectTo } })` and show provider errors without claiming login succeeded.
- [ ] **Step 5: Protect merchant routes** while leaving `/demo-store` public; after login return to the originally requested URL, including PayPal return query parameters.
- [ ] **Step 6: Run** `npm test -- --run apps/web/src/auth.test.ts` and `npm run build -w @exhibita/web`; expect all auth tests and the production build to pass.

### Task 2: Verified API identity and merchant isolation

**Files:**

- Modify `apps/api/src/config.ts`, `apps/api/src/environment.ts`, and `.env.example` for `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
- Create `apps/api/src/auth.ts` with `verifyAccessToken(token, config)` calling Supabase Auth's `/auth/v1/user` endpoint using the anon key.
- Modify `apps/api/src/app.ts` to inject a token verifier for tests and require verified identity for readiness and merchant routes.
- Modify `apps/api/src/app.ts` merchant/order/case queries so all reads and writes use the authenticated merchant; return 404 for another merchant's record.
- Add Prisma migration and modify `prisma/schema.prisma` to add nullable unique `Merchant.authUserId`.
- Update API tests in `apps/api/test/order-flow.test.ts`, `apps/api/test/agent-case.test.ts`, and add `apps/api/test/auth.test.ts`.

**Interfaces:** `createApp` accepts optional `verifyToken(token): Promise<{ id: string } | null>` for isolated tests. Authenticated handlers receive the verified `userId`; merchant lookup creates `{ name: 'ExhibitA Merchant', authUserId: userId }` when absent.

- [ ] **Step 1: Add failing API tests** for no token, malformed token, verifier rejection, authenticated access, and a second user's attempts to read/capture/run another merchant's records.
- [ ] **Step 2: Run** `npm test -- --run apps/api/test/auth.test.ts`; confirm the new cases fail before middleware exists.
- [ ] **Step 3: Implement token verification and middleware**; use native `fetch` against Supabase Auth and return the verified user ID only on a successful response.
- [ ] **Step 4: Add the additive migration** for nullable unique `authUserId`; leave existing rows unassigned until the provisioning task.
- [ ] **Step 5: Scope merchant resolution and every order/case operation** to authenticated ownership, including agent run, capture, and reads; preserve normal 404 behavior for foreign records.
- [ ] **Step 6: Update existing API tests** to inject a test verifier and assert database calls do not occur for unauthorized requests.
- [ ] **Step 7: Run** `npm test -- --run apps/api/test/auth.test.ts apps/api/test/order-flow.test.ts apps/api/test/agent-case.test.ts` and `npm run db:validate`; expect tests and Prisma validation to pass.

### Task 3: Authenticated browser API calls

**Files:**

- Create `apps/web/src/api.ts` with `apiFetch(path, init?)` that obtains the current Supabase access token and adds `Authorization: Bearer <token>` for protected API calls.
- Modify API callers in `apps/web/src/main.tsx`, `apps/web/src/DemoCase.tsx`, and `apps/web/src/SavedCase.tsx` to use `apiFetch` for protected endpoints.
- Keep the public product request in `apps/web/src/DemoStore.tsx` unauthenticated.
- Extend `apps/web/src/auth.test.ts` to cover bearer header attachment and signed-out behavior.

**Interfaces:** `apiFetch(path: string, init?: RequestInit): Promise<Response>`; no caller passes or stores a user ID.

- [ ] **Step 1: Add failing tests** asserting a valid session adds its access token and a missing session redirects/returns an auth error without sending a protected request.
- [ ] **Step 2: Implement `apiFetch`** using the existing Supabase client session and merge caller headers without dropping content type or abort signals.
- [ ] **Step 3: Replace protected `fetch` calls** in dashboard, case creation/run, saved case, readiness, orders, and capture flows; keep the product fetch public.
- [ ] **Step 4: Run** `npm test -- --run apps/web/src/auth.test.ts` and `npm run build -w @exhibita/web`; expect tests and build to pass.

### Task 4: Safe demo-user provisioning and end-to-end checks

**Files:**

- Add `apps/api/src/provision-demo-user.ts` as a local-only command using Supabase Admin Auth and Prisma.
- Add a root npm script `auth:provision-demo` to run it with `tsx`.
- Modify `.env.example` and README with `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD`, and local-only `SUPABASE_SERVICE_ROLE_KEY` instructions.
- Update API tests as needed for ownership linking and provisioning decisions.

**Interfaces:** Provisioning reads `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_USER_EMAIL`, and `DEMO_USER_PASSWORD`; it links `demo@exhibita.test` only after confirming exactly one existing merchant and that its `authUserId` is null or already the same user.

- [ ] **Step 1: Add focused tests** for zero/multiple merchants, already-linked merchant, existing Auth user, and new user creation; assert existing passwords are never changed and secrets never appear in logs.
- [ ] **Step 2: Implement the local provisioning command**: inspect merchant ownership before Auth mutation, find or create the exact user with email auto-confirmed, then link that user ID; abort on ambiguous state and make reruns safe.
- [ ] **Step 3: Document setup** for local `.env`, running `npm run db:deploy`, `npm run auth:provision-demo`, and adding the deployed callback URL to Supabase Auth's redirect allowlist.
- [ ] **Step 4: Run full verification**: `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run db:validate`, and `npm run build`; expect all commands to pass.
- [ ] **Step 5: Manually verify** email/password login, Google callback, logout, public demo-store access, demo-account access to current records, and a second user's empty isolated workspace.

## Self-review

- Spec coverage: Tasks 1–4 implement login/session, public demo route, API verification, merchant scoping, demo provisioning, safe secrets, setup documentation, and automated/manual acceptance checks. Webhooks, deployment, signup, password reset, and roles remain out of scope.
- Step scan: Each task states files, interfaces, behavior-specific tests, implementation, and verification; no unresolved names or TODO steps remain.
- Type consistency: `verifyToken` returns `{ id: string } | null`; frontend `apiFetch` attaches only Supabase access tokens; `Merchant.authUserId` stores verified Supabase identity.
- Review focus: Token cases are covered in Task 2; isolation in Task 2; provisioning ambiguity/password preservation in Task 4; OAuth errors and return URLs in Task 1; API bearer propagation in Task 3.
- Proportion: Four tasks follow the browser, API, integration, and provisioning boundaries and avoid adding role, signup, or deployment features.
