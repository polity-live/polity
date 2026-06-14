'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl, StatusBadge, type BadgeTone } from '@/features/shared/ui/status';
import { useMemo, useState } from 'react';
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
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { VotingPhaseBadge as VotePhaseBadge } from '@/features/shared/ui/voting';
import { VoteResultsDisplay, type VoteBarOption } from '@/features/vote-cast/ui/VoteResultsDisplay';
import { VoteResultSentence } from '@/features/vote-cast/ui/VoteResultSentence';
import {
  computeVoteResultSummary,
  type ChoiceOfflineTally,
  type MajorityType,
  type VoteResult,
} from '@/features/vote-cast/logic/computeVoteResults';
import { getVotePhase, getVoteResult } from '../hooks/useAgendaItemCRVoting';
import { calculateVoteStats } from '../hooks/useAgendaItemVoting';
import type { ChangeRequestTimelineRow } from '@/zero/agendas/queries';
import type { ChoicesByVoteRow } from '@/zero/votes/queries';
import { CREditorPreview } from '@/features/change-requests/ui/CREditorPreview';
import { SuggestionViewToggle } from '@/features/editor/ui/SuggestionViewToggle';
import { EditingModeSelector } from '@/features/editor/ui/EditingModeSelector';
import type { TDiscussion } from '@/features/editor/types';

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
        if (d.crId) map.set(d.crId, d.id);
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

  const title = item.is_final_vote
    ? t('features.agendas.crTimeline.acceptAmendment')
    : cr?.title || `${t('features.agendas.crTimeline.changeRequest')} ${index + 1}`;

  const phase = getVotePhase(item);
  const isClosed = phase === 'closed';
  const isIndicative = phase === 'indicative';
  const isFinal = phase === 'final_vote';
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

  const totalVoters = vote?.voters?.length ?? 0;

  const computedVoteSummary = useMemo(() => {
    if (!isClosed || choiceStats.length === 0) {
      return null;
    }

    return computeVoteResultSummary(
      choices.map((choice, idx) => ({
        id: choice.id,
        label: choice.label || `Choice ${idx + 1}`,
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

  const isLocked = item.is_final_vote && isFinalVoteLocked;

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
                  {choiceStats.map((cs, idx) => {
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
                {choices.map(choice => (
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
