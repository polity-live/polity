import { describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  Zero: vi.fn(function Zero(this: Record<string, unknown>, options: unknown) {
    this.options = options;
  }),
  mutators: { groups: { create: vi.fn() } },
  schema: { version: 1 },
}));

vi.mock('@rocicorp/zero', () => ({ Zero: runtime.Zero }));
vi.mock('@/zero/schema', () => ({ schema: runtime.schema }));
vi.mock('@/zero/mutators', () => ({ mutators: runtime.mutators }));
vi.mock('@/lib/env', () => ({
  getRequiredEnvVar: (_value: unknown, name: string) =>
    name === 'VITE_ZERO_CACHE_URL' ? 'http://zero.test' : 'https://app.test',
}));

import { createZeroClient } from '../zero-client';

describe('Zero client factory', () => {
  it('constructs an authenticated client with exact query, mutation, schema, and cache boundaries', () => {
    const client = createZeroClient('user-1', 'ada@example.test') as unknown as {
      options: Record<string, unknown>;
    };

    expect(runtime.Zero).toHaveBeenCalledTimes(1);
    expect(client.options).toEqual({
      schema: runtime.schema,
      mutators: runtime.mutators,
      userID: 'user-1',
      context: { userID: 'user-1', email: 'ada@example.test' },
      cacheURL: 'http://zero.test',
      queryURL: 'https://app.test/api/zero/query',
      mutateURL: 'https://app.test/api/zero/mutate',
    });
  });
});
