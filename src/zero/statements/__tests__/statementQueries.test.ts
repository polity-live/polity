import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryHarness } from '../../__tests__/test-utils/zeroHarness';

beforeEach(() => {
  vi.resetModules();
});

async function loadStatementQueries() {
  const harness = createQueryHarness();

  vi.doMock('@rocicorp/zero', () => ({
    defineQuery: (_schema: unknown, fn: unknown) => ({ fn }),
  }));
  vi.doMock('../../schema', () => ({
    zql: harness.zql,
  }));

  const mod = await import('../queries');
  return { harness, statementQueries: mod.statementQueries };
}

describe('statementQueries', () => {
  it('keeps carousel results inclusive of stories and regular statements', async () => {
    const { harness, statementQueries } = await loadStatementQueries();

    statementQueries.carousel.fn({
      args: { now: 1_700_000_000_000, limit: 24 },
      ctx: { userID: 'user-1', email: 'user-1@example.com' },
    });

    const calls = harness.lastQuery('statement').calls;

    expect(calls).not.toContainEqual(['where', 'is_story', true]);
    expect(calls).toEqual(
      expect.arrayContaining([
        ['orderBy', 'created_at', 'desc'],
        ['limit', 24],
      ])
    );
  });
});
