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
  /** All discussions for the amendment — used by the per-card SuggestionViewToggle */
  discussions?: TDiscussion[];
  /** Amendment editing mode — determines interactive vs read-only preview */
  editingMode?: string | null;
  /** Amendment ID — needed for interactive editor and mode selector */
  amendmentId?: string;
  /** Current user ID — needed for interactive editor */
  userId?: string;
  /** Agenda item ID — passed to interactive editor */
  agendaItemId?: string;
  /** Hide the shared document preview block when it is rendered elsewhere */
  showEditorPreview?: boolean;
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
  discussions,
  editingMode,
  amendmentId,
  userId,
  agendaItemId,
  showEditorPreview = true,
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
    discussions,
    editingMode,
    amendmentId,
    userId,
    agendaItemId,
    showEditorPreview,
    onCastVote,
    onStartIndicative,
    onStartFinal,
    onCloseVoting,
  });

  return <ChangeRequestTimelineCardView {...viewProps} />;
}
