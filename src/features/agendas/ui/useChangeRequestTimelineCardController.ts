'use client';
import { useMemo, useState } from 'react';
import type { Value } from 'platejs';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  computeVoteResultSummary,
  type ChoiceOfflineTally,
  type MajorityType,
  type VoteResult,
} from '@/features/vote-cast/logic/computeVoteResults';
import { getVoteResult } from '../hooks/useAgendaItemCRVoting';
import { deriveChangeRequestVotePhase } from '../logic/changeRequestVotePhase';
import { calculateVoteStats } from '../hooks/useAgendaItemVoting';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';
import type { ChoicesByVoteRow } from '@/zero/votes/queries';
import type { TDiscussion } from '@/features/editor/types';
import type { SuggestionPreviewResolutionMap } from '@/features/change-requests/logic/filterDocumentToSingleSuggestion';
import type { EditingMode } from '@/zero/amendments/editing-mode-policy';
function normalizeMajorityType(value?: string | null): MajorityType {
  if (value === 'absolute' || value === 'two_thirds') {
    return value;
  }

  return 'simple';
}
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
  /** Eligible voters expected for final votes, including confirmed offline attendees. */
  eligibleFinalVoterCount?: number;
  isFinalVoteLocked?: boolean;
  diff?: ChangeRequestDiffData;
  documentContent?: Value;
  suggestionId?: string;
  suggestionResolutions?: SuggestionPreviewResolutionMap;
  /** Agenda or amendment title used for final closing vote labels. */
  agendaTitle?: string | null;
  /** Short CR identifier (e.g. "CR-1") used to default-select this card's CR */
  crId?: string;
  /** User-facing branch-scoped CR label, e.g. "Branch 1 CR-1" */
  displayCrId?: string;
  /** All discussions for the amendment — used by the per-card SuggestionViewToggle */
  discussions?: TDiscussion[];
  /** Amendment editing mode — determines interactive vs read-only preview */
  editingMode: EditingMode;
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
  /** Show agenda-details-only per-card vote phase actions. */
  showAgendaDetailsVoteActions?: boolean;
  /** Explanation shown when agenda-details card vote actions are visible but unavailable. */
  voteDisabledTooltip?: string;
  /** Whether the parent CR voting list is currently active. Used for diagnostics. */
  isVotingActive?: boolean;
  onCastVote?: (item: ChangeRequestTimelineRow, choiceId: string) => Promise<void>;
  onOpenVoteDialog?: (itemId: string) => void;
  onStartIndicative?: (itemId: string) => Promise<void>;
  onStartFinal?: (itemId: string) => Promise<void>;
  onCloseVoting?: (itemId: string) => Promise<void> | Promise<unknown>;
}

