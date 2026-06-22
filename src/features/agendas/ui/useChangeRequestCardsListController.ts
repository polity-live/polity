'use client';

import { useState, useMemo, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Value } from 'platejs';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { TDiscussion } from '@/features/editor/types';
import { type ChangeRequestDiffData } from './ChangeRequestTimelineCard';
import {
  getCRFilterStatus,
  isPendingSubmissionCRTimelineItem,
} from '../logic/createMockCRTimelineItems';
import { getVoteResult } from '../hooks/useAgendaItemCRVoting';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';
import {
  buildCrIdToDiscussionId,
  buildSuggestionPreviewResolutions,
  getPreviewVoteStepKind,
  resolvePreviewCrIdForTimelineItem,
  resolvePreviewSuggestionIdForTimelineItem,
} from '../logic/changeRequestDocumentPreview';
import type { EditingMode } from '@/zero/amendments/editing-mode-policy';

export { resolvePreviewCrIdForTimelineItem } from '../logic/changeRequestDocumentPreview';

type TabValue = 'all' | 'open' | 'accepted' | 'rejected';
export type ChangeRequestSortMode = 'number' | 'lexicographic';

const changeRequestSortCollator = new Intl.Collator(undefined, {
  numeric: false,
  sensitivity: 'base',
});

function getVoteStepKind(item: ChangeRequestTimelineRow) {
  return getPreviewVoteStepKind(item);
}

function isSyntheticSequenceStep(item: ChangeRequestTimelineRow) {
  return Boolean(getVoteStepKind(item));
}

function getNumberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null;
}

function getStringValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function extractLastNumber(pattern: RegExp, values: unknown[]) {
  for (const value of values) {
    const text = getStringValue(value);
    if (!text) continue;

    let result: number | null = null;
    let match: RegExpExecArray | null = null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const parsed = Number.parseInt(match[1] ?? '', 10);
      if (Number.isFinite(parsed)) {
        result = parsed;
      }
    }

    if (result !== null) {
      return result;
    }
  }

  return null;
}

function getChangeRequestSortText(item: ChangeRequestTimelineRow) {
  const row = item as Record<string, any>;
  const cr = row.change_request as Record<string, any> | null | undefined;

  return (
    getStringValue(cr?.display_cr_id) ??
    getStringValue(cr?.displayCrId) ??
    getStringValue(cr?.cr_id) ??
    getStringValue(cr?.crId) ??
    getStringValue(cr?.title) ??
    getStringValue(row.change_request_id) ??
    getStringValue(row.id) ??
    ''
  );
}

function getChangeRequestSortNumber(item: ChangeRequestTimelineRow) {
  const row = item as Record<string, any>;
  const cr = row.change_request as Record<string, any> | null | undefined;

  return (
    getNumberValue(cr?.branch_scoped_cr_number) ??
    getNumberValue(cr?.branchScopedCrNumber) ??
    getNumberValue(cr?.branch_sequence_number) ??
    getNumberValue(cr?.branchSequenceNumber) ??
    extractLastNumber(/\bCR-(\d+)\b/gi, [
      cr?.display_cr_id,
      cr?.displayCrId,
      cr?.cr_id,
      cr?.crId,
      cr?.title,
      row.change_request_id,
      row.id,
    ])
  );
}

function getBranchSortNumber(item: ChangeRequestTimelineRow) {
  const row = item as Record<string, any>;
  const cr = row.change_request as Record<string, any> | null | undefined;

  return (
    getNumberValue(cr?.branch_display_number) ??
    getNumberValue(cr?.branchDisplayNumber) ??
    extractLastNumber(/\bBranch\s+(\d+)\b/gi, [cr?.display_cr_id, cr?.displayCrId])
  );
}

function compareNullableNumbers(left: number | null, right: number | null) {
  if (left !== null && right === null) return -1;
  if (left === null && right !== null) return 1;
  if (left !== null && right !== null && left !== right) return left - right;
  return 0;
}

