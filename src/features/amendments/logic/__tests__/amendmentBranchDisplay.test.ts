import { describe, expect, it } from 'vitest';
import {
  getBranchEditingModeDisabledReasons,
  getBranchEditingMode,
  getOrderedBranches,
  mapAmendmentBranchStatusChips,
  resolveEventDetailSelectedBranchId,
  resolveSelectedBranchId,
  type AmendmentProcessBranchSource,
} from '../amendmentBranchDisplay';

describe('amendmentBranchDisplay', () => {
  it('orders branches by created_at and then id', () => {
    const branches: AmendmentProcessBranchSource[] = [
      { id: 'branch-c', title: 'C', created_at: 200 },
      { id: 'branch-b', title: 'B', created_at: 100 },
      { id: 'branch-a', title: 'A', created_at: 100 },
    ];

    expect(getOrderedBranches(branches).map(branch => branch.id)).toEqual([
      'branch-a',
      'branch-b',
      'branch-c',
    ]);
  });

  it('maps branch workflow statuses in stable branch order', () => {
    const branches: AmendmentProcessBranchSource[] = [
      {
        id: 'BR2',
        title: 'BR2',
        created_at: 2,
        editing_mode: 'suggest_event',
        status: 'scheduled',
        resolution: null,
      },
      {
        id: 'BR1',
        title: 'BR1',
        created_at: 1,
        editing_mode: 'suggest_internal',
        status: 'pending_event',
        resolution: 'open',
      },
    ];

    expect(mapAmendmentBranchStatusChips(branches)).toEqual([
      {
        branchId: 'BR1',
        label: 'BR1',
        editingMode: 'suggest_internal',
        processStatus: 'pending_event',
        resolution: 'open',
      },
      {
        branchId: 'BR2',
        label: 'BR2',
        editingMode: 'suggest_event',
        processStatus: 'scheduled',
        resolution: null,
      },
    ]);
  });

  it('normalizes missing and legacy branch workflow modes', () => {
    expect(getBranchEditingMode(null)).toBe('edit');
    expect(getBranchEditingMode({ id: 'branch-1', editing_mode: 'internal_voting' })).toBe(
      'vote_internal'
    );
  });

  it('allows manual internal mode changes before the first agenda item starts', () => {
    const branch: AmendmentProcessBranchSource = {
      id: 'branch-1',
      editing_mode: 'edit',
      status: 'scheduled',
      resolution: null,
      step_runs: [
        {
          order_index: 0,
          event_id: 'event-1',
          agenda_item: { status: 'planned' },
        },
      ],
    };

    expect(getBranchEditingModeDisabledReasons(branch)).toMatchObject({
      suggest_event: 'event-controlled',
      event_final_closing_vote: 'event-controlled',
    });
    expect(getBranchEditingModeDisabledReasons(branch).edit).toBeUndefined();
    expect(getBranchEditingModeDisabledReasons(branch).vote_internal).toBeUndefined();
  });

  it('blocks manual internal mode changes after the first agenda item starts', () => {
    const branch: AmendmentProcessBranchSource = {
      id: 'branch-1',
      editing_mode: 'edit',
      status: 'scheduled',
      resolution: null,
      step_runs: [
        {
          order_index: 0,
          event_id: 'event-1',
          agenda_item: { status: 'active' },
        },
      ],
    };

    expect(getBranchEditingModeDisabledReasons(branch)).toMatchObject({
      view: 'internal-window-closed',
      edit: 'internal-window-closed',
      suggest_internal: 'internal-window-closed',
      vote_internal: 'internal-window-closed',
      suggest_event: 'event-controlled',
      event_final_closing_vote: 'event-controlled',
    });
  });

  it('blocks every mode for readonly branches', () => {
    const branch: AmendmentProcessBranchSource = {
      id: 'branch-1',
      editing_mode: 'vote_internal',
      status: 'completed',
      resolution: null,
    };

    expect(getBranchEditingModeDisabledReasons(branch)).toEqual({
      view: 'branch-readonly',
      edit: 'branch-readonly',
      suggest_internal: 'branch-readonly',
      vote_internal: 'branch-readonly',
      suggest_event: 'branch-readonly',
      event_final_closing_vote: 'branch-readonly',
    });
  });

  it('resolves the active branch when no requested branch is present', () => {
    const branches: AmendmentProcessBranchSource[] = [
      { id: 'branch-a', created_at: 1, status: 'scheduled' },
      { id: 'branch-b', created_at: 2, status: 'scheduled' },
    ];

    expect(
      resolveSelectedBranchId({
        branches,
        requestedBranchId: null,
        activeBranchId: 'branch-b',
      })
    ).toBe('branch-b');
  });

  it('defaults the event detail branch to the merge winner after a merge result', () => {
    const branches: AmendmentProcessBranchSource[] = [
      {
        id: 'branch-a',
        created_at: 1,
        status: 'completed',
        resolution: 'merge_loser',
        merged_into_branch_id: 'branch-b',
      },
      { id: 'branch-b', created_at: 2, status: 'merged', resolution: 'winner' },
    ];

    expect(
      resolveEventDetailSelectedBranchId({
        branches,
        requestedBranchId: null,
        activeBranchId: 'branch-b',
      })
    ).toBe('branch-b');
  });

  it('defaults the event detail branch to the first ordered branch without a merge result', () => {
    const branches: AmendmentProcessBranchSource[] = [
      { id: 'branch-c', created_at: 2, status: 'scheduled' },
      { id: 'branch-b', created_at: 1, status: 'scheduled' },
      { id: 'branch-a', created_at: 1, status: 'scheduled' },
    ];

    expect(
      resolveEventDetailSelectedBranchId({
        branches,
        requestedBranchId: null,
        activeBranchId: 'branch-c',
      })
    ).toBe('branch-a');
  });

  it('falls back from an invalid manual event detail branch to the default branch', () => {
    const branches: AmendmentProcessBranchSource[] = [
      { id: 'branch-a', created_at: 1, status: 'scheduled' },
      { id: 'branch-b', created_at: 2, status: 'scheduled' },
    ];

    expect(
      resolveEventDetailSelectedBranchId({
        branches,
        requestedBranchId: 'missing-branch',
        activeBranchId: 'branch-b',
      })
    ).toBe('branch-a');
  });
});