export function useChangeRequestTimelineCardController({
  item,
  index,
  isCurrent,
  hasUserVoted,
  userSelectedChoiceIds,
  canManage,
  canVote,
  eligibleFinalVoterCount,
  isFinalVoteLocked,
  diff,
  documentContent,
  suggestionId,
  suggestionResolutions,
  agendaTitle,
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
  showAgendaDetailsVoteActions = false,
  voteDisabledTooltip,
  isVotingActive = false,
  onCastVote,
  onOpenVoteDialog,
  onStartIndicative,
  onStartFinal,
  onCloseVoting,
}: ChangeRequestTimelineCardProps) {
  const { t } = useTranslation();

  const [votingLoading, setVotingLoading] = useState(false);

  // Per-card CR selection state — defaults to this card's own CR
  const [selectedCrIds, setSelectedCrIds] = useState<Set<string> | null>(() =>
    crId ? new Set([crId]) : null
  );

  // Map crId → discussion UUID for converting selected CRs to suggestion IDs
  const crIdToDiscussionId = useMemo(() => {
    const map = new Map<string, string>();
    if (discussions) {
      for (const d of discussions) {
        if (d.id) map.set(d.id, d.id);
        if (d.crId) map.set(d.crId, d.id);
        if (d.displayCrId) map.set(d.displayCrId, d.id);
        if (d.title) map.set(d.title, d.id);
        if (d.changeRequestEntityId) map.set(d.changeRequestEntityId, d.id);
      }
    }
    return map;
  }, [discussions]);

  // Convert selected crIds to discussion UUIDs for the editor preview filter
  const selectedSuggestionIds = useMemo<Set<string>>(() => {
    if (!selectedCrIds) {
      // null = show all suggestions
      return new Set(discussions?.map(d => d.id) ?? (suggestionId ? [suggestionId] : []));
    }
    const ids = new Set<string>();
    for (const cId of selectedCrIds) {
      const did = crIdToDiscussionId.get(cId);
      if (did) ids.add(did);
    }
    // Fallback: if mapping didn't find anything, use this card's own suggestionId
    if (ids.size === 0 && suggestionId) ids.add(suggestionId);
    return ids;
  }, [selectedCrIds, crIdToDiscussionId, discussions, suggestionId]);

  const cr = item.change_request;

  const vote = item.vote;
  const voteStepKind = (item as { _voteStepKind?: string })._voteStepKind ?? null;
  const isPlaceholder = Boolean((item as { _votePlaceholder?: boolean })._votePlaceholder);
  const placeholderTitle = (item as { _placeholderTitle?: string | null })._placeholderTitle;
  const placeholderDescription = (item as { _placeholderDescription?: string | null })
    ._placeholderDescription;

  const title =
    placeholderTitle ??
    (voteStepKind === 'merge_variant'
      ? vote?.title || 'Variant Final Vote'
      : item.is_closing_vote
        ? vote?.title || t('features.agendas.crTimeline.acceptAmendment')
        : cr?.title || `${t('features.agendas.crTimeline.changeRequest')} ${index + 1}`);

  const phase = deriveChangeRequestVotePhase(item, editingMode);

  const isInternal = phase === 'internal';

  const isClosed = phase === 'closed';

  const isIndicative = phase === 'indicative';

  const isFinal = phase === 'final';

  const voteResult = isClosed ? getVoteResult(item) : undefined;

  // Compute vote stats using the existing helper
  const choices = useMemo(() => (vote?.choices ?? []) as ChoicesByVoteRow[], [vote?.choices]);

  const indicativeDecisions = useMemo(
    () => vote?.indicative_decisions ?? [],
    [vote?.indicative_decisions]
  );

  const finalDecisions = useMemo(() => vote?.final_decisions ?? [], [vote?.final_decisions]);

  const offlineTallies = useMemo<readonly ChoiceOfflineTally[]>(
    () => vote?.offline_tallies ?? [],
    [vote?.offline_tallies]
  );

  const {
    choices: choiceStats,
    totalIndicative,
    totalFinal,
  } = useMemo(
    () => calculateVoteStats(choices, indicativeDecisions, finalDecisions, offlineTallies),
    [choices, finalDecisions, indicativeDecisions, offlineTallies]
  );

  const lazyVoterCount = vote?.voters?.length ?? 0;
  const totalVoters =
    (isFinal || isClosed) && eligibleFinalVoterCount !== undefined
      ? eligibleFinalVoterCount
      : lazyVoterCount;

  const computedVoteSummary = useMemo(() => {
    if (!isClosed || choiceStats.length === 0) {
      return null;
    }

    return computeVoteResultSummary(
      choices.map((choice, idx) => ({
        id: choice.id,
        label:
          choice.label ||
          t('features.events.agenda.defaultChoiceLabels.choiceWithNumber', { count: idx + 1 }),
        order_index: choice.order_index ?? idx,
      })),
      finalDecisions,
      totalVoters || totalFinal,
      normalizeMajorityType(vote?.majority_type),
      offlineTallies
    );
  }, [
    choiceStats.length,
    choices,
    finalDecisions,
    isClosed,
    offlineTallies,
    t,
    totalFinal,
    totalVoters,
    vote?.majority_type,
  ]);

  const resolvedVoteResult: VoteResult | undefined = voteResult ?? computedVoteSummary?.result;

  const leadingChoiceId = useMemo(() => {
    if (choiceStats.length === 0) return null;
    const maxVotes = Math.max(
      ...choiceStats.map(s => (isClosed || !isIndicative ? s.finalCount : s.indicativeCount))
    );
    if (maxVotes === 0) return null;
    return choiceStats.find(
      s => (isClosed || !isIndicative ? s.finalCount : s.indicativeCount) === maxVotes
    )?.choice.id;
  }, [choiceStats, isClosed, isIndicative]);

  const winningChoiceId = useMemo(() => {
    if (resolvedVoteResult === 'tie') {
      return null;
    }

    if (isClosed) {
      return computedVoteSummary?.winningChoiceId ?? leadingChoiceId;
    }

    return leadingChoiceId;
  }, [computedVoteSummary?.winningChoiceId, isClosed, leadingChoiceId, resolvedVoteResult]);

  const winningLabel = useMemo(() => {
    if (!winningChoiceId) return undefined;
    const choice = choices.find(c => c.id === winningChoiceId);
    return choice?.label || undefined;
  }, [winningChoiceId, choices]);

  const resolvedVoteSharePercent = useMemo(() => {
    if (!winningChoiceId) {
      return undefined;
    }

    if (isClosed) {
      return computedVoteSummary?.winningPercent ?? undefined;
    }

    const winningStats = choiceStats.find(choice => choice.choice.id === winningChoiceId);
    if (!winningStats) {
      return undefined;
    }

    return Math.round(winningStats.finalPercentage);
  }, [choiceStats, computedVoteSummary?.winningPercent, isClosed, winningChoiceId]);

  const currentPhaseVoteCount = isFinal || isClosed ? totalFinal : totalIndicative;

  const handleCastVote = async (choiceId: string) => {
    if (!onCastVote) return;
    setVotingLoading(true);
    try {
      await onCastVote(item, choiceId);
    } finally {
      setVotingLoading(false);
    }
  };

  const isLocked = Boolean(isFinalVoteLocked);

  return {
    item,
    index,
    isCurrent,
    hasUserVoted,
    userSelectedChoiceIds,
    canManage,
    canVote,
    eligibleFinalVoterCount,
    isFinalVoteLocked,
    diff,
    documentContent,
    suggestionId,
    suggestionResolutions,
    agendaTitle,
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
    showAgendaDetailsVoteActions,
    voteDisabledTooltip,
    isVotingActive,
    onCastVote,
    onOpenVoteDialog,
    onStartIndicative,
    onStartFinal,
    onCloseVoting,
    t,
    votingLoading,
    setVotingLoading,
    selectedCrIds,
    setSelectedCrIds,
    crIdToDiscussionId,
    selectedSuggestionIds,
    cr,
    vote,
    voteStepKind,
    isPlaceholder,
    placeholderDescription,
    title,
    phase,
    isInternal,
    isClosed,
    isIndicative,
    isFinal,
    voteResult,
    choices,
    indicativeDecisions,
    finalDecisions,
    offlineTallies,
    choiceStats,
    totalIndicative,
    totalFinal,
    totalVoters,
    computedVoteSummary,
    resolvedVoteResult,
    leadingChoiceId,
    winningChoiceId,
    winningLabel,
    resolvedVoteSharePercent,
    currentPhaseVoteCount,
    handleCastVote,
    isLocked,
  };
}
