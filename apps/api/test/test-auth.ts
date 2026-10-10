import supertest from 'supertest';
import { createApp as createRealApp } from '../src/app.js';

export function createApp(options: Parameters<typeof createRealApp>[0]) {
  return createRealApp({
    ...options,
    verifyToken: async (token) =>
      token === 'test-token'
        ? { id: '00000000-0000-4000-8000-000000000001' }
        : null,
  });
}

export default function request(app: Parameters<typeof supertest>[0]) {
  return supertest.agent(app).set('Authorization', 'Bearer test-token');
}
