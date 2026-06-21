'use client';

import { useState, useMemo, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Value } from 'platejs';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { TDiscussion } from '@/features/editor/types';
import { type ChangeRequestDiffData } from './ChangeRequestTimelineCard';
import { getCRFilterStatus } from '../logic/createMockCRTimelineItems';
import { getVoteResult } from '../hooks/useAgendaItemCRVoting';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';

type TabValue = 'all' | 'open' | 'accepted' | 'rejected';

function getVoteStepKind(item: ChangeRequestTimelineRow) {
  return (item as { _voteStepKind?: string })._voteStepKind ?? null;
}

function isSyntheticSequenceStep(item: ChangeRequestTimelineRow) {
  return Boolean(getVoteStepKind(item));
}

interface ChangeRequestCardsListProps {
  items: ChangeRequestTimelineRow[];
  editingMode?: string | null;
  isVotingActive: boolean;
  userId?: string;
  canManage?: boolean;
  canVote?: boolean;
  hideInlineVotingControls?: boolean;
  /** Allow starting final votes from CR cards. Defaults off so agenda toolbar owns sequencing. */
  allowInlineFinalVoteStart?: boolean;
  currentItemId?: string | null;
  /** Map from CR change_request_id (or mock item id) to diff data */
  diffMap?: Record<string, ChangeRequestDiffData>;
  /** Progress through the voting timeline (0-1) */
  progress?: number;
  completedCount?: number;
  allCRsProcessed?: boolean;
  isTimelineComplete?: boolean;
  /** Document content for editor preview */
  documentContent?: Value;
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
  currentItemId,
  diffMap,
  progress,
  completedCount,
  allCRsProcessed,
  isTimelineComplete,
  documentContent,
  discussions,
  amendmentId,
  agendaItemId,
  userRecord,
  hasUserVoted,
  getUserSelectedChoiceIds,
  onCastVote,
  onStartIndicative,
  onStartFinal,
  onCloseVoting,
  onFinalizeInternalVote,
  sequenceInterstitial,
}: ChangeRequestCardsListProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Build crId → discussion UUID map from discussions
  const crIdToDiscussionId = useMemo(() => {
    const map = new Map<string, string>();
    if (discussions) {
      for (const d of discussions) {
        map.set(d.id, d.id);
        if (d.crId) {
          map.set(d.crId, d.id);
        }
        if (d.displayCrId) {
          map.set(d.displayCrId, d.id);
        }
        if (d.title) {
          map.set(d.title, d.id);
        }
        if (d.changeRequestEntityId) {
          map.set(d.changeRequestEntityId, d.id);
        }
      }
    }
    return map;
  }, [discussions]);

  // Separate sequence boundary votes from regular CR items for filtering
  const finalVoteItem = useMemo(() => items.find(i => i.is_final_vote), [items]);
  const variantVoteItem = useMemo(
    () =>
      items.find(i => {
        const stepKind = getVoteStepKind(i);
        return stepKind === 'variant_selection' || stepKind === 'merge_variant';
      }) ?? null,
    [items]
  );
  const changeRequestVotesPlaceholderItem = useMemo(
    () => items.find(i => getVoteStepKind(i) === 'change_request_votes_placeholder') ?? null,
    [items]
  );
  const crItems = useMemo(
    () => items.filter(i => !i.is_final_vote && !isSyntheticSequenceStep(i)),
    [items]
  );
  const sequenceItems = useMemo(
    () => [
      ...(variantVoteItem ? [variantVoteItem] : []),
      ...(changeRequestVotesPlaceholderItem ? [changeRequestVotesPlaceholderItem] : crItems),
      ...(finalVoteItem ? [finalVoteItem] : []),
    ],
    [changeRequestVotesPlaceholderItem, crItems, finalVoteItem, variantVoteItem]
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
    const changeRequest = item.change_request as
      | (NonNullable<ChangeRequestTimelineRow['change_request']> & {
          cr_id?: string | null;
          suggestion_id?: string | null;
        })
      | null
      | undefined;
    const previewCrId =
      changeRequest?.cr_id ??
      changeRequest?.suggestion_id ??
      item.change_request_id ??
      changeRequest?.title;
    return previewCrId && previewCrId.trim().length > 0 ? previewCrId : null;
  };

  const [selectedPreviewCrIds, setSelectedPreviewCrIds] = useState<Set<string> | null>(() => {
    const defaultItem =
      items.find(
        item => item.id === currentItemId && !item.is_final_vote && !isSyntheticSequenceStep(item)
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
          ...(finalVoteItem ? [finalVoteItem] : []),
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
    [crItems]
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
  }, [crItems, currentItemId, filteredItems]);

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
  return {
    items,
    editingMode,
    isVotingActive,
    userId,
    canManage,
    canVote,
    hideInlineVotingControls,
    allowInlineFinalVoteStart,
    currentItemId,
    diffMap,
    progress,
    completedCount,
    allCRsProcessed,
    isTimelineComplete,
    documentContent,
    discussions,
    amendmentId,
    agendaItemId,
    userRecord,
    hasUserVoted,
    getUserSelectedChoiceIds,
    onCastVote,
    onStartIndicative,
    onStartFinal,
    onCloseVoting,
    onFinalizeInternalVote,
    sequenceInterstitial,
    t,
    activeTab: effectiveActiveTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    crIdToDiscussionId,
    finalVoteItem,
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
  };
}
