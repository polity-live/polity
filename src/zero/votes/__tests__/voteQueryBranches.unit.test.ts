import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryHarness } from '../../__tests__/test-utils/zeroHarness';

describe('vote query branches', () => {
  beforeEach(() => vi.resetModules());

  it('builds empty and fully filtered decision pages for users and anonymous viewers', async () => {
    const harness = createQueryHarness();
    vi.doMock('@rocicorp/zero', () => ({
      defineQuery: (_schema: unknown, fn: unknown) => ({ fn }),
    }));
    vi.doMock('../../schema', () => ({ zql: harness.zql }));
    vi.doMock('../../rbac/query-access', () => ({
      applyAgendaItemQueryAccess: (query: unknown) => query,
      applyAmendmentQueryAccess: (query: unknown) => query,
      applyEventQueryAccess: (query: unknown) => query,
      applyVoteManagerQueryAccess: (query: unknown) => query,
      applyVoteQueryAccess: (query: unknown) => query,
      applyVoteVoterOrManagerQueryAccess: (query: unknown) => query,
    }));
    const { voteQueries } = await import('../queries');
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
      query: ' budget ',
      limit: 20,
      start: { id: 'vote-1', created_at: 1 },
      dir: 'backward',
    };

    voteQueries.decisionOverviewPage.fn({ args: empty, ctx: { userID: undefined } } as never);
    expect(harness.lastQuery('vote').calls).toContainEqual(['orderBy', 'created_at', 'desc']);
    voteQueries.decisionOverviewPage.fn({ args: full, ctx: { userID: 'user-1' } } as never);
    expect(harness.lastQuery('vote').calls).toEqual(
      expect.arrayContaining([
        ['where', 'status', 'final'],
        ['where', 'status', 'IN', ['final', 'closed']],
        ['where', 'title', 'ILIKE', '%budget%'],
        ['orderBy', 'created_at', 'asc'],
        ['start', full.start, { inclusive: false }],
      ])
    );
    voteQueries.decisionPage.fn({ args: empty, ctx: { userID: undefined } } as never);
    voteQueries.decisionPage.fn({ args: full, ctx: { userID: 'user-1' } } as never);
    voteQueries.viewerDecisionState.fn({ args: { ids: [] }, ctx: { userID: undefined } } as never);
    voteQueries.viewerDecisionState.fn({
      args: { ids: ['vote-1'] },
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
      vote_id: 'vote-1',
      limit: 20,
      start: null,
      status: undefined,
      statuses: [],
      groupIds: [],
      query: '',
      dir: 'forward',
    };
    for (const query of Object.values(voteQueries)) {
      query.fn({ args: broadArgs, ctx: { userID: undefined } } as never);
      query.fn({ args: broadArgs, ctx: { userID: 'user-1' } } as never);
    }
  });
});
