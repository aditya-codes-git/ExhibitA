# PayPal Sandbox setup

Configure these in the root `.env` on your computer:

```dotenv
PAYPAL_CLIENT_ID=your_sandbox_merchant_app_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_merchant_app_secret
PAYPAL_WEBHOOK_ID=
```

Use the merchant application's Sandbox credentials from the [Developer Dashboard](https://developer.paypal.com/dashboard/), not a test account login or live credentials. Never send secrets in chat. `.env` files are ignored by Git and never exposed through Vite.

Run `npm run paypal:probe` to verify OAuth. It prints no token and creates no order. The app supports authenticated Sandbox order creation and capture, with capture details persisted to Supabase after validating the PayPal response. The pilot currently accepts USD only.

## Sandbox webhook evidence

After deploying the receiver, add this URL to the same PayPal Sandbox app:

```text
https://exhibita.onrender.com/api/paypal/webhook
```

Subscribe only to `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.DENIED`, and `PAYMENT.CAPTURE.REFUNDED`. Copy the generated webhook ID into `PAYPAL_WEBHOOK_ID` in Render and redeploy. The endpoint stays unavailable until that ID and the database are configured. It verifies Sandbox signatures, stores minimized event receipts, and links known orders into the evidence timeline; it does not change order or capture status. Do not use a Live app or credentials.

References: [Authentication](https://developer.paypal.com/api/rest/authentication/), [Create order](https://developer.paypal.com/api/orders/v2/orders-create), [Capture order](https://developer.paypal.com/api/orders/v2/orders-capture), [Dispute Sandbox testing](https://developer.paypal.com/platforms/disputes/test-go-live/).
