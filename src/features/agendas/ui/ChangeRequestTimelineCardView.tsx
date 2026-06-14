'use client';
import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl, StatusBadge, type BadgeTone } from '@/features/shared/ui/status';
import type { Value } from 'platejs';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import {
  ChevronDown,
  CheckCircle2,
  Circle,
  Loader2,
  Vote,
  Play,
  Flag,
  Lock,
  Crown,
} from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { VotingPhaseBadge as VotePhaseBadge } from '@/features/shared/ui/voting';
import { VoteResultsDisplay, type VoteBarOption } from '@/features/vote-cast/ui/VoteResultsDisplay';
import { VoteResultSentence } from '@/features/vote-cast/ui/VoteResultSentence';
import { CREditorPreview } from '@/features/change-requests/ui/CREditorPreview';
import { SuggestionViewToggle } from '@/features/editor/ui/SuggestionViewToggle';
import { EditingModeSelector } from '@/features/editor/ui/EditingModeSelector';
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
]; /** Optional text diff data to render inside the card. */
export interface ChangeRequestDiffData {
  changeType?: string;
  originalText?: string;
  newText?: string;
  properties?: Record<string, string>;
  newProperties?: Record<string, string>;
  justification?: string;
}
function getStatusIcon(status: string | null, isCurrent: boolean) {
  if (status === 'completed')
    return (
      <CheckCircle2
        className={featureThemeClassName('agendaChangeRequestTimelineCardSuccessIcon')}
      />
    );
  if (isCurrent)
    return (
      <Loader2
        className={featureThemeClassName('agendaChangeRequestTimelineCardInfoLoadingIcon')}
      />
    );
  return <Circle className="text-muted-foreground h-5 w-5" />;
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
  isCurrent,
  hasUserVoted,
  userSelectedChoiceIds,
  canManage,
  canVote,
  diff,
  documentContent,
  suggestionId,
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
  winningLabel,
  resolvedVoteSharePercent,
  currentPhaseVoteCount,
  handleCastVote,
  isLocked,
}: ChangeRequestTimelineCardViewProps) {
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
            <div className="flex items-center gap-3">
              {isLocked ? (
                <Lock className="text-muted-foreground h-5 w-5" />
              ) : (
                getStatusIcon(item.status, isCurrent)
              )}
              <CardTitle size="sm" weight="medium">
                {item.is_final_vote && <Vote className="mr-1 inline h-4 w-4" />}
                {title}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {hasUserVoted && (
                <BadgeControl variant="outline" size="xs">
                  {t('features.agendas.crTimeline.voted')}
                </BadgeControl>
              )}
              {!isLocked && vote && (
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
                  {/* Mode selector — always shown when amendmentId is available */}
                  {amendmentId && (
                    <EditingModeSelector amendmentId={amendmentId} currentMode={editingMode} />
                  )}
                  {/* Suggestion filter — only for read-only preview (interactive editor has its own) */}
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
                  <CREditorPreview
                    documentContent={documentContent ?? ([] as Value)}
                    suggestionIds={selectedSuggestionIds}
                    editingMode={editingMode}
                    amendmentId={amendmentId}
                    userId={userId}
                    agendaItemId={agendaItemId}
                  />
                </div>
              )}

            {/* Vote result sentence when closed */}
            {isClosed && resolvedVoteResult && (
              <VoteResultSentence
                type="vote"
                result={resolvedVoteResult}
                winnerName={winningLabel}
                voteSharePercent={resolvedVoteSharePercent}
                isFinal
              />
            )}

            {/* Vote results with one bar block per choice */}
            {!isLocked &&
              (choices.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="text-muted-foreground">{t('features.events.agenda.noChoices')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {choiceStats.map((cs: any, idx: number) => {
                    const isWinner = cs.choice.id === winningChoiceId && !isIndicative;
                    const isSelected = userSelectedChoiceIds.includes(cs.choice.id);
                    const colors = CR_CHOICE_COLORS[idx % CR_CHOICE_COLORS.length];

                    const option: VoteBarOption = {
                      key: cs.choice.id,
                      label: cs.choice.label || `Choice ${idx + 1}`,
                      color: colors.color,
                      lightColor: colors.light,
                      finalCount: cs.finalCount,
                      finalPercent: cs.finalPercentage,
                      indicationCount: cs.indicativeCount,
                      indicationPercent: cs.indicativePercentage,
                    };

                    return (
                      <div
                        key={cs.choice.id}
                        className={cn(
                          'rounded-lg border p-3 transition-colors',
                          isSelected && 'border-primary bg-primary/5',
                          isWinner &&
                            isClosed &&
                            featureThemeClassName('agendaAgendaElectionSectionWarningSurface')
                        )}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <span className="font-medium">
                            {cs.choice.label || `Choice ${idx + 1}`}
                          </span>
                          {isWinner && isClosed && (
                            <Crown
                              className={featureThemeClassName(
                                'agendaAgendaElectionSectionWarningIcon'
                              )}
                            />
                          )}
                          {isSelected && <CheckCircle2 className="text-primary h-4 w-4" />}
                        </div>

                        <VoteResultsDisplay
                          options={[option]}
                          phase={isIndicative ? 'indication' : isClosed ? 'closed' : 'final_vote'}
                          totalFinal={totalFinal}
                          totalIndication={totalIndicative}
                          totalEligible={totalVoters}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}

            {/* Participation count */}
            {vote && !isLocked && (
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
                  {isIndicative
                    ? t('features.events.agenda.yourIndication')
                    : t('features.events.agenda.yourVote')}
                </span>
              </div>
            )}

            {/* Voting buttons for active items */}
            {isCurrent && !isLocked && !isClosed && !hasUserVoted && canVote && vote && (
              <div className="flex gap-2 pt-2">
                {choices.map((choice: any) => (
                  <Button
                    key={choice.id}
                    size="sm"
                    variant={
                      choice.label === 'yes'
                        ? 'default'
                        : choice.label === 'no'
                          ? 'destructive'
                          : 'secondary'
                    }
                    className={cn(
                      choice.label === 'yes' &&
                        featureThemeClassName('agendaChangeRequestTimelineCardSuccessBackground')
                    )}
                    disabled={votingLoading}
                    onClick={e => {
                      e.stopPropagation();
                      handleCastVote(choice.id);
                    }}
                  >
                    {choice.label}
                  </Button>
                ))}
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