function buildSuggestionDocumentOrder(documentContent: Value | undefined) {
  const suggestionOrder = new Map<string, number>();
  if (!Array.isArray(documentContent)) return suggestionOrder;

  let nodeIndex = 0;

  const visitNodes = (nodes: readonly unknown[]): void => {
    for (const node of nodes) {
      const currentIndex = nodeIndex;
      nodeIndex += 1;

      if (!node || typeof node !== 'object' || Array.isArray(node)) continue;

      for (const key of Object.keys(node)) {
        if (!key.startsWith('suggestion_')) continue;

        const suggestionData = (node as Record<string, unknown>)[key];
        if (!suggestionData || typeof suggestionData !== 'object') continue;

        const suggestionId = getStringValue((suggestionData as Record<string, unknown>).id);
        if (suggestionId && !suggestionOrder.has(suggestionId)) {
          suggestionOrder.set(suggestionId, currentIndex);
        }
      }

      const children = (node as { children?: unknown }).children;
      if (Array.isArray(children)) {
        visitNodes(children);
      }
    }
  };

  visitNodes(documentContent);
  return suggestionOrder;
}

function getChangeRequestDocumentSortOrder(
  item: ChangeRequestTimelineRow,
  crIdToDiscussionId: ReadonlyMap<string, string> | undefined,
  suggestionDocumentOrder: ReadonlyMap<string, number> | undefined
) {
  if (!crIdToDiscussionId || !suggestionDocumentOrder) return null;

  const suggestionId = resolvePreviewSuggestionIdForTimelineItem(item, crIdToDiscussionId);
  if (!suggestionId) return null;

  return suggestionDocumentOrder.get(suggestionId) ?? null;
}

export function sortChangeRequestTimelineItems(
  items: readonly ChangeRequestTimelineRow[],
  sortMode: ChangeRequestSortMode,
  options: {
    crIdToDiscussionId?: ReadonlyMap<string, string>;
    suggestionDocumentOrder?: ReadonlyMap<string, number>;
  } = {}
) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      if (sortMode === 'number') {
        const branchDiff = compareNullableNumbers(
          getBranchSortNumber(left.item),
          getBranchSortNumber(right.item)
        );
        if (branchDiff !== 0) return branchDiff;

        const numberDiff = compareNullableNumbers(
          getChangeRequestSortNumber(left.item),
          getChangeRequestSortNumber(right.item)
        );
        if (numberDiff !== 0) return numberDiff;
      } else {
        const documentOrderDiff = compareNullableNumbers(
          getChangeRequestDocumentSortOrder(
            left.item,
            options.crIdToDiscussionId,
            options.suggestionDocumentOrder
          ),
          getChangeRequestDocumentSortOrder(
            right.item,
            options.crIdToDiscussionId,
            options.suggestionDocumentOrder
          )
        );
        if (documentOrderDiff !== 0) return documentOrderDiff;
      }

      const labelDiff = changeRequestSortCollator.compare(
        getChangeRequestSortText(left.item),
        getChangeRequestSortText(right.item)
      );
      if (labelDiff !== 0) return labelDiff;

      return left.index - right.index;
    })
    .map(entry => entry.item);
}

