'use client';

import type { ReactNode } from 'react';
import type { Value } from 'platejs';
import type { TDiscussion } from '@/features/editor/types';
import { type ChangeRequestDiffData } from './ChangeRequestTimelineCard';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';
import type { EditingMode } from '@/zero/amendments/editing-mode-policy';
import type { ChangeRequestVoteOrder } from '@/features/change-requests/logic/changeRequestVoteOrder';
import type { CityDesignPreviewSource } from '@/features/amendments/city-design/logic/cityDesignChangeRequests';
import type { AmendmentForwardingPreviewModel } from '@/features/amendments/logic/amendmentForwardingPreview';
interface ChangeRequestCardsListProps {
  items: ChangeRequestTimelineRow[];
  /** Historical CRs shown exclusively in the read-only obsolete tab. */
  obsoleteItems?: ChangeRequestTimelineRow[];
  editingMode: EditingMode;
  isVotingActive: boolean;
  /** Virtualize only the CR card collection while keeping the shared list controls mounted once. */
  virtualize?: boolean;
  /** Visual container for the list. Amendment change-request pages use the frameless variant. */
  containerVariant?: 'card' | 'frameless';
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
  cityDesigns?: readonly CityDesignPreviewSource[];
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
  /** Show the map-gated City Design accordion on the agenda item detail page. */
  showCityDesignPreviewAccordion?: boolean;
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
import { useChangeRequestCardsListController } from './useChangeRequestCardsListController';
import { ChangeRequestCardsListView } from './ChangeRequestCardsListView';

export function ChangeRequestCardsList({
  items,
  obsoleteItems = [],
  editingMode,
  isVotingActive,
  virtualize = false,
  containerVariant = 'card',
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
  cityDesigns,
  agendaTitle,
  forwardingPreview,
  defaultSortMode,
  discussions,
  amendmentId,
  agendaItemId,
  showCityDesignPreviewAccordion = false,
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
  const viewProps = useChangeRequestCardsListController({
    items,
    obsoleteItems,
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
    cityDesigns,
    agendaTitle,
    forwardingPreview,
    defaultSortMode,
    discussions,
    amendmentId,
    agendaItemId,
    showCityDesignPreviewAccordion,
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
  });

  return (
    <ChangeRequestCardsListView
      {...viewProps}
      virtualize={virtualize}
      containerVariant={containerVariant}
    />
  );
}
