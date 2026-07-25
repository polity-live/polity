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
import {
  buildSuggestionDocumentOrder,
  DEFAULT_CHANGE_REQUEST_VOTE_ORDER,
  normalizeChangeRequestVoteOrder,
  sortChangeRequestsByVoteOrder,
  type ChangeRequestVoteOrder,
} from '@/features/change-requests/logic/changeRequestVoteOrder';
import type { StreetDesignPreviewSource } from '@/features/amendments/streetscape/logic/streetDesignChangeRequests';
import type { AmendmentForwardingPreviewModel } from '@/features/amendments/logic/amendmentForwardingPreview';

export { resolvePreviewCrIdForTimelineItem } from '../logic/changeRequestDocumentPreview';

type TabValue = 'all' | 'open' | 'accepted' | 'rejected' | 'obsolete';
export type ChangeRequestSortMode = ChangeRequestVoteOrder;

function getVoteStepKind(item: ChangeRequestTimelineRow) {
  return getPreviewVoteStepKind(item);
}

function isSyntheticSequenceStep(item: ChangeRequestTimelineRow) {
  return Boolean(getVoteStepKind(item));
}

export function sortChangeRequestTimelineItems(
  items: readonly ChangeRequestTimelineRow[],
  sortMode: ChangeRequestSortMode,
  options: {
    crIdToDiscussionId?: ReadonlyMap<string, string>;
    suggestionDocumentOrder?: ReadonlyMap<string, number>;
  } = {}
) {
  return sortChangeRequestsByVoteOrder(items, sortMode, {
    getChangeRequest: item => item.change_request ?? item,
    getSuggestionId: item =>
      options.crIdToDiscussionId
        ? resolvePreviewSuggestionIdForTimelineItem(item, options.crIdToDiscussionId)
        : null,
    suggestionDocumentOrder: options.suggestionDocumentOrder,
  });
}

interface ChangeRequestCardsListProps {
  items: ChangeRequestTimelineRow[];
  obsoleteItems?: ChangeRequestTimelineRow[];
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
  streetDesigns?: readonly StreetDesignPreviewSource[];
  /** Agenda or amendment title used for final closing vote labels. */
  agendaTitle?: string | null;
  forwardingPreview?: AmendmentForwardingPreviewModel | null;
  /** Initial and externally controlled sort mode for CR cards. */
  defaultSortMode?: ChangeRequestVoteOrder | null;
  /** Discussion entries from amendment for CR ID mapping */
  discussions?: TDiscussion[];
  /** Amendment ID — needed for interactive editor and mode selector */
  amendmentId?: string;
  /** Agenda item ID — passed to interactive editor */
  agendaItemId?: string;
  showStreetDesignPreviewAccordion?: boolean;
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
  obsoleteItems = [],
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
  streetDesigns = [],
  agendaTitle,
  forwardingPreview,
  defaultSortMode,
  discussions,
  amendmentId,
  agendaItemId,
  showStreetDesignPreviewAccordion = false,
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
  const normalizedDefaultSortMode = normalizeChangeRequestVoteOrder(defaultSortMode);
  const [sortMode, setSortMode] = useState<ChangeRequestSortMode>(
    normalizedDefaultSortMode ?? DEFAULT_CHANGE_REQUEST_VOTE_ORDER
  );

  useEffect(() => {
    setSortMode(normalizedDefaultSortMode);
  }, [normalizedDefaultSortMode]);

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
  const obsoleteCrItems = useMemo(
    () =>
      sortChangeRequestTimelineItems(obsoleteItems, sortMode, {
        crIdToDiscussionId,
        suggestionDocumentOrder,
      }),
    [crIdToDiscussionId, obsoleteItems, sortMode, suggestionDocumentOrder]
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
  const hasCRCategoryItems = crItems.length > 0 || obsoleteCrItems.length > 0;

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
  const searchedObsoleteItems = useMemo(() => {
    if (!searchQuery.trim()) return obsoleteCrItems;
    const query = searchQuery.toLowerCase();
    return obsoleteCrItems.filter(item => {
      const cr = item.change_request;
      const title = cr?.title?.toLowerCase() ?? '';
      const description = cr?.description?.toLowerCase() ?? '';
      return title.includes(query) || description.includes(query);
    });
  }, [obsoleteCrItems, searchQuery]);

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

    return { open, accepted, rejected, obsolete: searchedObsoleteItems };
  }, [searchedItems, isVotingActive, searchedObsoleteItems]);

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
      case 'obsolete':
        return categorized.obsolete;
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
    streetDesigns,
    agendaTitle,
    forwardingPreview,
    discussions,
    amendmentId,
    agendaItemId,
    showStreetDesignPreviewAccordion,
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
    obsoleteCrItems,
    sequenceItems,
    hasCRCategoryItems,
    sharedPreviewEnabled,
    getPreviewCrId,
    selectedPreviewCrIds,
    setSelectedPreviewCrIds,
    searchedItems,
    searchedObsoleteItems,
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
