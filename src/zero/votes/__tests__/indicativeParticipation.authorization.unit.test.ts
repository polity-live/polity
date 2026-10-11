import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryHarness, type QueryCall } from '../../__tests__/test-utils/zeroHarness';

type Row = Record<string, unknown>;
const harness = createQueryHarness();

// Execute the existing recording harness against a relational row graph. Access
// helpers remain real; both parent filters and nested result filters execute.
function rows(value: unknown): Row[] {
  if (Array.isArray(value)) return value as Row[];
  return value && typeof value === 'object' ? [value as Row] : [];
}

function compare(row: Row, field: string, operator: unknown, value?: unknown): boolean {
  if (value === undefined) return row[field] === operator;
  if (operator === '=' || operator === 'IS') return row[field] === value;
  if (operator === 'IN') return (value as unknown[]).includes(row[field]);
  throw new Error(`Unsupported fixture comparison: ${String(operator)}`);
}

function matches(row: Row, calls: QueryCall[]): boolean {
  return calls.every(([method, ...args]) => {
    if (method === 'whereExists') {
      return rows(row[String(args[0])]).some(child => matches(child, args[1] as QueryCall[]));
    }
    if (method !== 'where') return true;
    if (typeof args[0] !== 'function') return compare(row, String(args[0]), args[1], args[2]);
    return Boolean(
      args[0]({
        cmp: (field: string, operator: unknown, value?: unknown) =>
          compare(row, field, operator, value),
        or: (...values: boolean[]) => values.some(Boolean),
        and: (...values: boolean[]) => values.every(Boolean),
        exists: (
          relation: string,
          callback: (query: ReturnType<typeof harness.createQuery>) => unknown
        ) => {
          const childQuery = harness.createQuery(relation);
          callback(childQuery);
          return rows(row[relation]).some(child => matches(child, childQuery.calls));
        },
      })
    );
  });
}

function execute(input: Row[], calls: QueryCall[]): Row[] {
  return input
    .filter(row => matches(row, calls))
    .map(row => {
      const result: Row = Object.fromEntries(
        Object.entries(row).filter(([, value]) => value === null || typeof value !== 'object')
      );
      for (const [method, relation, children] of calls) {
        if (method === 'related')
          result[String(relation)] = execute(rows(row[String(relation)]), children as QueryCall[]);
      }
      return result;
    });
}

function fixture() {
  const event: Row = {
    id: 'event',
    creator_id: 'manager',
    visibility: 'public',
    tutorial_run_id: null,
  };
  const agenda: Row = { id: 'agenda', creator_id: 'someone', event };
  const vote: Row = {
    id: 'vote',
    agenda_item_id: 'agenda',
    visibility: 'public',
    agenda_item: agenda,
  };
  const choice: Row = { id: 'yes', label: 'Yes', order_index: 0 };
  const voter: Row = { id: 'linked-voter', user_id: 'linked-owner', vote };
  const own: Row = {
    id: 'own',
    user_id: 'viewer',
    voter_id: null,
    voter: null,
    decisions: [{ id: 'own-decision', voter_participation_id: 'own', choice }],
  };
  const foreign: Row = {
    id: 'foreign',
    user_id: 'other',
    voter_id: null,
    voter: null,
    decisions: [{ id: 'foreign-decision', voter_participation_id: 'foreign', choice }],
  };
  const linked: Row = {
    id: 'linked',
    user_id: null,
    voter_id: 'linked-voter',
    voter,
    decisions: [{ id: 'linked-decision', voter_participation_id: 'linked', choice }],
  };
  vote.indicative_participations = [own, foreign, linked];
  vote.indicative_decisions = [{ id: 'secret', voter_participation_id: null, choice, vote }];
  vote.voters = [voter];
  return { vote, event, own };
}

describe.each(['byId', 'byAgendaItem', 'byAgendaItems'] as const)(
  '%s indicative participation authorization',
  name => {
    let query: (userID: string | null | undefined, vote: Row) => Row[];
    beforeEach(async () => {
      vi.resetModules();
      harness.reset();
      vi.doMock('@rocicorp/zero', () => ({
        defineQuery: (_schema: unknown, fn: unknown) => ({ fn }),
      }));
      vi.doMock('../../schema', () => ({ zql: harness.zql }));
      const { voteQueries } = await import('../queries');
      query = (userID, vote) => {
        const args =
          name === 'byId'
            ? { id: 'vote' }
            : name === 'byAgendaItem'
              ? { agenda_item_id: 'agenda' }
              : { agenda_item_ids: ['agenda'] };
        voteQueries[name].fn({ args, ctx: { userID } } as never);
        return execute([vote], harness.lastQuery('vote').calls);
      };
    });

    it('returns the direct own participation and its choice, excluding foreign direct rows', () => {
      const { vote } = fixture();
      const result = query('viewer', vote);
      expect(result).toHaveLength(1);
      expect(result[0]?.indicative_participations).toEqual([
        {
          id: 'own',
          user_id: 'viewer',
          voter_id: null,
          voter: [],
          decisions: [
            {
              id: 'own-decision',
              voter_participation_id: 'own',
              choice: [{ id: 'yes', label: 'Yes', order_index: 0 }],
            },
          ],
        },
      ]);
      expect(result[0]?.indicative_decisions).toEqual([]);
    });

    it.each([undefined, null, 'anon'])(
      'does not treat anonymous identity %s as ownership',
      userID => {
        const { vote, own } = fixture();
        own.user_id = userID;
        expect(query(userID, vote)[0]?.indicative_participations).toEqual([]);
      }
    );

    it('preserves voter-linked owner and manager access without linking secret decisions to participation', () => {
      const { vote } = fixture();
      expect(
        rows(query('linked-owner', vote)[0]?.indicative_participations).map(row => row.id)
      ).toEqual(['linked']);
      const manager = query('manager', vote)[0];
      expect(rows(manager?.indicative_participations).map(row => row.id)).toEqual(['linked']);
      expect(rows(manager?.indicative_decisions).map(row => row.id)).toEqual(['secret']);
      expect(
        rows(manager?.indicative_participations)
          .flatMap(row => rows(row.decisions))
          .map(row => row.id)
      ).not.toContain('secret');
    });

    it('hides the entire private parent after delegated view rights are revoked', () => {
      const { vote, event } = fixture();
      event.visibility = 'private';
      const participant: Row = { user_id: 'viewer', status: 'confirmed' };
      const role: Row = {
        scope: 'event',
        event_participant_roles: [{ event_participant: participant }],
        event_action_rights: [{ resource: 'events', action: 'view' }],
      };
      event.roles = [role];
      expect(query('viewer', vote)).toHaveLength(1);
      role.event_action_rights = [];
      expect(query('viewer', vote)).toEqual([]);
      expect(query('other', vote)).toEqual([]);
    });
  }
);
