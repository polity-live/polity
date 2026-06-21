'use client';
import type { Value } from 'platejs';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';
import type { TDiscussion } from '@/features/editor/types';
/** Optional text diff data to render inside the card. */
export interface ChangeRequestDiffData {
  changeType?: string;
  originalText?: string;
  newText?: string;
  properties?: Record<string, string>;
  newProperties?: Record<string, string>;
  justification?: string;
}
interface ChangeRequestTimelineCardProps {
  item: ChangeRequestTimelineRow;
  index: number;
  isCurrent: boolean;
  hasUserVoted: boolean;
  userSelectedChoiceIds: string[];
  canManage: boolean;
  canVote: boolean;
  isFinalVoteLocked?: boolean;
  diff?: ChangeRequestDiffData;
  documentContent?: Value;
  suggestionId?: string;
  /** Short CR identifier (e.g. "CR-1") used to default-select this card's CR */
  crId?: string;
  /** User-facing branch-scoped CR label, e.g. "Branch 1 CR-1" */
  displayCrId?: string;
  /** All discussions for the amendment — used by the per-card SuggestionViewToggle */
  discussions?: TDiscussion[];
  /** Amendment editing mode — determines interactive vs read-only preview */
  editingMode?: string | null;
  /** Amendment ID — needed for interactive editor and mode selector */
  amendmentId?: string;
  /** Current user ID — needed for interactive editor */
  userId?: string;
  /** Current user record — passed to interactive editor for author/avatar display */
  userRecord?: {
    id: string;
    name?: string;
    email?: string | null;
    avatar?: string;
  };
  /** Agenda item ID — passed to interactive editor */
  agendaItemId?: string;
  /** Hide the shared document preview block when it is rendered elsewhere */
  showEditorPreview?: boolean;
  /** Hide inline cast/close controls when actions are handled by the page toolbar. */
  hideInlineVotingControls?: boolean;
  /** Allow starting the final vote from this card instead of the agenda toolbar. */
  allowInlineFinalVoteStart?: boolean;
  onCastVote?: (item: ChangeRequestTimelineRow, choiceId: string) => Promise<void>;
  onStartIndicative?: (itemId: string) => Promise<void>;
  onStartFinal?: (itemId: string) => Promise<void>;
  onCloseVoting?: (itemId: string) => Promise<void> | Promise<unknown>;
}

import { useChangeRequestTimelineCardController } from './useChangeRequestTimelineCardController';
import { ChangeRequestTimelineCardView } from './ChangeRequestTimelineCardView';

export function ChangeRequestTimelineCard({
  item,
  index,
  isCurrent,
  hasUserVoted,
  userSelectedChoiceIds,
  canManage,
  canVote,
  isFinalVoteLocked,
  diff,
  documentContent,
  suggestionId,
  crId,
  displayCrId,
  discussions,
  editingMode,
  amendmentId,
  userId,
  userRecord,
  agendaItemId,
  showEditorPreview = true,
  hideInlineVotingControls = false,
  allowInlineFinalVoteStart = false,
  onCastVote,
  onStartIndicative,
  onStartFinal,
  onCloseVoting,
}: ChangeRequestTimelineCardProps) {
  const viewProps = useChangeRequestTimelineCardController({
    item,
    index,
    isCurrent,
    hasUserVoted,
    userSelectedChoiceIds,
    canManage,
    canVote,
    isFinalVoteLocked,
    diff,
    documentContent,
    suggestionId,
    crId,
    displayCrId,
    discussions,
    editingMode,
    amendmentId,
    userId,
    userRecord,
    agendaItemId,
    showEditorPreview,
    hideInlineVotingControls,
    allowInlineFinalVoteStart,
    onCastVote,
    onStartIndicative,
    onStartFinal,
    onCloseVoting,
  });

  return <ChangeRequestTimelineCardView {...viewProps} />;
}
