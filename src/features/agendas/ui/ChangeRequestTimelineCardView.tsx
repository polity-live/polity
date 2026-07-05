'use client';
import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl, StatusBadge, type BadgeTone } from '@/features/shared/ui/status';
import type { Value } from 'platejs';
import { Card, CardContent, CardHeader } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/features/shared/ui/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import { ChevronDown, CheckCircle2, CircleHelp, Flag, Lock, Vote } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';
import { cn } from '@/features/shared/utils/utils';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { VotingPhaseBadge as VotePhaseBadge } from '@/features/shared/ui/voting';
import { VoteResultsDisplay, type VoteBarOption } from '@/features/vote-cast/ui/VoteResultsDisplay';
import {
  getCanonicalVoteChoice,
  getLocalizedVoteChoiceLabel,
} from '@/features/shared/ui/voting/voteChoiceLabels';
import { ChangeRequestSummaryItem } from '@/features/change-requests/ui/ChangeRequestSummaryItem';
import { CREditorPreview } from '@/features/change-requests/ui/CREditorPreview';
import { StreetDesignChangeRequestPreview } from '@/features/amendments/streetscape/ui/StreetDesignChangeRequestPreview';
import {
  isStreetDesignChangeRequest,
  type StreetDesignChangeRequest,
  type StreetDesignPreviewSource,
} from '@/features/amendments/streetscape/logic/streetDesignChangeRequests';
import { SuggestionViewToggle } from '@/features/editor/ui/SuggestionViewToggle';
import {
  isMockCRTimelineItem,
  isPendingSubmissionCRTimelineItem,
} from '../logic/createMockCRTimelineItems';
import { getFinalVoteActionLabels } from '../logic/finalVoteActionLabels';
import type { EditingMode } from '@/zero/amendments/editing-mode-policy';
const CR_CHOICE_COLORS = [
  {
    color: featureThemeClassName('agendaAgendaVoteSectionSuccessBackground'),
    light: featureThemeClassName('agendaAgendaVoteSectionSuccessBackgroundAlpha'),
  },
  {
    color: featureThemeClassName('agendaAgendaVoteSectionDangerBackground'),
    light: featureThemeClassName('agendaAgendaVoteSectionDangerBackgroundAlpha'),
  },
  {
    color: featureThemeClassName('agendaAgendaVoteSectionNeutralBackground'),
    light: featureThemeClassName('agendaAgendaVoteSectionNeutralBackgroundAlpha'),
  },
  {
    color: featureThemeClassName('agendaAgendaVoteSectionInfoBackground'),
    light: featureThemeClassName('agendaAgendaVoteSectionInfoBackgroundAlpha'),
  },
  {
    color: featureThemeClassName('agendaAgendaVoteSectionAccentBackground'),
    light: featureThemeClassName('agendaAgendaVoteSectionAccentBackgroundAlpha'),
  },
  {
    color: featureThemeClassName('agendaAgendaVoteSectionWarningBackground'),
    light: featureThemeClassName('agendaAgendaVoteSectionWarningBackgroundAlpha'),
  },
];

/** Optional text diff data to render inside the card. */
export interface ChangeRequestDiffData {
  changeType?: string;
  originalText?: string;
  newText?: string;
  properties?: Record<string, string>;
  newProperties?: Record<string, string>;
  justification?: string;
}
function getStatusBadge(
  status: string | null,
  isCurrent: boolean,
  t: (key: string, fallback?: string) => string,
  voteResult?: string,
  originalStatus?: string
) {
  let label = t('features.agendas.crTimeline.open');
  let tone: BadgeTone = 'info';

  // Determine accepted/rejected from vote result or original mock status
  if (status === 'completed') {
    if (voteResult === 'passed' || originalStatus === 'approved' || originalStatus === 'accepted') {
      label = t('features.agendas.crTimeline.accepted');
      tone = 'success';
      return (
        <StatusBadge status="accepted" tone={tone}>
          {label}
        </StatusBadge>
      );
    }
    if (
      voteResult === 'rejected' ||
      voteResult === 'failed' ||
      originalStatus === 'declined' ||
      originalStatus === 'rejected'
    ) {
      label = t('features.agendas.crTimeline.rejected');
      tone = 'destructive';
      return (
        <StatusBadge status="rejected" tone={tone}>
          {label}
        </StatusBadge>
      );
    }
    label = t('features.agendas.crTimeline.completed');
    tone = 'success';
    return (
      <StatusBadge status="completed" tone={tone}>
        {label}
      </StatusBadge>
    );
  }
  if (isCurrent)
    return (
      <StatusBadge status="voting" tone="info">
        {t('features.agendas.crTimeline.voting')}
      </StatusBadge>
    );
  return (
    <StatusBadge status="open" tone={tone}>
      {label}
    </StatusBadge>
  );
}

