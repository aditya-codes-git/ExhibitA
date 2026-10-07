import { config } from 'dotenv';
import pg from 'pg';

config({ path: '.env', quiet: true });
const orderId = process.argv[2];
if (!orderId) throw new Error('Pass an existing evidence case order ID');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  for (const [source, at] of [
    [null, new Date()],
    ['SIMULATED_DEMO', null],
  ]) {
    await client.query('BEGIN');
    let rejected = false;
    try {
      const result = await client.query(
        'UPDATE exhibita."EvidenceCase" SET "agentActionSource" = $1, "agentActionAt" = $2 WHERE "orderId" = $3',
        [source, at, orderId],
      );
      if (result.rowCount !== 1) throw new Error('Evidence case not found');
    } catch (error) {
      if (error.code === '23514') rejected = true;
      else throw error;
    } finally {
      await client.query('ROLLBACK');
    }
    if (!rejected)
      throw new Error(
        `Constraint accepted invalid pair: source=${source}, at=${at}`,
      );
  }
  console.log(
    'Both asymmetric source/time combinations rejected by PostgreSQL',
  );
} finally {
  await client.end();
}
