# PayPal Sandbox setup

Configure these in the root `.env` on your computer:

```dotenv
PAYPAL_CLIENT_ID=your_sandbox_merchant_app_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_merchant_app_secret
PAYPAL_WEBHOOK_ID=
```

Use the merchant application's Sandbox credentials from the [Developer Dashboard](https://developer.paypal.com/dashboard/), not a test account login or live credentials. Never send secrets in chat. `.env` files are ignored by Git and never exposed through Vite.

Run `npm run paypal:probe` to verify OAuth. It prints no token and creates no order. No successful Sandbox operation has been observed in this working session.

The server-side adapter implements authentication, order creation, and capture transport against the fixed Sandbox API origin. Tests inject mocked HTTP responses. There are no browser-facing payment mutation routes yet. The capture transport returns a provider payload; later persistence must validate the capture ID, amount, currency, order relationship, and status before advancing local payment state.

## Next payment increment

1. Add protected merchant/session access and a server-selected test product and price.
2. Persist a local order and separate stable create/capture request IDs before network calls.
3. Call the Orders API, store the returned PayPal order ID, and open its Sandbox approval link.
4. Approve using a Sandbox personal buyer account.
5. Verify ownership and capture the approved order server-side; a return URL alone is not payment proof.
6. Validate and persist capture details; reconcile timeouts with PayPal before retrying with the same request ID.
7. Record actual request outcomes and external IDs without secrets or unnecessary personal data in the feasibility report.

The initial transport supports USD only, with 1 to 1,000,000 minor units ($0.01 to $10,000.00). This is a demo restriction, not a currency conversion feature.

Webhook ingestion is not implemented. Add a reachable HTTPS endpoint, signature verification, and duplicate protection before subscribing. `PAYPAL_WEBHOOK_ID` is reserved for that increment.

References: [Authentication](https://developer.paypal.com/api/rest/authentication/), [Create order](https://developer.paypal.com/api/orders/v2/orders-create), [Capture order](https://developer.paypal.com/api/orders/v2/orders-capture), [Dispute Sandbox testing](https://developer.paypal.com/platforms/disputes/test-go-live/).
