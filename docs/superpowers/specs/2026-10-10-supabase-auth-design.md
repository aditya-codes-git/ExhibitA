# Supabase Authentication and Demo Account Design

**Status:** Awaiting review
**Date:** 2026-10-10

## Goal

Add a sign-in page with email/password and Google login, and protect the merchant workspace and its existing order/evidence data. Create one confirmed demo account that can use the current data without requiring a real inbox or Google account.

## Current state

The React app has no Supabase Auth client or login route. The Express API has no authentication middleware: order list/detail, create, capture, and agent-case routes operate without a user identity. API code selects the first merchant for writes and returns orders across merchants for reads. The `exhibita` schema is private and accessed by the server through Prisma; the browser must continue to use the API rather than query these tables directly.

The user reports that Google OAuth is already configured in Supabase and Google Cloud. This design uses that existing provider configuration and adds the application-side flow plus the deployed redirect URL when available.

## Proposed experience

- Unauthenticated users are sent to `/login` before entering the merchant dashboard, guided case, saved cases, integrations, or payment-return routes.
- The login page offers email/password sign-in and a Google sign-in button, with loading, validation, and provider error states. It has no self-service email registration or password-reset flow in this first slice.
- Supabase Auth maintains the browser session. A successful Google login returns through `/auth/callback`; signing out clears the session and returns to `/login`.
- The fictional `/demo-store` product page remains public. Starting a saved case or viewing merchant evidence requires a signed-in session.

## Identity and data authorization

Use `@supabase/supabase-js` in the browser for password and Google sign-in. The browser receives only the Supabase URL and publishable/anon key. It sends its access token as a bearer token to protected API routes.

The API validates each bearer token with Supabase Auth `getUser(token)` and uses only the verified user ID. It must not make authorization decisions from browser-supplied user IDs or editable user metadata. Public routes are limited to health and the fixed fictional product; readiness and all merchant order/case/payment routes require authentication.

Add a nullable, unique `authUserId` to `exhibita.Merchant`. A server helper resolves the authenticated user's merchant and creates an empty merchant workspace for a newly authenticated Google user. Every order read, create, capture, and agent-case operation is constrained to that merchant. A record owned by another merchant returns the normal not-found response.

The existing demo merchant is linked to one dedicated confirmed email/password test user. Other Google users receive their own empty workspaces and cannot see the existing demo records. Provisioning must fail safely if the existing data does not match the expected single demo merchant; it must not reassign or delete unrelated merchants, orders, captures, cases, or events.

## Demo account provisioning and secrets

Provide a one-time local provisioning script that creates `demo@exhibita.test` as an email-confirmed Supabase Auth user and links the existing demo merchant to its Auth user ID. It reads `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_USER_EMAIL`, and `DEMO_USER_PASSWORD` from ignored local `.env` configuration. The password can then be used directly in the email/password form; no real mailbox, confirmation email, or Google sign-in is needed. Provisioning is idempotent and does not reset an existing user's password. The script must stop without changing data if it cannot identify exactly one existing demo merchant to link.

The Supabase Admin API's service-role/secret key is required only by the local provisioning command. It must never be added to browser variables, deployed runtime configuration, source, test fixtures, or logs. Runtime API authentication uses the public anon/publishable key to validate user tokens; database access remains server-side.

## Components in scope

- Web: Supabase browser client, login page, OAuth callback/session restore, protected-route handling, logout, and an API request helper that adds the access token to current dashboard, demo, saved-case, return, and cancel requests.
- API: Supabase Auth token verification, authenticated-user context, merchant ownership field and migration, merchant-scoped order/capture/case operations, and configuration for Supabase URL and public key.
- Setup/docs: local demo-account provisioning inputs, browser-safe environment variable names, and instructions to add the final Render site URL to Supabase Auth's allowed redirect URLs after deployment.
- Tests: login/session states; unauthenticated and invalid-token rejection; a demo user reading current records; a second user being isolated; and existing order, capture, and agent flows continuing to work under an authenticated merchant.

## Out of scope

PayPal webhook ingestion, production deployment, multi-role permissions, merchant invitations, email sign-up, password reset, direct browser database access, and sharing demo credentials in the public UI are separate work. This auth change prepares the product for deployment but does not publish it.

## Acceptance criteria

1. Email/password and Google sign-in establish a Supabase session, and logout clears it.
2. Protected pages redirect to login when signed out; public demo product and health checks still work.
3. All merchant API routes reject missing, malformed, expired, or invalid tokens.
4. The confirmed demo user can view and test the existing demo merchant's records; another authenticated user cannot read or mutate those records.
5. New Google users can use a separate empty merchant workspace without becoming owners of the demo data.
6. Existing orders, captures, evidence cases, and events remain intact through the migration and provisioning step.
7. No service-role key or test password is shipped to the browser, committed, or written to logs.
8. Automated tests, typecheck, lint, formatting, database schema validation, and production build pass.

## Verified Supabase behavior

Supabase's browser OAuth flow uses `signInWithOAuth`; redirect targets must be allow-listed in Auth URL Configuration. `auth.getUser(token)` verifies the user against the Auth server. Admin `createUser` is server-only and supports auto-confirming email; the service-role key must never be exposed in browser code.

References: [Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser).
