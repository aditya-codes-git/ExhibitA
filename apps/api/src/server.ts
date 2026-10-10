import { createApp } from './app.js';
import { fileURLToPath } from 'node:url';
import { createDatabase } from './database.js';
import { environment } from './environment.js';
import { PayPalClient } from './paypal.js';
import { GroqAgentModel } from './jersey-agent.js';

const database = environment.databaseUrl
  ? createDatabase(environment.databaseUrl)
  : undefined;

const paypalClient =
  environment.paypalClientId && environment.paypalClientSecret
    ? new PayPalClient({
        clientId: environment.paypalClientId,
        clientSecret: environment.paypalClientSecret,
      })
    : undefined;

const app = createApp({
  config: environment,
  database,
  paypalClient,
  agentModel: environment.groqApiKey
    ? new GroqAgentModel(
        environment.groqApiKey,
        environment.groqModel ?? 'qwen/qwen3.8-27b',
      )
    : undefined,
  checkDatabase: database
    ? async () => {
        await database.$queryRaw`SELECT 1`;
      }
    : undefined,
  webRoot: fileURLToPath(new URL('../../web/dist/', import.meta.url)),
});

const server = app.listen(environment.port, '0.0.0.0', () => {
  console.log(`ExhibitA API listening on port ${environment.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      void database?.$disconnect().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
