/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildSuggestionPreviewResolutions: vi.fn(() => new Map([['discussion-a', 'accept']])),
  sortChangeRequestsByVoteOrder: vi.fn(
    (items: any[], _sortMode: string, options: Record<string, any>) => {
      for (const item of items) {
        const changeRequest = options.getChangeRequest(item);
        options.getSuggestionId(item, changeRequest);
      }
      return [...items];
    }
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../logic/createMockCRTimelineItems', () => ({
  getCRFilterStatus: (item: { filterStatus?: string }) => item.filterStatus ?? 'open',
  isPendingSubmissionCRTimelineItem: (item: { pending?: boolean }) => Boolean(item.pending),
}));

vi.mock('../../hooks/useAgendaItemCRVoting', () => ({
  getVoteResult: (item: { result?: string }) => item.result ?? 'pending',
}));

vi.mock('../../logic/changeRequestDocumentPreview', () => ({
  buildCrIdToDiscussionId: (discussions?: any[]) =>
    new Map(
      (discussions ?? []).flatMap(discussion => {
        const entries: [string, string][] = [[discussion.id, discussion.id]];
        if (discussion.crId) entries.push([discussion.crId, discussion.id]);
        return entries;
      })
    ),
  buildSuggestionPreviewResolutions: mocks.buildSuggestionPreviewResolutions,
  getPreviewVoteStepKind: (item: { _voteStepKind?: string }) => item._voteStepKind ?? null,
  resolvePreviewCrIdForTimelineItem: (item: { previewCrId?: string | null }) =>
    item.previewCrId ?? null,
  resolvePreviewSuggestionIdForTimelineItem: (item: { suggestionId?: string | null }) =>
    item.suggestionId ?? null,
}));

vi.mock('@/features/change-requests/logic/changeRequestVoteOrder', () => ({
  buildSuggestionDocumentOrder: () => new Map([['discussion-a', 0]]),
  normalizeChangeRequestVoteOrder: (value: string | null | undefined) =>
    value === 'cr_number' ? 'cr_number' : 'text_position',
  sortChangeRequestsByVoteOrder: mocks.sortChangeRequestsByVoteOrder,
}));

import {
  sortChangeRequestTimelineItems,
  useChangeRequestCardsListController,
} from '../useChangeRequestCardsListController';

afterEach(() => {
  vi.clearAllMocks();
});

function base(overrides: Record<string, unknown> = {}) {
  return {
    items: [],
    obsoleteItems: [],
    editingMode: 'suggest_event',
    isVotingActive: false,
    ...overrides,
  } as never;
}

