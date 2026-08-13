import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryHarness } from '../../__tests__/test-utils/zeroHarness';

beforeEach(() => vi.resetModules());

describe('assembly reconciliation typefix guard', () => {
  it('ignores an offline membership that disappears after indexing', async () => {
    const harness = createQueryHarness();
    let offlineMemberReads = 0;
    const membership = {
      get group_offline_member() {
        offlineMemberReads += 1;
        return offlineMemberReads === 1
          ? {
              id: 'offline-member-1',
              first_name: 'Ada',
              last_name: 'Lovelace',
              connected_user_id: null,
            }
          : null;
      },
    };

    vi.doMock('../../schema', () => ({ zql: harness.zql }));
    vi.doMock('../../groups/membership-helpers', () => ({
      loadGroupWithDerivedNetworkMeta: vi.fn(async () => ({
        id: 'group-1',
        group_type: 'flat',
      })),
      buildGroupsById: vi.fn(async () => new Map()),
      loadActiveHierarchyRelationships: vi.fn(async () => []),
    }));
    vi.doMock('../../groups/offline-membership-helpers', () => ({
      loadEffectiveOfflineMembershipsForGroup: vi.fn(async () => [membership]),
      buildOfflineMembershipPersonKey: ({ offlineMemberId }: { offlineMemberId?: string }) =>
        offlineMemberId ?? null,
    }));
    vi.doMock('@/features/groups/logic/hierarchy', () => ({
      resolveChildBaseGroups: vi.fn(() => []),
    }));
    vi.doMock('../../offline-roster-helpers', () => ({
      getDefaultOfflineParticipationChannel: vi.fn(() => 'offline'),
    }));
    vi.doMock('../../server-helpers', () => ({
      isActiveGroupStatus: vi.fn(() => false),
      recomputeEventCounters: vi.fn(),
      syncUserWithEventConversation: vi.fn(),
    }));
    vi.doMock('../../server-notify', () => ({ fireNotification: vi.fn() }));

    const { reconcileGeneralAssemblyParticipantsForEvent } = await import('../assembly-reconcile');
    const event = {
      id: 'event-1',
      event_type: 'general_assembly',
      group_id: 'group-1',
      attendance_mode: 'offline',
      start_date: Date.now() + 60_000,
    };
    const tx = {
      run: vi.fn(async (query: { table?: string; calls?: unknown[] }) => {
        if (query.table === 'event') return event;
        return [];
      }),
      mutate: {
        event_participant: { insert: vi.fn(), delete: vi.fn() },
        event_participant_role: { insert: vi.fn(), delete: vi.fn() },
        event_offline_participant: { insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
      },
    };

    await reconcileGeneralAssemblyParticipantsForEvent(tx as never, event.id);

    expect(offlineMemberReads).toBe(2);
    expect(tx.mutate.event_offline_participant.insert).not.toHaveBeenCalled();
  });
});