interface ChangeRequestCardsListProps {
  items: ChangeRequestTimelineRow[];
  editingMode: EditingMode;
  isVotingActive: boolean;
  userId?: string;
  canManage?: boolean;
  canVote?: boolean;
  hideInlineVotingControls?: boolean;
  /** Allow starting final votes from CR cards. Defaults off so agenda toolbar owns sequencing. */
  allowInlineFinalVoteStart?: boolean;
  /** Show agenda-details-only per-card vote phase actions. */
  showAgendaDetailsVoteActions?: boolean;
  /** Explanation shown when agenda-details card vote actions are visible but unavailable. */
  voteDisabledTooltip?: string;
  currentItemId?: string | null;
  /** Map from CR change_request_id (or mock item id) to diff data */
  diffMap?: Record<string, ChangeRequestDiffData>;
  /** Progress through the voting timeline (0-1) */
  progress?: number;
  /** Eligible voters expected for final votes, including confirmed offline attendees. */
  eligibleFinalVoterCount?: number;
  completedCount?: number;
  allCRsProcessed?: boolean;
  isTimelineComplete?: boolean;
  /** Document content for editor preview */
  documentContent?: Value;
  /** Agenda or amendment title used for final closing vote labels. */
  agendaTitle?: string | null;
  /** Discussion entries from amendment for CR ID mapping */
  discussions?: TDiscussion[];
  /** Amendment ID — needed for interactive editor and mode selector */
  amendmentId?: string;
  /** Agenda item ID — passed to interactive editor */
  agendaItemId?: string;
  /** Current user record — passed to interactive editor for author/avatar display */
  userRecord?: {
    id: string;
    name?: string;
    email?: string | null;
    avatar?: string;
  };
  hasUserVoted?: (item: ChangeRequestTimelineRow) => boolean;
  getUserSelectedChoiceIds?: (item: ChangeRequestTimelineRow) => string[];
  onCastVote?: (item: ChangeRequestTimelineRow, choiceId: string) => Promise<void>;
  onOpenVoteDialog?: (itemId: string) => void;
  onStartIndicative?: (itemId: string) => Promise<void>;
  onStartFinal?: (itemId: string) => Promise<void>;
  onCloseVoting?: (itemId: string) => Promise<void> | Promise<unknown>;
  onFinalizeInternalVote?: (changeRequestId: string) => Promise<void>;
  sequenceInterstitial?: ReactNode;
}
export function useChangeRequestCardsListController({
  items,
  editingMode,
  isVotingActive,
  userId,
  canManage = false,
  canVote = false,
  hideInlineVotingControls = false,
  allowInlineFinalVoteStart = false,
  showAgendaDetailsVoteActions = false,
  voteDisabledTooltip,
  currentItemId,
  diffMap,
  progress,
  eligibleFinalVoterCount,
  completedCount,
  allCRsProcessed,
  isTimelineComplete,
  documentContent,
  agendaTitle,
  discussions,
  amendmentId,
  agendaItemId,
  userRecord,
  hasUserVoted,
  getUserSelectedChoiceIds,
  onCastVote,
  onOpenVoteDialog,
  onStartIndicative,
  onStartFinal,
  onCloseVoting,
  onFinalizeInternalVote,
  sequenceInterstitial,
}: ChangeRequestCardsListProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<ChangeRequestSortMode>('lexicographic');

  // Build crId → discussion UUID map from discussions
  const crIdToDiscussionId = useMemo(() => buildCrIdToDiscussionId(discussions), [discussions]);

  // Separate sequence boundary votes from regular CR items for filtering
  const closingVoteItem = useMemo(() => items.find(i => i.is_closing_vote), [items]);
  const variantVoteItem = useMemo(
    () =>
      items.find(i => {
        const stepKind = getVoteStepKind(i);
        return stepKind === 'merge_variant';
      }) ?? null,
    [items]
  );
  const changeRequestVotesPlaceholderItem = useMemo(
    () => items.find(i => getVoteStepKind(i) === 'change_request_votes_placeholder') ?? null,
    [items]
  );
  const unsortedCrItems = useMemo(
    () => items.filter(i => !i.is_closing_vote && !isSyntheticSequenceStep(i)),
    [items]
  );
  const suggestionDocumentOrder = useMemo(
    () => buildSuggestionDocumentOrder(documentContent),
    [documentContent]
  );
  const crItems = useMemo(
    () =>
      sortChangeRequestTimelineItems(unsortedCrItems, sortMode, {
        crIdToDiscussionId,
        suggestionDocumentOrder,
      }),
    [crIdToDiscussionId, sortMode, suggestionDocumentOrder, unsortedCrItems]
  );
  const votableCrItems = useMemo(
    () => crItems.filter(item => !isPendingSubmissionCRTimelineItem(item)),
    [crItems]
  );
  const sequenceItems = useMemo(
    () => [
      ...(variantVoteItem ? [variantVoteItem] : []),
      ...(changeRequestVotesPlaceholderItem ? [changeRequestVotesPlaceholderItem] : votableCrItems),
      ...(closingVoteItem ? [closingVoteItem] : []),
    ],
    [changeRequestVotesPlaceholderItem, closingVoteItem, variantVoteItem, votableCrItems]
  );
  const hasCRCategoryItems = crItems.length > 0;

  useEffect(() => {
    if (!hasCRCategoryItems && activeTab !== 'all') {
      setActiveTab('all');
    }
  }, [activeTab, hasCRCategoryItems]);

  const sharedPreviewEnabled = useMemo(
    () =>
      Boolean(
        ((editingMode === 'suggest_event' || editingMode === 'event_final_closing_vote') &&
          amendmentId) ||
        (documentContent && discussions && discussions.length > 0)
      ),
    [amendmentId, discussions, documentContent, editingMode]
  );

  const getPreviewCrId = (item: ChangeRequestTimelineRow): string | null => {
    return resolvePreviewCrIdForTimelineItem(item, crIdToDiscussionId);
  };

  const [selectedPreviewCrIds, setSelectedPreviewCrIds] = useState<Set<string> | null>(() => {
    const defaultItem =
      items.find(
        item => item.id === currentItemId && !item.is_closing_vote && !isSyntheticSequenceStep(item)
      ) ?? crItems[0];
    const previewCrId = defaultItem ? getPreviewCrId(defaultItem) : null;
    return previewCrId ? new Set([previewCrId]) : null;
  });

  // Text search filter
  const searchedItems = useMemo(() => {
    if (!searchQuery.trim()) return crItems;
    const query = searchQuery.toLowerCase();
    return crItems.filter(item => {
      const cr = item.change_request;
      const title = cr?.title?.toLowerCase() ?? '';
      const description = cr?.description?.toLowerCase() ?? '';
      return title.includes(query) || description.includes(query);
    });
  }, [crItems, searchQuery]);

  // Categorize CR items by status for tabs
  const categorized = useMemo(() => {
    const open: ChangeRequestTimelineRow[] = [];
    const accepted: ChangeRequestTimelineRow[] = [];
    const rejected: ChangeRequestTimelineRow[] = [];

    for (const item of searchedItems) {
      const filterStatus = getCRFilterStatus(
        item,
        isVotingActive ? (getVoteResult as (item: never) => string) : undefined
      );
      if (filterStatus === 'accepted') accepted.push(item);
      else if (filterStatus === 'rejected') rejected.push(item);
      else open.push(item);
    }

    return { open, accepted, rejected };
  }, [searchedItems, isVotingActive]);

  const getFilteredItems = (tab: TabValue): ChangeRequestTimelineRow[] => {
    if (!hasCRCategoryItems) {
      return sequenceItems;
    }

    switch (tab) {
      case 'open':
        return categorized.open;
      case 'accepted':
        return categorized.accepted;
      case 'rejected':
        return categorized.rejected;
      case 'all':
      default:
        return [
          ...(variantVoteItem ? [variantVoteItem] : []),
          ...searchedItems,
          ...(closingVoteItem ? [closingVoteItem] : []),
        ];
    }
  };

  const effectiveActiveTab = hasCRCategoryItems ? activeTab : 'all';
  const filteredItems = getFilteredItems(effectiveActiveTab);
  const progressPercent = progress ? Math.round(progress * 100) : 0;

  const availablePreviewCrIds = useMemo(
    () =>
      new Set(
        crItems.map(item => getPreviewCrId(item)).filter((value): value is string => Boolean(value))
      ),
    [crIdToDiscussionId, crItems]
  );

  const defaultPreviewCrId = useMemo(() => {
    const currentPreviewItem = currentItemId
      ? crItems.find(item => item.id === currentItemId)
      : undefined;
    const currentPreviewCrId = currentPreviewItem ? getPreviewCrId(currentPreviewItem) : null;
    if (currentPreviewCrId) {
      return currentPreviewCrId;
    }

    const firstFilteredPreviewCrId = filteredItems
      .map(item => getPreviewCrId(item))
      .find((value): value is string => Boolean(value));

    if (firstFilteredPreviewCrId) {
      return firstFilteredPreviewCrId;
    }

    return (
      crItems.map(item => getPreviewCrId(item)).find((value): value is string => Boolean(value)) ??
      null
    );
  }, [crIdToDiscussionId, crItems, currentItemId, filteredItems]);

  const normalizedPreviewCrIds = useMemo(() => {
    if (!selectedPreviewCrIds || selectedPreviewCrIds.size === 0) {
      return null;
    }

    const validCrIds = [...selectedPreviewCrIds].filter(crId => availablePreviewCrIds.has(crId));
    return validCrIds.length > 0 ? new Set(validCrIds) : null;
  }, [availablePreviewCrIds, selectedPreviewCrIds]);

  const effectivePreviewCrIds =
    normalizedPreviewCrIds ?? (defaultPreviewCrId ? new Set([defaultPreviewCrId]) : null);

  const selectedPreviewSuggestionIds = useMemo(() => {
    if (!effectivePreviewCrIds) {
      return new Set(discussions?.map(d => d.id) ?? []);
    }

    const ids = new Set<string>();
    for (const crId of effectivePreviewCrIds) {
      const discussionId = crIdToDiscussionId.get(crId);
      if (discussionId) {
        ids.add(discussionId);
      }
    }

    if (ids.size === 0) {
      return new Set(discussions?.map(d => d.id) ?? []);
    }

    return ids;
  }, [crIdToDiscussionId, discussions, effectivePreviewCrIds]);

  const previewSuggestionResolutions = useMemo(
    () =>
      buildSuggestionPreviewResolutions({
        items: crItems,
        crIdToDiscussionId,
        isVotingActive,
        getVoteResult,
      }),
    [crIdToDiscussionId, crItems, isVotingActive]
  );

  return {
    items,
    editingMode,
    isVotingActive,
    userId,
    canManage,
    canVote,
    hideInlineVotingControls,
    allowInlineFinalVoteStart,
    showAgendaDetailsVoteActions,
    voteDisabledTooltip,
    currentItemId,
    diffMap,
    progress,
    eligibleFinalVoterCount,
    completedCount,
    allCRsProcessed,
    isTimelineComplete,
    documentContent,
    agendaTitle,
    discussions,
    amendmentId,
    agendaItemId,
    userRecord,
    hasUserVoted,
    getUserSelectedChoiceIds,
    onCastVote,
    onOpenVoteDialog,
    onStartIndicative,
    onStartFinal,
    onCloseVoting,
    onFinalizeInternalVote,
    sequenceInterstitial,
    t,
    activeTab: effectiveActiveTab,
    setActiveTab,
    sortMode,
    setSortMode,
    searchQuery,
    setSearchQuery,
    crIdToDiscussionId,
    closingVoteItem,
    variantVoteItem,
    crItems,
    sequenceItems,
    hasCRCategoryItems,
    sharedPreviewEnabled,
    getPreviewCrId,
    selectedPreviewCrIds,
    setSelectedPreviewCrIds,
    searchedItems,
    categorized,
    getFilteredItems,
    filteredItems,
    progressPercent,
    availablePreviewCrIds,
    defaultPreviewCrId,
    normalizedPreviewCrIds,
    effectivePreviewCrIds,
    selectedPreviewSuggestionIds,
    previewSuggestionResolutions,
  };
}