describe('useChangeRequestCardsListController branches', () => {
  it('adapts sort callbacks with and without CR and discussion mappings', () => {
    const items = [
      { id: 'wrapped', change_request: { id: 'cr-wrapped' }, suggestionId: 'suggestion-1' },
      { id: 'direct', suggestionId: null },
    ];

    expect(sortChangeRequestTimelineItems(items as never, 'text_position')).toEqual(items);
    expect(
      sortChangeRequestTimelineItems(items as never, 'cr_number', {
        crIdToDiscussionId: new Map([['cr-wrapped', 'discussion-a']]),
        suggestionDocumentOrder: new Map([['discussion-a', 0]]),
      })
    ).toEqual(items);
  });

  it('builds, filters, searches, and selects a complete CR sequence', () => {
    const variant = { id: 'variant', _voteStepKind: 'merge_variant' };
    const placeholder = {
      id: 'placeholder',
      _voteStepKind: 'change_request_votes_placeholder',
    };
    const closing = { id: 'closing', is_closing_vote: true };
    const accepted = {
      id: 'accepted',
      filterStatus: 'accepted',
      previewCrId: 'cr-a',
      change_request: { title: 'Alpha', description: null },
    };
    const rejected = {
      id: 'rejected',
      filterStatus: 'rejected',
      previewCrId: 'cr-b',
      change_request: { title: null, description: 'Beta motion' },
    };
    const open = {
      id: 'open',
      filterStatus: 'open',
      previewCrId: 'unmapped',
      change_request: {},
    };
    const pending = {
      id: 'pending',
      pending: true,
      previewCrId: null,
      change_request: { title: 'Pending' },
    };
    const obsolete = {
      id: 'obsolete',
      previewCrId: 'cr-obsolete',
      change_request: { title: 'Old Alpha', description: '' },
    };
    const untitledObsolete = {
      id: 'obsolete-untitled',
      previewCrId: null,
      change_request: { title: null, description: null },
    };
    const inputs = base({
      items: [variant, placeholder, closing, accepted, rejected, open, pending],
      obsoleteItems: [obsolete, untitledObsolete],
      isVotingActive: true,
      currentItemId: 'accepted',
      progress: 0.456,
      amendmentId: 'amendment-1',
      documentContent: [{ children: [{ text: 'Document' }] }],
      discussions: [
        { id: 'discussion-a', crId: 'cr-a' },
        { id: 'discussion-b', crId: 'cr-b' },
      ],
      defaultSortMode: 'cr_number',
    });
    const { result } = renderHook(() => useChangeRequestCardsListController(inputs));

    expect(result.current.variantVoteItem).toBe(variant);
    expect(result.current.closingVoteItem).toBe(closing);
    expect(result.current.sequenceItems).toEqual([variant, placeholder, closing]);
    expect(result.current.hasCRCategoryItems).toBe(true);
    expect(result.current.sharedPreviewEnabled).toBe(true);
    expect(result.current.progressPercent).toBe(46);
    expect(result.current.selectedPreviewCrIds).toEqual(new Set(['cr-a']));
    expect(result.current.defaultPreviewCrId).toBe('cr-a');
    expect(result.current.effectivePreviewCrIds).toEqual(new Set(['cr-a']));
    expect(result.current.selectedPreviewSuggestionIds).toEqual(new Set(['discussion-a']));
    expect(result.current.getFilteredItems('open')).toContain(open);
    expect(result.current.getFilteredItems('accepted')).toEqual([accepted]);
    expect(result.current.getFilteredItems('rejected')).toEqual([rejected]);
    expect(result.current.getFilteredItems('obsolete')).toEqual([obsolete, untitledObsolete]);
    expect(result.current.getFilteredItems('all')).toEqual([
      variant,
      accepted,
      rejected,
      open,
      pending,
      closing,
    ]);

    act(() => result.current.setSearchQuery('alpha'));
    expect(result.current.searchedItems).toEqual([accepted]);
    expect(result.current.searchedObsoleteItems).toEqual([obsolete]);
    act(() => result.current.setSearchQuery('beta'));
    expect(result.current.searchedItems).toEqual([rejected]);
    expect(result.current.searchedObsoleteItems).toEqual([]);

    act(() => result.current.setActiveTab('rejected'));
    expect(result.current.activeTab).toBe('rejected');
    expect(result.current.filteredItems).toEqual([rejected]);
    act(() => result.current.setSortMode('text_position'));
    expect(result.current.sortMode).toBe('text_position');

    act(() => result.current.setSelectedPreviewCrIds(new Set(['unmapped'])));
    expect(result.current.normalizedPreviewCrIds).toEqual(new Set(['unmapped']));
    expect(result.current.selectedPreviewSuggestionIds).toEqual(
      new Set(['discussion-a', 'discussion-b'])
    );
    act(() => result.current.setSelectedPreviewCrIds(new Set(['invalid'])));
    expect(result.current.normalizedPreviewCrIds).toBeNull();
    act(() => result.current.setSelectedPreviewCrIds(new Set()));
    expect(result.current.normalizedPreviewCrIds).toBeNull();
  });

  it('falls back to sequence-only and all-suggestion states', () => {
    const variant = { id: 'variant', _voteStepKind: 'merge_variant' };
    const votable = { id: 'votable', _voteStepKind: null };
    const closing = { id: 'closing', is_closing_vote: true };
    const { result } = renderHook(() =>
      useChangeRequestCardsListController(
        base({
          items: [variant, votable, closing],
          discussions: [{ id: 'discussion-a' }],
          editingMode: 'view',
          progress: 0,
        })
      )
    );

    expect(result.current.hasCRCategoryItems).toBe(true);
    expect(result.current.sequenceItems).toEqual([variant, votable, closing]);
    expect(result.current.sharedPreviewEnabled).toBe(false);
    expect(result.current.progressPercent).toBe(0);
    expect(result.current.defaultPreviewCrId).toBeNull();
    expect(result.current.effectivePreviewCrIds).toBeNull();
    expect(result.current.selectedPreviewSuggestionIds).toEqual(new Set(['discussion-a']));
  });

  it('normalizes a non-all tab when only synthetic sequence items exist', () => {
    const synthetic = { id: 'placeholder', _voteStepKind: 'change_request_votes_placeholder' };
    const { result } = renderHook(() =>
      useChangeRequestCardsListController(base({ items: [synthetic], discussions: undefined }))
    );

    act(() => result.current.setActiveTab('accepted'));
    expect(result.current.activeTab).toBe('all');
    expect(result.current.filteredItems).toEqual([synthetic]);
    expect(result.current.selectedPreviewSuggestionIds).toEqual(new Set());
  });

  it('enables shared preview from document discussions without an amendment', () => {
    const row = { id: 'row', previewCrId: 'cr-a', change_request: { title: 'Row' } };
    const { result } = renderHook(() =>
      useChangeRequestCardsListController(
        base({
          items: [row],
          editingMode: 'view',
          documentContent: [],
          discussions: [{ id: 'discussion-a', crId: 'cr-a' }],
        })
      )
    );

    expect(result.current.sharedPreviewEnabled).toBe(true);
    expect(result.current.defaultPreviewCrId).toBe('cr-a');
  });

  it('falls back to an empty suggestion set for an unmapped selected CR', () => {
    const row = { id: 'row', previewCrId: 'unmapped', change_request: { title: 'Row' } };
    const { result } = renderHook(() =>
      useChangeRequestCardsListController(
        base({ items: [row], currentItemId: 'row', discussions: undefined })
      )
    );

    expect(result.current.effectivePreviewCrIds).toEqual(new Set(['unmapped']));
    expect(result.current.selectedPreviewSuggestionIds).toEqual(new Set());
  });
});
