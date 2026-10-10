import { describe, expect, it, vi } from 'vitest';
import { provisionDemoUser } from '../src/provision-demo-user.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';

const email = 'demo@exhibita.test';
const password = 'test-password';
const user = {
  id: '00000000-0000-4000-8000-000000000001',
  email,
  email_confirmed_at: '2026-10-10T00:00:00Z',
};

function setup(
  merchants: Array<{ id: string; authUserId: string | null }>,
  users = [user],
) {
  const database = {
    merchant: {
      findMany: vi.fn().mockResolvedValue(merchants),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as PrismaClient;
  const admin = {
    listUsers: vi.fn().mockResolvedValue({ data: { users }, error: null }),
    createUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
  };
  return { database, admin };
}

describe('demo account provisioning', () => {
  it.each([
    { merchants: [] },
    {
      merchants: [
        { id: 'a', authUserId: null },
        { id: 'b', authUserId: null },
      ],
    },
  ])('refuses ambiguous existing merchants', async ({ merchants }) => {
    const { database, admin } = setup(merchants);
    await expect(
      provisionDemoUser({ database, admin, email, password }),
    ).rejects.toThrow('exactly one existing merchant');
    expect(admin.createUser).not.toHaveBeenCalled();
    expect(database.merchant.updateMany).not.toHaveBeenCalled();
  });

  it('links an existing confirmed Auth user without changing its password', async () => {
    const { database, admin } = setup([{ id: 'merchant-1', authUserId: null }]);
    await provisionDemoUser({ database, admin, email, password });
    expect(admin.createUser).not.toHaveBeenCalled();
    expect(database.merchant.updateMany).toHaveBeenCalledWith({
      where: { id: 'merchant-1', authUserId: null },
      data: { authUserId: user.id },
    });
  });

  it('creates a confirmed account only for the single unlinked merchant', async () => {
    const { database, admin } = setup(
      [{ id: 'merchant-1', authUserId: null }],
      [],
    );
    await provisionDemoUser({ database, admin, email, password });
    expect(admin.createUser).toHaveBeenCalledWith({
      email,
      password,
      email_confirm: true,
    });
    expect(database.merchant.updateMany).toHaveBeenCalledOnce();
  });

  it('refuses to reassign a merchant linked to another Auth user', async () => {
    const { database, admin } = setup([
      { id: 'merchant-1', authUserId: 'different-user' },
    ]);
    await expect(
      provisionDemoUser({ database, admin, email, password }),
    ).rejects.toThrow('already linked');
    expect(database.merchant.updateMany).not.toHaveBeenCalled();
  });
});
