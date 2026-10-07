import { environment } from './environment.js';
import { PayPalClient } from './paypal.js';

if (!environment.paypalClientId || !environment.paypalClientSecret) {
  console.error(
    'Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in the local root .env. Do not send secrets in chat.',
  );
  process.exitCode = 1;
} else {
  try {
    await new PayPalClient({
      clientId: environment.paypalClientId,
      clientSecret: environment.paypalClientSecret,
    }).verifyCredentials();
    console.log(
      'PayPal Sandbox OAuth verified. No order, capture, or dispute was created.',
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'PayPal Sandbox OAuth failed',
    );
    process.exitCode = 1;
  }
}
