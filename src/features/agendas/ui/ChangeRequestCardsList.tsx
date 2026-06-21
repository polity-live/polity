'use client';

import type { ReactNode } from 'react';
import type { Value } from 'platejs';
import type { TDiscussion } from '@/features/editor/types';
import { type ChangeRequestDiffData } from './ChangeRequestTimelineCard';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';
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
import { useChangeRequestCardsListController } from './useChangeRequestCardsListController';
import { ChangeRequestCardsListView } from './ChangeRequestCardsListView';

export function ChangeRequestCardsList({
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
  const viewProps = useChangeRequestCardsListController({
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
  });

  return <ChangeRequestCardsListView {...viewProps} />;
}
