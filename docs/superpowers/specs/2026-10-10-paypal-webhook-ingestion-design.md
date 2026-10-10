# PayPal Sandbox Webhook Evidence Intake

## Goal

Accept PayPal Sandbox webhook events as trusted, source-labelled evidence. Verify authenticity before storing anything, keep each verified event once even when PayPal retries delivery, and link it to a local order when the PayPal order ID is known.

## Scope

- One public endpoint: `POST /api/paypal/webhook` on the existing Render web service.
- PayPal Sandbox only, consistent with the current `PayPalClient` and checkout flow.
- Cryptographically verify webhook signatures from the original raw request body. Use PayPal's documented transmission ID, timestamp, configured webhook ID, raw-body CRC32, transmission signature, and PayPal certificate.
- Validate and constrain the certificate URL to HTTPS PayPal Sandbox certificate hosts, reject redirects, and cache fetched certificates in memory with a bounded lifetime.
- Persist a minimal receipt for every verified event in the private `exhibita` schema. Do not store the full PayPal payload or buyer/seller personal details.
- Deduplicate globally by PayPal event ID. A retry is acknowledged without creating another evidence item.
- Link a receipt to the local order using the PayPal order ID when available. If no local match exists yet, retain it as unmatched and allow a later retry to attach the order.
- For matched events, add a `PAYPAL` source event to the existing order evidence timeline, with normalized fields only. Commit the receipt and timeline event in one database transaction.
- Leave existing synchronous PayPal capture behavior and order status unchanged. Webhooks add verified evidence; they do not independently change payment state in this increment.

## Event fields and matching

Validate the envelope fields required for verification and durable identity: event ID, event type, create time, resource type, resource ID, and resource object. Extract the PayPal order ID from `resource.supplementary_data.related_ids.order_id` for capture notifications, and from `resource.id` for `CHECKOUT.ORDER.*` notifications. Unknown event types can still be stored as verified receipts, but only normalized fields are kept and no payment state changes.

For a matched event, store its ID, type, resource type and ID, PayPal order ID, occurrence time, verification/recorded time, optional local order ID, and a minimized JSON payload containing only safe status and amount/currency fields when present. Keep the existing timeline's event ordering by occurrence time, then recorded time.

## Persistence

Add a `PayPalWebhookEvent` model in `exhibita` with a globally unique PayPal event ID, the normalized event metadata above, nullable local order relation, and a minimized JSON payload. Extend the existing evidence source/kind constraints to permit `PAYPAL` and `PAYPAL_WEBHOOK`; use the existing `(orderId, source, externalEventId)` uniqueness for matched timeline entries. Add the relation on `Order` for Prisma consistency, but keep public API output limited to existing order/evidence fields unless needed for a test.

The migration must enable RLS and revoke direct `PUBLIC`, `anon`, and `authenticated` access, matching the existing private-schema tables. The API's database role remains the only runtime path.

## HTTP behavior

- `503` when webhook ID, PayPal verification dependencies, or database are not configured; do not acknowledge an event that could not be stored.
- `400` for malformed bodies, missing required signature headers, invalid signatures, or structurally invalid event envelopes.
- `200` after a verified event has been stored or confirmed as an already-processed duplicate. Return a minimal acknowledgement only; never echo the webhook payload.
- Do not require the merchant's Supabase bearer token on this PayPal-to-server route.
- Apply a small body-size limit and parse only after signature verification.

## Configuration and deployment

- Add optional `PAYPAL_WEBHOOK_ID` server configuration and document it in `.env.example` and `docs/PAYPAL_SETUP.md`.
- Add the variable to Render's service configuration without a value. The receiver remains safely unavailable until the merchant app's Sandbox webhook is registered and its ID is set in Render.
- Deploy the receiver first. Then register `https://exhibita.onrender.com/api/paypal/webhook` in the PayPal Sandbox app, save its generated webhook ID in Render, and redeploy.
- Subscribe to only payment/order events needed for the pilot, initially `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.DENIED`, and `PAYMENT.CAPTURE.REFUNDED`.

## Testing and acceptance

- Unit tests verify valid signatures, tampered raw bodies, invalid/missing headers, disallowed certificate hosts, certificate-fetch failure, and certificate caching.
- Route tests verify that unverified payloads never reach storage, missing configuration fails closed, matched events create one receipt and one timeline item, unmatched events are durably retained, duplicate delivery creates no duplicate evidence, and a later matched retry attaches the receipt.
- Migration test/build checks confirm generated Prisma types and migration SQL agree; the deployed health and endpoint checks pass.
- After the user registers the Sandbox webhook and supplies the non-secret webhook ID, send a real Sandbox event and confirm PayPal receives 2xx and the matched order timeline shows a `PAYPAL`-sourced event.

## Out of scope

- Live PayPal credentials and production webhook setup.
- Full raw-event archives, refunds processing, disputes, fulfillment mutation, or automatic order/capture state transitions.
- UI screens for searching unmatched receipts or retrying reconciliation.
- Accepting simulator events signed with PayPal's shared `WEBHOOK_ID` test identifier; use generated RSA fixtures for invalid/valid cases and actual Sandbox checkout events with the app's registered webhook ID for end-to-end verification.

## Decisions

- Use cryptographic verification rather than PayPal's verification postback API: PayPal documents it as the preferred faster path and says simulator mock events cannot be verified through the postback API.
- Keep an unmatched verified receipt instead of dropping it, because event delivery may race with local order mapping and PayPal retries.
- Do not let webhook events overwrite capture/order state yet; the existing synchronous capture response remains the payment-state source in this increment.

## References

- [PayPal webhook integration guide](https://developer.paypal.com/api/rest/webhooks/rest/)
- [PayPal webhook overview](https://developer.paypal.com/api/rest/webhooks)
- [Supabase API security and RLS](https://supabase.com/docs/guides/api/securing-your-api)
