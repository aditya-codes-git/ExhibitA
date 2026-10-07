import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ quiet: true });
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Generation and validation work before a database is configured.
  // Migration commands require an actual connection; never substitute a fake URL.
  datasource: { url: process.env.DIRECT_URL || process.env.DATABASE_URL || '' },
});
