'use client';
import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl, StatusBadge, type BadgeTone } from '@/features/shared/ui/status';
import type { Value } from 'platejs';
import { Card, CardContent, CardHeader } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import { ChevronDown, CheckCircle2, Play, Flag, Lock } from 'lucide-react';
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
import { SuggestionViewToggle } from '@/features/editor/ui/SuggestionViewToggle';
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
  suggestionId: any;
  crId: any;
  discussions: any;
  editingMode: any;
  amendmentId: any;
  userId: any;
  agendaItemId: any;
  showEditorPreview: any;
  onCastVote: any;
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
  title: any;
  phase: any;
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
  suggestionId,
  crId,
  discussions,
  editingMode,
  amendmentId,
  userId,
  agendaItemId,
  showEditorPreview,
  onStartIndicative,
  onStartFinal,
  onCloseVoting,
  t,
  votingLoading,
  selectedCrIds,
  setSelectedCrIds,
  selectedSuggestionIds,
  cr,
  vote,
  title,
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
  currentPhaseVoteCount,
  handleCastVote,
  isLocked,
}: ChangeRequestTimelineCardViewProps) {
  const summaryIdentifier = item.is_final_vote
    ? t('features.agendas.crTimeline.finalVoteShort', 'Final')
    : (crId ?? cr?.crId ?? `CR-${Number(index) + 1 || 1}`);
  const isInternalVotingMode = editingMode === 'vote_internal';
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
  const voteOptions: VoteBarOption[] = choiceStats.map((cs: any, idx: number) => {
    const colors = CR_CHOICE_COLORS[idx % CR_CHOICE_COLORS.length];

    return {
      key: cs.choice.id,
      label: cs.choice.label || `Choice ${idx + 1}`,
      color: colors.color,
      lightColor: colors.light,
      finalCount: cs.finalCount,
      finalPercent: cs.finalPercentage,
      indicationCount: cs.indicativeCount,
      indicationPercent: cs.indicativePercentage,
    };
  });

  return (
    <Collapsible defaultOpen={isCurrent || item.is_final_vote}>
      <Card
        className={cn(
          'transition-all',
          isCurrent &&
            !isLocked &&
            featureThemeClassName('agendaChangeRequestTimelineCardInfoRing'),
          item.status === 'completed' && 'opacity-75',
          isLocked && 'opacity-50'
        )}
      >
        <CollapsibleTrigger className="w-full">
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <div className="min-w-0 flex-1 pr-3">
              <ChangeRequestSummaryItem
                identifier={summaryIdentifier}
                title={title}
                status={item.status}
                changeType={item.is_final_vote ? 'final' : diff?.changeType}
                selected={isCurrent && !isLocked}
                variant="trigger"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {hasUserVoted && (
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
              {!isLocked && !isInternalVotingMode && vote && (
                <VotePhaseBadge
                  phase={isIndicative ? 'indication' : isClosed ? 'closed' : 'final_vote'}
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
                {t('features.agendas.crTimeline.finalVoteLocked')}
              </p>
            )}

            {/* CR description */}
            {cr?.description && <p className="text-muted-foreground text-sm">{cr.description}</p>}

            {/* Suggestion text changes (Add / Delete) */}
            {diff &&
              !item.is_final_vote &&
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
                    (diff.changeType === 'remove' || diff.changeType === 'replace') && (
                      <div>
                        <h4
                          className={featureThemeClassName(
                            'agendaChangeRequestTimelineCardDangerText'
                          )}
                        >
                          {diff.changeType === 'remove'
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

            {/* Editor preview with per-card suggestion filter */}
            {showEditorPreview &&
              (((editingMode === 'suggest_event' || editingMode === 'vote_event') && amendmentId) ||
                (documentContent && suggestionId)) && (
                <div className="space-y-2">
                  <CREditorPreview
                    documentContent={documentContent ?? ([] as Value)}
                    suggestionIds={selectedSuggestionIds}
                    editingMode={editingMode}
                    amendmentId={amendmentId}
                    userId={userId}
                    agendaItemId={agendaItemId}
                    toolbarEnd={
                      <>
                        {/* Suggestion filter for the read-only card preview. */}
                        {editingMode !== 'suggest_event' &&
                          editingMode !== 'vote_event' &&
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
            {!isLocked &&
              !isInternalVotingMode &&
              !isDirectInternalResolution &&
              (choices.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="text-muted-foreground">{t('features.events.agenda.noChoices')}</p>
                </div>
              ) : (
                <VoteResultsDisplay
                  options={voteOptions}
                  phase={isIndicative ? 'indication' : isClosed ? 'closed' : 'final_vote'}
                  totalFinal={totalFinal}
                  totalIndication={totalIndicative}
                  totalEligible={totalVoters}
                  selectedOptionIds={userSelectedChoiceIds}
                  winnerOptionId={isIndicative ? null : winningChoiceId}
                  showWinner={!isIndicative}
                />
              ))}

            {/* Participation count */}
            {vote && !isLocked && !isInternalVotingMode && !isDirectInternalResolution && (
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <span>
                  {currentPhaseVoteCount}/{totalVoters}{' '}
                  {t('features.agendas.crTimeline.votersParticipated')}
                </span>
              </div>
            )}

            {hasUserVoted && !isLocked && (
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

            {isInternalVotingMode && !isLocked && internalTotalVotes > 0 && (
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

            {isInternalVotingMode && !isClosed && !isLocked && (
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
                      `${internalVotedCount}/${internalEligibleCount} collaborators voted`
                    )}
                  </span>
                )}
              </div>
            )}

            {isInternalVotingMode && !isLocked && !isClosed && canVote && cr && (
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
                  className={cn(internalUserVote === 'reject' && 'ring-ring ring-2 ring-offset-1')}
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
                  className={cn(internalUserVote === 'abstain' && 'ring-ring ring-2 ring-offset-1')}
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
            {isCurrent && !isInternalVotingMode && !isLocked && !isClosed && canVote && vote && (
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
                        t(
                          'features.events.agenda.defaultChoiceLabels.choiceWithNumber',
                          { count: choiceIndex + 1 },
                          `Choice ${choiceIndex + 1}`
                        )
                      )}
                    </Button>
                  );
                })}
              </div>
            )}

            {isDirectInternalResolution && (
              <div className="text-muted-foreground rounded-md border p-3 text-sm">
                Ohne Abstimmung im internen Modus zugestimmt oder abgelehnt.
              </div>
            )}

            {/* Moderator controls for active items */}
            {isCurrent && !isLocked && canManage && !isClosed && (
              <div className="flex gap-2 border-t pt-3">
                {item.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={e => {
                      e.stopPropagation();
                      onStartIndicative?.(item.id);
                    }}
                  >
                    <Play className="mr-1 h-3 w-3" />
                    {t('features.agendas.crTimeline.startIndicative')}
                  </Button>
                )}
                {isIndicative && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={e => {
                      e.stopPropagation();
                      onStartFinal?.(item.id);
                    }}
                  >
                    <Flag className="mr-1 h-3 w-3" />
                    {t('features.agendas.crTimeline.startFinal')}
                  </Button>
                )}
                {isFinal && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={e => {
                      e.stopPropagation();
                      onCloseVoting?.(item.id);
                    }}
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    {t('features.agendas.crTimeline.closeVoting')}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