export interface ChangeRequestTimelineCardViewProps {
  item: any;
  index: any;
  isCurrent: any;
  hasUserVoted: any;
  userSelectedChoiceIds: any;
  canManage: any;
  canVote: any;
  isFinalVoteLocked: any;
  diff: any;
  documentContent: any;
  streetDesigns?: readonly StreetDesignPreviewSource[];
  suggestionId: any;
  suggestionResolutions?: any;
  agendaTitle?: any;
  crId: any;
  displayCrId?: any;
  discussions: any;
  editingMode: EditingMode;
  amendmentId: any;
  userId: any;
  userRecord?: any;
  agendaItemId: any;
  showEditorPreview: any;
  hideInlineVotingControls?: any;
  allowInlineFinalVoteStart?: any;
  showAgendaDetailsVoteActions?: any;
  voteDisabledTooltip?: any;
  isVotingActive?: any;
  onCastVote: any;
  onOpenVoteDialog?: any;
  onStartIndicative: any;
  onStartFinal: any;
  onCloseVoting: any;
  t: any;
  votingLoading: any;
  setVotingLoading: any;
  selectedCrIds: any;
  setSelectedCrIds: any;
  crIdToDiscussionId: any;
  selectedSuggestionIds: any;
  cr: any;
  vote: any;
  voteStepKind?: any;
  isPlaceholder?: any;
  placeholderDescription?: any;
  title: any;
  phase: any;
  isInternal?: any;
  isClosed: any;
  isIndicative: any;
  isFinal: any;
  voteResult: any;
  choices: any[];
  indicativeDecisions: any;
  finalDecisions: any;
  offlineTallies: any;
  choiceStats: any[];
  totalIndicative: any;
  totalFinal: any;
  totalVoters: any;
  computedVoteSummary: any;
  resolvedVoteResult: any;
  leadingChoiceId: any;
  winningChoiceId: any;
  winningLabel: any;
  resolvedVoteSharePercent: any;
  currentPhaseVoteCount: any;
  handleCastVote: any;
  isLocked: any;
}

function getStreetDesignChangeRequestFromCardItem(
  item: any,
  cr: any
): StreetDesignChangeRequest | null {
  if (!cr || !isStreetDesignChangeRequest(cr)) return null;
  return {
    ...cr,
    id: cr.id ?? item.change_request_id ?? item.id,
  };
}

