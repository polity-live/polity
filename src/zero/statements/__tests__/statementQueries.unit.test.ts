import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryHarness, evaluatePredicate } from '../../__tests__/test-utils/zeroHarness';

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
  it('builds byte-equivalent access predicates for identical explicit time arguments', async () => {
    const { harness, statementQueries } = await loadStatementQueries();
    const input = {
      args: { id: 'statement-1', now: 1_700_000_000_000 },
      ctx: { userID: 'user-1', email: 'user-1@example.com' },
    };

    statementQueries.byId.fn(input);
    const firstPredicates = harness
      .lastQuery('statement')
      .calls.filter(call => call[0] === 'where' && typeof call[1] === 'function')
      .map(call => evaluatePredicate(call[1]));

    harness.reset();
    statementQueries.byId.fn(input);
    const secondPredicates = harness
      .lastQuery('statement')
      .calls.filter(call => call[0] === 'where' && typeof call[1] === 'function')
      .map(call => evaluatePredicate(call[1]));

    expect(JSON.stringify(secondPredicates)).toBe(JSON.stringify(firstPredicates));
    expect(firstPredicates.flat()).toContainEqual(['cmp', 'expires_at', '>', input.args.now]);
  });

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
