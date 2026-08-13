import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryHarness } from '../../__tests__/test-utils/zeroHarness';

describe('election query and schema branches', () => {
  beforeEach(() => vi.resetModules());

  it('builds empty and fully filtered decision pages for users and anonymous viewers', async () => {
    const harness = createQueryHarness();
    vi.doMock('@rocicorp/zero', () => ({
      defineQuery: (_schema: unknown, fn: unknown) => ({ fn }),
    }));
    vi.doMock('../../schema', () => ({ zql: harness.zql }));
    vi.doMock('../../rbac/query-access', () => ({
      applyAgendaItemQueryAccess: (query: unknown) => query,
      applyElectionElectorOrManagerQueryAccess: (query: unknown) => query,
      applyElectionManagerQueryAccess: (query: unknown) => query,
      applyElectionQueryAccess: (query: unknown) => query,
      applyEventQueryAccess: (query: unknown) => query,
      applyGroupQueryAccess: (query: unknown) => query,
      applyRoleQueryAccess: (query: unknown) => query,
    }));
    const { electionQueries } = await import('../queries');
    const empty = {
      status: undefined,
      statuses: undefined,
      groupIds: undefined,
      query: ' ',
      limit: 20,
      start: null,
      dir: 'forward',
    };
    const full = {
      status: 'final',
      statuses: ['final', 'closed'],
      groupIds: ['group-1'],
      query: ' chair ',
      limit: 20,
      start: { id: 'election-1', created_at: 1 },
      dir: 'backward',
    };

    electionQueries.decisionOverviewPage.fn({ args: empty, ctx: { userID: undefined } } as never);
    electionQueries.decisionOverviewPage.fn({ args: full, ctx: { userID: 'user-1' } } as never);
    expect(harness.lastQuery('election').calls).toEqual(
      expect.arrayContaining([
        ['where', 'status', 'final'],
        ['where', 'status', 'IN', ['final', 'closed']],
        ['where', 'title', 'ILIKE', '%chair%'],
        ['orderBy', 'created_at', 'asc'],
        ['start', full.start, { inclusive: false }],
      ])
    );
    electionQueries.decisionPage.fn({ args: empty, ctx: { userID: undefined } } as never);
    electionQueries.decisionPage.fn({ args: full, ctx: { userID: 'user-1' } } as never);
    electionQueries.viewerDecisionState.fn({
      args: { ids: [] },
      ctx: { userID: undefined },
    } as never);
    electionQueries.viewerDecisionState.fn({
      args: { ids: ['election-1'] },
      ctx: { userID: 'user-1' },
    } as never);

    const broadArgs = {
      id: 'id-1',
      ids: ['id-1'],
      event_id: 'event-1',
      event_ids: ['event-1'],
      agenda_item_id: 'agenda-1',
      agendaItemIds: ['agenda-1'],
      amendment_id: 'amendment-1',
      user_id: 'user-1',
      election_id: 'election-1',
      limit: 20,
      start: null,
      status: undefined,
      statuses: [],
      groupIds: [],
      query: '',
      dir: 'forward',
    };
    for (const query of Object.values(electionQueries)) {
      query.fn({ args: broadArgs, ctx: { userID: undefined } } as never);
      query.fn({ args: broadArgs, ctx: { userID: 'user-1' } } as never);
    }
  });

  it('defaults election ballot visibility and electorate size but preserves explicit values', async () => {
    vi.doUnmock('@rocicorp/zero');
    vi.doUnmock('../../schema');
    const { createElectionSchema } = await import('../schema');
    const base = {
      id: 'election-1',
      agenda_item_id: null,
      role_id: null,
      title: null,
      description: null,
      status: null,
      majority_type: null,
      closing_type: null,
      closing_duration_seconds: null,
      closing_end_time: null,
      visibility: 'public',
      max_votes: 1,
    };
    expect(createElectionSchema.parse(base)).toEqual(
      expect.objectContaining({ ballot_visibility: 'secret', offline_electorate_size: 0 })
    );
    expect(
      createElectionSchema.parse({
        ...base,
        ballot_visibility: 'named',
        offline_electorate_size: 4,
      })
    ).toEqual(expect.objectContaining({ ballot_visibility: 'named', offline_electorate_size: 4 }));
  });
});
