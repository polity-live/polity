import { describe, expect, it } from 'vitest';
import {
  buildBranchDiffCandidates,
  countOpenChangeRequests,
  getBranchCreatedAt,
  getBranchDisplayEvent,
  getBranchDocumentContent,
  getBranchEditingModeDisabledReasons,
  getBranchEditingMode,
  getBranchPathLabel,
  getLatestBranchWithContent,
  getOrderedBranches,
  getOrderedBranchSteps,
  getResolvedMergeWinnerBranch,
  getWinnerBranch,
  isBranchEditable,
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

  it('normalizes missing and unknown branch workflow modes at the data boundary', () => {
    expect(getBranchEditingMode(null)).toBe('edit');
    expect(getBranchEditingMode({ id: 'branch-1', editing_mode: 'internal_voting' })).toBe('edit');
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

  it('covers branch labels, events, content, timestamps, editability, and vote states exhaustively', () => {
    expect(getOrderedBranchSteps(null)).toEqual([]);
    expect(getOrderedBranches(null)).toEqual([]);
    expect(
      getOrderedBranchSteps({
        id: 'branch',
        step_runs: [{ order_index: null }, { order_index: 2 }, { order_index: undefined }],
      }).map(step => step.order_index)
    ).toEqual([null, undefined, 2]);
    expect(getBranchPathLabel(null)).toBeTruthy();
    expect(
      getBranchPathLabel({
        id: 'branch',
        step_runs: [
          { order_index: 3 },
          { target_group: { name: 'Target' } },
          { source_group: { name: 'Source' } },
          { workflow_step: { label: 'Workflow' } },
          { order_index: null },
        ],
      })
    ).toContain('Target');
    expect(getBranchPathLabel({ id: 'branch', title: null })).toBeTruthy();

    expect(
      getBranchDisplayEvent({
        id: 'branch',
        step_runs: [
          { event_id: null },
          { event_id: 'terminal', status: 'completed' },
          { event_id: 'active', status: null },
        ],
      })?.event_id
    ).toBe('active');
    expect(
      getBranchDisplayEvent({
        id: 'branch',
        step_runs: [{ event_id: 'terminal', status: 'completed' }],
      })?.event_id
    ).toBe('terminal');
    expect(getBranchDisplayEvent(null)).toBeNull();

    expect(
      countOpenChangeRequests({
        id: 'branch',
        change_requests: [
          { voting_status: 'completed' },
          { status: 'accepted' },
          { status: 'approved' },
          { status: 'rejected' },
          { status: 'declined' },
          { status: null },
        ],
      })
    ).toBe(1);
    expect(countOpenChangeRequests(null)).toBe(0);
    expect(isBranchEditable(null)).toBe(true);
    expect(isBranchEditable({ id: 'branch', status: 'rejected' })).toBe(false);
    expect(isBranchEditable({ id: 'branch', resolution: 'merge_loser' })).toBe(false);

    expect(getBranchDocumentContent(null)).toBeNull();
    expect(getBranchDocumentContent({ id: 'a', document: { content: 'current' } })).toBe('current');
    expect(getBranchDocumentContent({ id: 'a', document_version: { content: 'version' } })).toBe(
      'version'
    );
    expect(getBranchCreatedAt({ id: 'a', created_at: 12 })).toBe(12);
    expect(getBranchCreatedAt({ id: 'a', created_at: '2026-01-01T00:00:00Z' })).toBeGreaterThan(0);
    expect(getBranchCreatedAt({ id: 'a', created_at: 'invalid' })).toBe(0);
    expect(getBranchCreatedAt(null)).toBe(0);
  });

  it('covers winner and selection fallbacks plus diff candidates', () => {
    const branches: AmendmentProcessBranchSource[] = [
      { id: 'empty', created_at: 0, status: 'rejected', resolution: 'withdrawn' },
      { id: 'active', created_at: 1, status: 'scheduled', document: { content: 'A' } },
      {
        id: 'loser',
        created_at: 2,
        status: 'completed',
        resolution: 'merge_loser',
        merged_into_branch_id: 'winner',
        document_version: { content: 'L' },
      },
      {
        id: 'winner',
        created_at: 3,
        status: 'merged',
        resolution: 'winner',
        document: { content: 'W' },
      },
    ];
    expect(getWinnerBranch(branches, 'active')?.id).toBe('winner');
    expect(getWinnerBranch([{ id: 'merged', status: 'merged' }])?.id).toBe('merged');
    expect(getWinnerBranch([{ id: 'active' }], 'active')?.id).toBe('active');
    expect(getWinnerBranch([], 'active')).toBeNull();
    expect(getResolvedMergeWinnerBranch(branches, 'active')?.id).toBe('winner');
    expect(getResolvedMergeWinnerBranch([{ id: 'winner', resolution: 'accepted' }])?.id).toBe(
      'winner'
    );
    expect(
      getResolvedMergeWinnerBranch([{ id: 'loser', resolution: 'merge_loser' }], 'loser')?.id
    ).toBe('loser');
    expect(
      getResolvedMergeWinnerBranch([{ id: 'loser', resolution: 'merge_loser' }], 'missing')
    ).toBeNull();
    expect(getResolvedMergeWinnerBranch([{ id: 'plain' }], 'plain')).toBeNull();

    expect(resolveEventDetailSelectedBranchId({ branches: [], requestedBranchId: 'x' })).toBeNull();
    expect(resolveEventDetailSelectedBranchId({ branches, requestedBranchId: 'active' })).toBe(
      'active'
    );
    expect(resolveSelectedBranchId({ branches: [], requestedBranchId: 'x' })).toBeNull();
    expect(resolveSelectedBranchId({ branches, requestedBranchId: 'active' })).toBe('active');
    expect(resolveSelectedBranchId({ branches: [{ id: 'editable' }] })).toBe('editable');
    expect(
      resolveSelectedBranchId({
        branches: [{ id: 'winner', resolution: 'winner', status: 'completed' }],
      })
    ).toBe('winner');
    expect(resolveSelectedBranchId({ branches: [{ id: 'none', status: 'rejected' }] })).toBeNull();
    expect(getLatestBranchWithContent(branches)?.id).toBe('winner');

    const candidates = buildBranchDiffCandidates({
      branches,
      originalContent: 'Original',
      activeBranchId: 'active',
    });
    expect(candidates.map(candidate => candidate.id)).toEqual([
      'original-document',
      'active',
      'loser',
      'winner',
    ]);
    expect(buildBranchDiffCandidates({ branches: [{ id: 'empty' }] })).toEqual([]);
  });
});
