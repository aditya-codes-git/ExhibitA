import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { parseConfig } from './config.js';

config({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
  quiet: true,
});
export const environment = parseConfig(process.env);
