import { createApp } from './app.js';
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
        environment.groqModel ?? 'llama-3.3-70b-versatile',
      )
    : undefined,
  checkDatabase: database
    ? async () => {
        await database.$queryRaw`SELECT 1`;
      }
    : undefined,
});

const server = app.listen(environment.port, '127.0.0.1', () => {
  console.log(`ExhibitA API listening on http://127.0.0.1:${environment.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      void database?.$disconnect().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
