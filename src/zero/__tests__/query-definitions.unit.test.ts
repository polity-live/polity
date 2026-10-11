import { describe, expect, it, vi } from 'vitest';
import { defineQueries, defineQuery } from '@rocicorp/zero';
import { z } from 'zod';
import { zql } from '../schema';
import { memoizeQueryDefinitions } from '../query-definitions';
import { queryAST } from '../../../tools/e2e/zero-performance/oracle';
import { agendaQueries } from '../agendas/queries';
import { electionQueries } from '../elections/queries';
import { networkQueries } from '../network/queries';
import { queries as appQueries } from '../queries';

function registry() {
  const build = vi.fn(({ args, ctx }: { args: { id: string }; ctx: { userID: string } }) =>
    zql.event.where('id', args.id).where('creator_id', ctx.userID)
  );
  const definition = defineQuery(z.object({ id: z.string() }), build);
  return {
    build,
    definition,
    queries: defineQueries(memoizeQueryDefinitions({ event: definition })),
  };
}

describe('Deterministic app query builders', () => {
  it.each([undefined, null, 'anonymous'])(
    'does not retain builders without an object context: %j',
    ctx => {
      const build = vi.fn(() => zql.event.where('id', 'public-event'));
      const { event } = memoizeQueryDefinitions({ event: defineQuery(build) });
      const input = { args: undefined, ctx } as never;
      const first = event.fn(input);
      expect(queryAST(event.fn(input))).toEqual(queryAST(first));
      expect(build).toHaveBeenCalledTimes(2);
    }
  );
  it.each(['owner', 'outsider', 'anon'])(
    'preserves complete access trees for cached agenda, election and network builders as %s',
    userID => {
      const ctx = { userID, email: '' };
      const originals = defineQueries({
        agendas: agendaQueries,
        elections: electionQueries,
        network: networkQueries,
      });
      const cases = [
        [
          originals.agendas.changeRequestTimeline,
          appQueries.agendas.changeRequestTimeline,
          { agenda_item_id: 'item' },
        ],
        [
          originals.elections.byAgendaItem,
          appQueries.elections.byAgendaItem,
          { agenda_item_id: 'item' },
        ],
        [originals.network.wikiNetwork, appQueries.network.wikiNetwork, { groupId: 'group' }],
      ] as const;
      for (const [original, cached, args] of cases) {
        const input = { args, ctx } as never;
        const expected = queryAST(original.fn(input));
        expect(queryAST(cached.fn(input))).toEqual(expected);
        expect(queryAST(cached.fn(input))).toEqual(expected);
      }
    }
  );
  it('reuses only equal validated arguments in the same context and leaves original definitions intact', () => {
    const { build, definition, queries } = registry();
    const ctx = { userID: 'owner', email: 'owner@test.local' };
    const input = { args: { id: 'event' }, ctx };
    const first = queries.event.fn(input);
    expect(queryAST(queries.event.fn({ ...input, args: { id: 'event' } }))).toEqual(
      queryAST(first)
    );
    expect(build).toHaveBeenCalledTimes(1);
    expect(definition.fn).toBe(build);
    expect(() => queries.event.fn({ ...input, args: { id: 42 } as any })).toThrow();
    expect(build).toHaveBeenCalledTimes(1);
    queries.event.fn({ ...input, args: { id: 'another' } });
    expect(build).toHaveBeenCalledTimes(2);
  });

  it('isolates new clients/requests and detects an account change even in a mutated context', () => {
    const { build, queries } = registry();
    const ctx = { userID: 'owner', email: 'owner@test.local' };
    queries.event.fn({ args: { id: 'event' }, ctx });
    queries.event.fn({ args: { id: 'event' }, ctx: { ...ctx } });
    expect(build).toHaveBeenCalledTimes(2);
    ctx.userID = 'outsider';
    const changed = queryAST(queries.event.fn({ args: { id: 'event' }, ctx }));
    expect(JSON.stringify(changed)).toContain('outsider');
    expect(JSON.stringify(changed)).not.toContain('owner');
    expect(build).toHaveBeenCalledTimes(3);
  });

  it('bounds retained argument variants and rebuilds evicted entries', () => {
    const { build, queries } = registry();
    const ctx = { userID: 'owner', email: '' };
    for (let index = 0; index < 65; index++) queries.event.fn({ args: { id: `${index}` }, ctx });
    expect(build).toHaveBeenCalledTimes(65);
    queries.event.fn({ args: { id: '64' }, ctx });
    expect(build).toHaveBeenCalledTimes(65);
    queries.event.fn({ args: { id: '0' }, ctx });
    expect(build).toHaveBeenCalledTimes(66);
  });

  it('never caches failed construction', () => {
    const build = vi.fn(() => {
      throw new Error('Invalid context');
    });
    const { failing } = memoizeQueryDefinitions({ failing: defineQuery(build) });
    const input = { args: undefined, ctx: { userID: 'owner', email: '' } };
    expect(() => failing.fn(input)).toThrow('Invalid context');
    expect(() => failing.fn(input)).toThrow('Invalid context');
    expect(build).toHaveBeenCalledTimes(2);
  });
});
