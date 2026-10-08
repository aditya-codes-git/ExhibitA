import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('fictional demo store', () => {
  it('serves the fixed $25 jersey without caching or database access', async () => {
    const response = await request(createApp({ config: { port: 3001 } }))
      .get('/api/demo-store/product')
      .expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      productId: 'jersey-2026-home-player',
      itemName: 'Real Madrid 2026 home jersey, player edition',
      edition: 'Player edition',
      shopName: 'Demo Sports Shop',
      amountMinor: 2500,
      currency: 'USD',
    });
  });
});