export function ChangeRequestTimelineCardView({
  item,
  index,
  isCurrent,
  hasUserVoted,
  userSelectedChoiceIds,
  canManage,
  canVote,
  diff,
  documentContent,
  streetDesigns = [],
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
  hideInlineVotingControls = false,
  allowInlineFinalVoteStart = false,
  showAgendaDetailsVoteActions = false,
  voteDisabledTooltip,
  isVotingActive = true,
  onOpenVoteDialog,
  onStartFinal,
  onCloseVoting,
  t,
  votingLoading,
  setVotingLoading,
  selectedCrIds,
  setSelectedCrIds,
  selectedSuggestionIds,
  cr,
  vote,
  voteStepKind = null,
  isPlaceholder = false,
  placeholderDescription,
  title,
  isInternal = false,
  isClosed,
  isIndicative,
  isFinal,
  choices,
  choiceStats,
  totalIndicative,
  totalFinal,
  totalVoters,
  resolvedVoteResult,
  winningChoiceId,
  winningLabel,
  resolvedVoteSharePercent,
  currentPhaseVoteCount,
  handleCastVote,
  isLocked,
}: ChangeRequestTimelineCardViewProps) {
  const streetDesignChangeRequest = getStreetDesignChangeRequestFromCardItem(item, cr);
  const summaryIdentifier =
    voteStepKind === 'merge_variant'
      ? t('features.agendas.crTimeline.variantVoteShort', 'Variant')
      : voteStepKind === 'change_request_votes_placeholder'
        ? t('features.agendas.crTimeline.changeRequestVotesShort', 'CR votes')
        : item.is_closing_vote
          ? t('features.agendas.crTimeline.finalVoteShort', 'Final')
          : (displayCrId ??
            cr?.display_cr_id ??
            cr?.displayCrId ??
            crId ??
            cr?.cr_id ??
            cr?.crId ??
            `CR-${Number(index) + 1 || 1}`);
  const isInternalVotingMode = editingMode === 'vote_internal';
  const isJumpToFinalVoteStep = voteStepKind === 'change_request_votes_placeholder';
  const finalVoteActionLabels = getFinalVoteActionLabels({
    item,
    agendaTitle,
    fallbackTarget: displayCrId ?? crId ?? title,
  });
  const startFinalActionLabel = isJumpToFinalVoteStep
    ? t('features.agendas.crTimeline.jumpToFinalVote', 'Jump to final vote')
    : finalVoteActionLabels.start;
  const closeFinalActionLabel = finalVoteActionLabels.close;
  const startIndicativeActionLabel = isFinal
    ? t('features.events.agenda.actions.castFinalVote', 'Cast final vote')
    : t('features.events.agenda.actions.castIndicativeVote', 'Cast Indication');
  const startFinalDialogTitle = isJumpToFinalVoteStep
    ? t('features.agendas.crTimeline.jumpToFinalVoteDialogTitle', 'Jump to final vote')
    : startFinalActionLabel;
  const startFinalDescription = isJumpToFinalVoteStep
    ? t(
        'features.agendas.crTimeline.jumpToFinalVoteDescription',
        'There are no change request votes for this step. This starts the binding final vote for the amended version.'
      )
    : t(
        'features.agendas.crTimeline.startFinalDescription',
        'This opens the binding final vote for this step.'
      );
  const isDirectInternalResolution = cr?.resolution_method === 'direct_internal';
  const internalVotingDeadline = cr?.voting_deadline;
  const internalCloseTrigger = cr?.close_trigger;
  const internalVotedCount = cr?.voted_collaborator_count ?? currentPhaseVoteCount;
  const internalEligibleCount = cr?.eligible_voter_count ?? totalVoters;
  const internalAcceptVotes = cr?.votes_for ?? 0;
  const internalRejectVotes = cr?.votes_against ?? 0;
  const internalAbstainVotes = cr?.votes_abstain ?? 0;
  const internalTotalVotes = internalAcceptVotes + internalRejectVotes + internalAbstainVotes;
  const internalUserVote = cr?.user_vote ?? null;
  const internalChoiceIdSuffix = item.change_request_id ?? cr?.id ?? item.id;
  const confirmationStatus = cr?.confirmation_status ?? cr?.confirmationStatus ?? null;
  const isPendingSubmission = isPendingSubmissionCRTimelineItem(item);
  const isMockTimelineItem = isMockCRTimelineItem(item);
  const isSyntheticEventVoteRow = isMockTimelineItem && !isInternalVotingMode;
  const effectiveCanVote = canVote && !isSyntheticEventVoteRow;
  const isSubmittedChangeRequest =
    !item.is_closing_vote &&
    !isPendingSubmission &&
    confirmationStatus !== 'pending' &&
    (confirmationStatus === 'confirmed' || Boolean(cr?.id || item.change_request_id));
  const voteOptions: VoteBarOption[] = choiceStats.map((cs: any, idx: number) => {
    const colors = CR_CHOICE_COLORS[idx % CR_CHOICE_COLORS.length];

    return {
      key: cs.choice.id,
      label:
        cs.choice.label ||
        t('features.events.agenda.defaultChoiceLabels.choiceWithNumber', {
          count: idx + 1,
        }),
      color: colors.color,
      lightColor: colors.light,
      finalCount: cs.finalCount,
      finalPercent: cs.finalPercentage,
      indicationCount: cs.indicativeCount,
      indicationPercent: cs.indicativePercentage,
    };
  });

  const canCastVoteFromCard =
    !hideInlineVotingControls &&
    !isInternalVotingMode &&
    !isPendingSubmission &&
    effectiveCanVote &&
    !hasUserVoted &&
    vote &&
    (isIndicative || (isFinal && isCurrent && !isLocked));
  const canStartFinalVoteFromCard =
    allowInlineFinalVoteStart &&
    !isInternalVotingMode &&
    !isPendingSubmission &&
    isCurrent &&
    !hideInlineVotingControls &&
    !isLocked &&
    canManage &&
    !isClosed &&
    (item.status === 'pending' || isIndicative);
  const voteButtonHiddenReasons = [
    !showAgendaDetailsVoteActions ? 'notAgendaDetailsContext' : null,
    !isVotingActive ? 'listVotingInactive' : null,
    isInternalVotingMode ? 'internalVotingMode' : null,
    isPendingSubmission ? 'pendingSubmission' : null,
    isPlaceholder ? 'placeholder' : null,
    isSyntheticEventVoteRow ? 'syntheticVoteRow' : null,
    isClosed ? 'closed' : null,
    hasUserVoted ? 'alreadyVoted' : null,
    !vote ? 'missingVote' : null,
    choices.length === 0 ? 'missingChoices' : null,
    !onOpenVoteDialog ? 'missingOpenDialog' : null,
  ].filter(Boolean);
  const voteButtonDisabledReasons = [
    !effectiveCanVote ? 'cannotVote' : null,
    votingLoading ? 'votingLoading' : null,
  ].filter(Boolean);
  const canOpenVoteDialogFromAgendaDetails = voteButtonHiddenReasons.length === 0;
  const isVoteActionBlocked = voteButtonDisabledReasons.length > 0;
  const resolvedVoteDisabledTooltip =
    !effectiveCanVote && voteDisabledTooltip
      ? voteDisabledTooltip
      : !effectiveCanVote
        ? t(
            'features.events.agenda.actions.voteUnavailable',
            'You cannot cast a vote for this item.'
          )
        : startIndicativeActionLabel;
  const handleOpenVoteDialog = () => {
    if (
      !canOpenVoteDialogFromAgendaDetails ||
      voteButtonDisabledReasons.length > 0 ||
      !onOpenVoteDialog
    ) {
      return;
    }
    onOpenVoteDialog(item.id);
  };
  const handleStartFinalVote = async () => {
    if (!onStartFinal || votingLoading) return;
    setVotingLoading(true);
    try {
      await onStartFinal(item.id);
    } finally {
      setVotingLoading(false);
    }
  };
  const projectionText =
    winningLabel && typeof resolvedVoteSharePercent === 'number'
      ? `${winningLabel} (${resolvedVoteSharePercent}%)`
      : winningLabel || t('features.agendas.crTimeline.noProjection', 'No clear projection yet');

  return (
    <Collapsible
      defaultOpen={
        isCurrent || item.is_closing_vote || voteStepKind === 'merge_variant' || isPlaceholder
      }
    >
      <Card
        className={cn(
          'transition-all',
          isCurrent &&
            !isLocked &&
            featureThemeClassName('agendaChangeRequestTimelineCardInfoRing'),
          item.status === 'completed' && 'opacity-75'
        )}
      >
        <CollapsibleTrigger className="w-full">
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <div className="min-w-0 flex-1 pr-3">
              <ChangeRequestSummaryItem
                identifier={summaryIdentifier}
                title={title}
                status={item.status}
                changeType={
                  item.is_closing_vote
                    ? 'final'
                    : voteStepKind === 'merge_variant'
                      ? 'variant'
                      : diff?.changeType
                }
                selected={isCurrent && !isLocked}
                variant="trigger"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {hasUserVoted && !isPendingSubmission && (
                <BadgeControl variant="outline" size="xs">
                  {t('features.agendas.crTimeline.voted')}
                </BadgeControl>
              )}
              {isLocked ? (
                <BadgeControl variant="outline" size="xs" className="gap-1">
                  <Lock className="h-3 w-3" />
                  {t('features.agendas.crTimeline.locked', 'Locked')}
                </BadgeControl>
              ) : null}
              {isPendingSubmission ? (
                <BadgeControl variant="outline" size="xs">
                  {t('features.agendas.crTimeline.pendingSubmission', 'Einreichung ausstehend')}
                </BadgeControl>
              ) : null}
              {!isPendingSubmission && isInternal && (
                <VotePhaseBadge
                  phase="internal"
                  labels={{
                    internal: t('features.agendas.crTimeline.internalVote', 'Internal vote'),
                  }}
                />
              )}
              {!isPendingSubmission && !isInternal && !isInternalVotingMode && vote && (
                <VotePhaseBadge
                  phase={isIndicative ? 'indication' : isClosed ? 'closed' : 'final'}
                  labels={
                    isSubmittedChangeRequest
                      ? {
                          indication: t(
                            'features.agendas.crTimeline.submittedVotePending',
                            'Submitted - vote pending'
                          ),
                        }
                      : isIndicative && editingMode === 'event_final_closing_vote'
                        ? {
                            indication: t('features.agendas.crTimeline.ready', 'Ready'),
                          }
                        : undefined
                  }
                />
              )}
              {getStatusBadge(
                item.status,
                isCurrent && !isLocked,
                t,
                resolvedVoteResult,
                (item as Record<string, unknown>)._originalStatus as string | undefined
              )}
              <ChevronDown className="text-muted-foreground h-4 w-4 transition-transform [[data-state=open]_&]:rotate-180" />
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Locked message for final vote */}
            {isLocked && (
              <p className="text-muted-foreground text-sm italic">
                {placeholderDescription ??
                  t('features.agendas.crTimeline.finalVoteLocked', 'Final Vote Locked')}
              </p>
            )}
            {isPlaceholder && !isLocked && placeholderDescription ? (
              <p className="text-muted-foreground text-sm italic">{placeholderDescription}</p>
            ) : null}

            {/* CR description */}
            {cr?.description && <p className="text-muted-foreground text-sm">{cr.description}</p>}

            {/* Suggestion text changes (Add / Delete) */}
            {diff &&
              !item.is_closing_vote &&
              (diff.originalText ||
                diff.newText ||
                diff.justification ||
                (diff.newProperties && Object.keys(diff.newProperties).length > 0)) && (
                <div className="space-y-3">
                  {/* Formatting change */}
                  {diff.changeType === 'update' && diff.newText && (
                    <div>
                      <h4
                        className={featureThemeClassName('agendaChangeRequestTimelineCardInfoText')}
                      >
                        {isClosed
                          ? translateText('generated.inline.0001_formatting_changed_a569a947')
                          : translateText('generated.inline.0002_formatting_change_ca927cc5')}
                      </h4>
                      {diff.newProperties && Object.keys(diff.newProperties).length > 0 && (
                        <div
                          className={featureThemeClassName(
                            'agendaChangeRequestTimelineCardInfoPanel'
                          )}
                        >
                          <div className="mb-1 flex flex-wrap gap-2">
                            {Object.entries(diff.newProperties).map(([key, value]) => (
                              <BadgeControl
                                key={key}
                                variant="outline"
                                className="text-xs capitalize"
                              >
                                {key}: {String(value)}
                              </BadgeControl>
                            ))}
                          </div>
                          <p className="text-xs whitespace-pre-wrap">
                            {translateText('generated.inline.0019_to_text_71c96fa4')}
                            {diff.newText}&quot;
                          </p>
                        </div>
                      )}
                      {diff.properties && Object.keys(diff.properties).length > 0 && (
                        <div className="bg-muted/50 mt-2 rounded-lg p-3">
                          <p className="text-muted-foreground mb-1 text-xs font-semibold">
                            {isClosed
                              ? translateText('generated.inline.0003_removed_formatting_684a9f22')
                              : translateText('generated.inline.0004_remove_formatting_6266abf5')}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(diff.properties).map(([key, value]) => (
                              <BadgeControl
                                key={key}
                                variant="outline"
                                className="text-xs capitalize opacity-60"
                              >
                                {key}: {String(value)}
                              </BadgeControl>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Removed text */}
                  {diff.originalText &&
                    (diff.changeType === 'remove' ||
                      diff.changeType === 'delete' ||
                      diff.changeType === 'replace') && (
                      <div>
                        <h4
                          className={featureThemeClassName(
                            'agendaChangeRequestTimelineCardDangerText'
                          )}
                        >
                          {diff.changeType === 'remove' || diff.changeType === 'delete'
                            ? isClosed
                              ? translateText('generated.inline.0005_deleted_4e8bafed')
                              : translateText('generated.inline.0006_delete_ed576ebf')
                            : translateText('generated.inline.0007_original_text_da16d17d')}
                        </h4>
                        <div
                          className={featureThemeClassName(
                            'agendaChangeRequestTimelineCardDangerPanel'
                          )}
                        >
                          <p className="text-xs whitespace-pre-wrap">{diff.originalText}</p>
                        </div>
                      </div>
                    )}

                  {/* Added/replacement text */}
                  {diff.newText &&
                    (diff.changeType === 'insert' || diff.changeType === 'replace') && (
                      <div>
                        <h4
                          className={featureThemeClassName(
                            'agendaChangeRequestTimelineCardSuccessText'
                          )}
                        >
                          {diff.changeType === 'insert'
                            ? isClosed
                              ? translateText('generated.inline.0008_added_0ae84aa1')
                              : translateText('generated.inline.0009_add_c37195fe')
                            : translateText('generated.inline.0010_replace_with_e0b9893c')}
                        </h4>
                        <div
                          className={featureThemeClassName(
                            'agendaChangeRequestTimelineCardSuccessPanel'
                          )}
                        >
                          <p className="text-xs whitespace-pre-wrap">{diff.newText}</p>
                        </div>
                      </div>
                    )}

                  {/* Justification */}
                  {diff.justification && (
                    <div>
                      <h4 className="mb-1 text-sm font-semibold">
                        {translateText('generated.inline.0020_justification_fa03998d')}
                      </h4>
                      <p className="text-muted-foreground text-xs">{diff.justification}</p>
                    </div>
                  )}
                </div>
              )}

            {/* Preview with per-card suggestion filter. */}
            {showEditorPreview && streetDesignChangeRequest ? (
              <div className="space-y-2">
                <StreetDesignChangeRequestPreview
                  changeRequest={streetDesignChangeRequest}
                  streetDesigns={streetDesigns}
                />
              </div>
            ) : null}
            {showEditorPreview && !streetDesignChangeRequest && documentContent && suggestionId && (
              <div className="space-y-2">
                <CREditorPreview
                  documentContent={documentContent ?? ([] as Value)}
                  suggestionIds={selectedSuggestionIds}
                  suggestionResolutions={suggestionResolutions}
                  editingMode={editingMode}
                  amendmentId={amendmentId}
                  userId={userId}
                  userRecord={userRecord}
                  agendaItemId={agendaItemId}
                  toolbarEnd={
                    <>
                      {/* Suggestion filter for the read-only card preview. */}
                      {editingMode !== 'suggest_event' &&
                        editingMode !== 'event_final_closing_vote' &&
                        discussions &&
                        discussions.length > 1 && (
                          <SuggestionViewToggle
                            discussions={discussions}
                            selectedCrIds={selectedCrIds}
                            onSelectedCrIdsChange={setSelectedCrIds}
                          />
                        )}
                    </>
                  }
                />
              </div>
            )}

            {/* Vote results */}
            {!isInternalVotingMode &&
              !isPlaceholder &&
              !isDirectInternalResolution &&
              !isPendingSubmission &&
              (choices.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="text-muted-foreground">{t('features.events.agenda.noChoices')}</p>
                </div>
              ) : (
                <VoteResultsDisplay
                  options={voteOptions}
                  phase={isIndicative ? 'indication' : isClosed ? 'closed' : 'final'}
                  totalFinal={totalFinal}
                  totalIndication={totalIndicative}
                  totalEligible={totalVoters}
                  selectedOptionIds={userSelectedChoiceIds}
                  winnerOptionId={isClosed ? winningChoiceId : null}
                  showWinner={isClosed}
                />
              ))}

            {/* Participation count */}
            {vote &&
              !isInternalVotingMode &&
              !isDirectInternalResolution &&
              !isPendingSubmission && (
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <span>
                    {currentPhaseVoteCount}/{totalVoters}{' '}
                    {t('features.agendas.crTimeline.votersParticipated')}
                  </span>
                </div>
              )}

            {hasUserVoted && !isPendingSubmission && (
              <div className="flex items-center justify-center gap-2 text-sm">
                <CheckCircle2
                  className={featureThemeClassName('agendaAgendaElectionSectionSuccessIcon')}
                />
                <span className="text-muted-foreground">
                  {isInternalVotingMode
                    ? t('features.agendas.crTimeline.voteRecorded', 'Vote recorded')
                    : isIndicative
                      ? t('features.events.agenda.yourIndication')
                      : t('features.events.agenda.yourVote')}
                </span>
              </div>
            )}

            {isInternalVotingMode &&
              !isPendingSubmission &&
              !isLocked &&
              internalTotalVotes > 0 && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-md border p-2">
                    <div className="text-muted-foreground">
                      {translateText('generated.inline.0121_accept_bb54db51')}
                    </div>
                    <div className="font-semibold">{internalAcceptVotes}</div>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="text-muted-foreground">
                      {translateText('generated.inline.1142_reject_2b03b592')}
                    </div>
                    <div className="font-semibold">{internalRejectVotes}</div>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="text-muted-foreground">
                      {translateText('generated.inline.1144_abstain_bc39d849')}
                    </div>
                    <div className="font-semibold">{internalAbstainVotes}</div>
                  </div>
                </div>
              )}

            {isInternalVotingMode && !isPendingSubmission && !isClosed && !isLocked && (
              <div className="bg-background/70 rounded-md border p-3 text-xs">
                {internalCloseTrigger === 'after_minutes' && internalVotingDeadline ? (
                  <span>
                    {t('features.agendas.crTimeline.deadline', 'Deadline')}:{' '}
                    {new Date(internalVotingDeadline).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                ) : (
                  <span>
                    {t(
                      'features.amendments.voteControls.collaboratorsVoted',
                      {
                        voted: internalVotedCount,
                        total: internalEligibleCount,
                      },
                      `${internalVotedCount}/${internalEligibleCount} collaborators with vote right voted`
                    )}
                  </span>
                )}
              </div>
            )}

            {isInternalVotingMode &&
              !isPendingSubmission &&
              !hideInlineVotingControls &&
              !isLocked &&
              !isClosed &&
              effectiveCanVote &&
              cr && (
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="default"
                    className={cn(
                      featureThemeClassName('agendaChangeRequestTimelineCardSuccessBackground'),
                      internalUserVote === 'accept' && 'ring-ring ring-2 ring-offset-1'
                    )}
                    disabled={votingLoading}
                    onClick={e => {
                      e.stopPropagation();
                      handleCastVote(`mock-choice-yes-${internalChoiceIdSuffix}`);
                    }}
                  >
                    {translateText('generated.inline.0121_accept_bb54db51')}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className={cn(
                      internalUserVote === 'reject' && 'ring-ring ring-2 ring-offset-1'
                    )}
                    disabled={votingLoading}
                    onClick={e => {
                      e.stopPropagation();
                      handleCastVote(`mock-choice-no-${internalChoiceIdSuffix}`);
                    }}
                  >
                    {translateText('generated.inline.1142_reject_2b03b592')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className={cn(
                      internalUserVote === 'abstain' && 'ring-ring ring-2 ring-offset-1'
                    )}
                    disabled={votingLoading}
                    onClick={e => {
                      e.stopPropagation();
                      handleCastVote(`mock-choice-abstain-${internalChoiceIdSuffix}`);
                    }}
                  >
                    {translateText('generated.inline.1144_abstain_bc39d849')}
                  </Button>
                </div>
              )}

            {/* Voting buttons for active items */}
            {canCastVoteFromCard && (
              <div className="flex gap-2 pt-2">
                {choices.map((choice: any, choiceIndex: number) => {
                  const choiceKind = getCanonicalVoteChoice(choice.label);
                  const isSelectedChoice = userSelectedChoiceIds.includes(choice.id);

                  return (
                    <Button
                      key={choice.id}
                      size="sm"
                      variant={
                        choiceKind === 'yes'
                          ? 'default'
                          : choiceKind === 'no'
                            ? 'destructive'
                            : 'secondary'
                      }
                      className={cn(
                        choiceKind === 'yes' &&
                          featureThemeClassName('agendaChangeRequestTimelineCardSuccessBackground'),
                        isSelectedChoice && 'ring-ring ring-2 ring-offset-1'
                      )}
                      disabled={votingLoading}
                      onClick={e => {
                        e.stopPropagation();
                        handleCastVote(choice.id);
                      }}
                    >
                      {getLocalizedVoteChoiceLabel(
                        choice.label,
                        t,
                        t('features.events.agenda.defaultChoiceLabels.choiceWithNumber', {
                          count: choiceIndex + 1,
                        })
                      )}
                    </Button>
                  );
                })}
              </div>
            )}

            {isDirectInternalResolution && (
              <div className="text-muted-foreground rounded-md border p-3 text-sm">
                {t('features.agendas.crTimeline.directInternalResolution')}
              </div>
            )}

            {/* Moderator controls for active items */}
            {(canOpenVoteDialogFromAgendaDetails ||
              canStartFinalVoteFromCard ||
              (isCurrent &&
                !hideInlineVotingControls &&
                !isLocked &&
                canManage &&
                !isClosed &&
                isFinal)) && (
              <div className="flex gap-2 border-t pt-3">
                {canOpenVoteDialogFromAgendaDetails && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className={cn(
                          'civic-ballot-submit bg-background border px-3 font-semibold shadow-sm transition-all',
                          effectiveCanVote
                            ? featureThemeClassName('agendaAgendaActionBarAccentBadge')
                            : 'border-muted-foreground/30 text-muted-foreground opacity-70'
                        )}
                        disabled={votingLoading}
                        aria-disabled={isVoteActionBlocked || undefined}
                        title={!effectiveCanVote ? resolvedVoteDisabledTooltip : undefined}
                        onClick={e => {
                          e.stopPropagation();
                          if (!isVoteActionBlocked) {
                            handleOpenVoteDialog();
                          }
                        }}
                      >
                        <Vote className="mr-1 h-3 w-3" />
                        {startIndicativeActionLabel}
                        {!effectiveCanVote ? <CircleHelp className="ml-1 h-3 w-3" /> : null}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-64">
                      {resolvedVoteDisabledTooltip}
                    </TooltipContent>
                  </Tooltip>
                )}
                {canStartFinalVoteFromCard && (
                  <>
                    {isJumpToFinalVoteStep ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={votingLoading}
                        onClick={e => {
                          e.stopPropagation();
                          void handleStartFinalVote();
                        }}
                      >
                        <Flag className="mr-1 h-3 w-3" />
                        {startFinalActionLabel}
                      </Button>
                    ) : (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={votingLoading}
                            onClick={e => e.stopPropagation()}
                          >
                            <Flag className="mr-1 h-3 w-3" />
                            {startFinalActionLabel}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={e => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{startFinalDialogTitle}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {summaryIdentifier}. {startFinalDescription}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              {t('common.actions.cancel', 'Cancel')}
                            </AlertDialogCancel>
                            <AlertDialogAction
                              disabled={votingLoading}
                              onClick={() => {
                                void handleStartFinalVote();
                              }}
                            >
                              {startFinalActionLabel}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </>
                )}
                {isFinal && !hideInlineVotingControls && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="default" onClick={e => e.stopPropagation()}>
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        {closeFinalActionLabel}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={e => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{closeFinalActionLabel}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {currentPhaseVoteCount}/{totalVoters}{' '}
                          {t('features.agendas.crTimeline.votersParticipated')}.{' '}
                          {t('features.agendas.crTimeline.currentProjection', 'Current projection')}
                          : {projectionText}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>
                          {t('common.actions.cancel', 'Cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={() => onCloseVoting?.(item.id)}>
                          {closeFinalActionLabel}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
