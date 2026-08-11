import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryHarness } from '../../__tests__/test-utils/zeroHarness';

describe('agenda query and schema branches', () => {
  beforeEach(() => vi.resetModules());

  it('builds speaker pages in both directions with and without cursors', async () => {
    const harness = createQueryHarness();
    vi.doMock('@rocicorp/zero', () => ({
      defineQuery: (_schema: unknown, fn: unknown) => ({ fn }),
    }));
    vi.doMock('../../schema', () => ({ zql: harness.zql }));
    vi.doMock('../../rbac/query-access', () => ({
      applyAgendaItemQueryAccess: (query: unknown) => query,
      applyAmendmentQueryAccess: (query: unknown) => query,
      applyElectionQueryAccess: (query: unknown) => query,
      applyEventQueryAccess: (query: unknown) => query,
      applyVoteManagerQueryAccess: (query: unknown) => query,
      applyVoteQueryAccess: (query: unknown) => query,
      applyVoteVoterOrManagerQueryAccess: (query: unknown) => query,
    }));
    const { agendaQueries } = await import('../queries');

    agendaQueries.speakerPage.fn({
      args: { agendaItemId: 'agenda-1', limit: 20, start: null, dir: 'forward' },
      ctx: { userID: 'user-1', email: 'user@example.test' },
    });
    expect(harness.lastQuery('speaker_list').calls).toContainEqual([
      'orderBy',
      'order_index',
      'asc',
    ]);
    expect(harness.lastQuery('speaker_list').calls.some(call => call[0] === 'start')).toBe(false);

    harness.reset();
    const cursor = { id: 'speaker-1', order_index: 1 };
    agendaQueries.changeRequestPage.fn({
      args: { agendaItemId: 'agenda-1', limit: 20, start: cursor, dir: 'backward' },
      ctx: { userID: 'user-1', email: 'user@example.test' },
    });
    expect(harness.lastQuery('agenda_item_change_request').calls).toEqual(
      expect.arrayContaining([
        ['orderBy', 'order_index', 'desc'],
        ['start', cursor, { inclusive: false }],
      ])
    );
  });

  it('applies defaults and preserves explicit change-request metadata', async () => {
    const { createAgendaItemChangeRequestSchema } = await import('../schema');
    const base = {
      id: 'link-1',
      agenda_item_id: 'agenda-1',
      change_request_id: null,
      vote_id: null,
      order_index: 0,
      is_closing_vote: false,
      status: 'pending',
    };

    expect(createAgendaItemChangeRequestSchema.parse(base)).toEqual(
      expect.objectContaining({
        step_kind: 'change_request',
        process_branch_id: null,
        blocked_reason: null,
        result_status: null,
        obsolete_reason: null,
      })
    );
    expect(
      createAgendaItemChangeRequestSchema.parse({
        ...base,
        step_kind: 'closing',
        process_branch_id: 'branch-1',
        blocked_reason: 'blocked',
        result_status: 'passed',
        obsolete_reason: 'replaced',
      })
    ).toEqual(
      expect.objectContaining({
        step_kind: 'closing',
        process_branch_id: 'branch-1',
        blocked_reason: 'blocked',
        result_status: 'passed',
        obsolete_reason: 'replaced',
      })
    );
  });
});
