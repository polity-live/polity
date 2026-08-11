/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  amendments: [] as any[],
  stepRuns: [] as any[],
  amendmentsLoading: false,
  stepRunsLoading: false,
}));

vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupAmendments: () => ({
    amendments: mocks.amendments,
    isLoading: mocks.amendmentsLoading,
  }),
  useGroupAmendmentEventStepRuns: () => ({
    stepRuns: mocks.stepRuns,
    isLoading: mocks.stepRunsLoading,
  }),
}));
vi.mock('@/features/groups/logic/groupAmendmentStatus', () => ({
  getGroupAmendmentBadgeStatus: (decision: string | null, status?: string | null) =>
    decision === 'badge-null' || status === 'badge-null' ? null : `badge:${decision ?? status}`,
  normalizeGroupAmendmentDisplayStatus: (decision: string | null, status?: string | null) =>
    decision === 'display-null' || status === 'display-null'
      ? null
      : `display:${decision ?? status}`,
}));
vi.mock('@/features/amendments/logic/amendmentBranchDisplay', () => ({
  getOrderedBranches: (branches: any[]) =>
    [...branches].sort((a, b) => a.created_at - b.created_at),
  mapAmendmentBranchStatusChips: (branches: any[]) => branches.map(branch => branch.id),
}));

import { useGroupAmendments } from '../useGroupAmendments';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.amendments = [];
  mocks.stepRuns = [];
  mocks.amendmentsLoading = false;
  mocks.stepRunsLoading = false;
});

describe('useGroupAmendments', () => {
  it('maps decisions, filters invalid states, normalizes fallbacks, and sorts newest first', () => {
    mocks.amendments = [
      { id: 'badge-invalid', status: 'badge-null' },
      { id: 'display-invalid', status: 'display-null' },
      {
        id: 'full',
        amendment_id: 'fallback-full',
        status: 'accepted',
        decided_at: 400,
        updated_at: 300,
        created_at: 200,
        process_step_run_id: 'shared-step',
        amendment: {
          id: 'amendment-full',
          title: 'Title',
          reason: 'Reason',
          code: 'A-1',
          amendment_hashtags: [{ hashtag: { id: 'tag', tag: 'tag' } }],
          current_process_run: {
            branches: [
              { id: 'later', editing_mode: 'later-mode', created_at: 2 },
              { id: 'first', editing_mode: 'first-mode', created_at: 1 },
            ],
          },
        },
      },
      {
        id: 'updated',
        amendment_id: 'amendment-updated',
        status: 'pending',
        decided_at: null,
        updated_at: 300,
        created_at: 200,
        process_step_run_id: null,
        amendment: null,
      },
      {
        id: 'created',
        amendment_id: 'amendment-created',
        status: 'pending',
        decided_at: null,
        updated_at: null,
        created_at: 200,
        amendment: { id: null, current_process_run: null, amendment_hashtags: null },
      },
      {
        id: 'undated',
        amendment_id: 'amendment-undated',
        status: 'pending',
        decided_at: null,
        updated_at: null,
        created_at: null,
      },
    ];
    const { result } = renderHook(() =>
      useGroupAmendments('group', [], { after: 'cursor', first: 5 })
    );
    expect(result.current.amendments.map(item => item.id)).toEqual([
      'full',
      'updated',
      'created',
      'undated',
    ]);
    expect(result.current.amendments[0]).toMatchObject({
      amendment_id: 'amendment-full',
      title: 'Title',
      subtitle: 'Reason',
      code: 'A-1',
      editing_mode: 'first-mode',
      date: 400,
      process_step_run_id: 'shared-step',
      branchStatuses: ['later', 'first'],
    });
    expect(result.current.amendments[1]).toMatchObject({
      amendment_id: 'amendment-updated',
      title: null,
      subtitle: null,
      code: null,
      editing_mode: null,
      amendment_hashtags: [],
    });
  });

  it('maps event step runs, rejects incomplete rows, deduplicates decisions, and covers date fallbacks', () => {
    mocks.amendments = [
      {
        id: 'decision',
        amendment_id: 'amendment',
        status: 'accepted',
        decided_at: 500,
        process_step_run_id: 'duplicate',
        amendment: { id: 'amendment' },
      },
    ];
    mocks.stepRuns = [
      { id: 'badge-invalid', decision_status: 'badge-null', status: 'pending' },
      { id: 'display-invalid', decision_status: 'display-null', status: 'pending' },
      { id: 'missing-amendment', decision_status: 'pending', status: 'pending', process_run: null },
      {
        id: 'duplicate',
        decision_status: 'pending',
        status: 'pending',
        ends_at: 600,
        process_run: { amendment: { id: 'amendment', title: 'Duplicate' } },
      },
      {
        id: 'ended',
        decision_status: null,
        status: 'pending',
        ends_at: 400,
        process_run: {
          amendment: {
            id: 'ended-amendment',
            title: 'Ended',
            reason: 'Reason',
            code: 'E-1',
            amendment_hashtags: [],
            current_process_run: { branches: [] },
          },
        },
      },
      {
        id: 'updated',
        decision_status: null,
        status: 'pending',
        ends_at: null,
        updated_at: 300,
        created_at: 200,
        process_run: { amendment: { id: 'updated-amendment', current_process_run: null } },
      },
      {
        id: 'created',
        decision_status: null,
        status: 'pending',
        ends_at: null,
        updated_at: null,
        created_at: 200,
        process_run: { amendment: { id: 'created-amendment' } },
      },
      {
        id: 'undated',
        decision_status: null,
        status: 'pending',
        ends_at: null,
        updated_at: null,
        created_at: null,
        process_run: { amendment: { id: 'undated-amendment' } },
      },
    ];
    const { result } = renderHook(() => useGroupAmendments('group', ['event']));
    expect(result.current.amendments.map(item => item.id)).toEqual([
      'decision',
      'event-step:ended',
      'event-step:updated',
      'event-step:created',
      'event-step:undated',
    ]);
    expect(result.current.amendments.find(item => item.id === 'event-step:ended')).toMatchObject({
      amendment_id: 'ended-amendment',
      title: 'Ended',
      subtitle: 'Reason',
      code: 'E-1',
      editing_mode: null,
      date: 400,
      process_step_run_id: 'ended',
      amendment_hashtags: [],
    });
  });

  it('combines both loading sources', () => {
    mocks.amendmentsLoading = true;
    expect(renderHook(() => useGroupAmendments('group', [])).result.current.isLoading).toBe(true);
    mocks.amendmentsLoading = false;
    mocks.stepRunsLoading = true;
    expect(renderHook(() => useGroupAmendments('group', [])).result.current.isLoading).toBe(true);
    mocks.stepRunsLoading = false;
    expect(renderHook(() => useGroupAmendments('group', [])).result.current.isLoading).toBe(false);
  });
});
