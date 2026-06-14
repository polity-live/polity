'use client';

import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Vote, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { VotePasswordInput } from './VotePasswordInput';
import { VotePhaseBadge } from './VotePhaseBadge';
import type { VotingPhase } from '../logic/votePhaseHelpers';
import {
  getElectionModeLabel,
  getSeatCountLabel,
  type ElectionMode,
} from '@/features/elections/logic/electionMode';
import { AmendmentForwardingPreview } from '@/features/amendments/ui/AmendmentForwardingPreview';

// ─── Types ───────────────────────────────────────────────────────────

interface Candidate {
  id: string;
  name: string;
  avatar?: string;
}

interface VoteChoice {
  id: string;
  label: string;
}

interface VoteCastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phase: VotingPhase;

  /** For elections — list of candidates */
  candidates?: Candidate[];
  /** For elections — max selectable candidates (default 1) */
  maxVotes?: number;
  /** For elections — structured election mode */
  electionMode?: ElectionMode | null;
  /** For elections — seat count */
  seatCount?: number | null;

  /** For votes — dynamic list of choices */
  choices?: VoteChoice[];

  title?: string;
  forwardingPreview?: {
    nextEventId?: string | null;
    nextGroupName?: string | null;
    nextEventTitle: string;
    nextEventStartDate?: number | null;
  } | null;

  /** Password confirmation */
  requirePassword?: boolean;
  passwordError?: string | null;
  isPasswordVerifying?: boolean;

  /** Callbacks */
  onCastVote?: (choiceId: string) => Promise<void>;
  onCastElectionVote?: (candidateIds: string[]) => Promise<void>;
  onPasswordSubmit?: (password: string) => Promise<void>;

  isLoading?: boolean;
}

type DialogStep = 'choice' | 'confirm' | 'password';

/**
 * Reusable vote-casting dialog.
 *
 * Flow:
 * 1. Choose vote option (candidate(s) or choice)
 * 2. Confirm selection
 * 3. (optional) Enter voting password → auto-submit on correct 4 digits
 * 4. Dialog closes
 */
export function VoteCastDialog({
  open,
  onOpenChange,
  phase,
  candidates,
  maxVotes = 1,
  electionMode,
  seatCount,
  choices,
  title,
  forwardingPreview,
  requirePassword,
  passwordError,
  isPasswordVerifying,
  onCastVote,
  onCastElectionVote,
  onPasswordSubmit,
  isLoading,
}: VoteCastDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<DialogStep>('choice');
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);

  const isElection = candidates && candidates.length > 0;
  const isMultiSelect = isElection && maxVotes > 1;
  const isListElection = isElection && electionMode === 'list';
  const assignedVoteCount = selectedCandidateIds.length;
  const remainingVoteCount = Math.max(0, maxVotes - assignedVoteCount);

  const handleReset = useCallback(() => {
    setStep('choice');
    setSelectedChoiceId(null);
    setSelectedCandidateIds([]);
  }, []);

  const handleOpenChange = (value: boolean) => {
    if (!value) handleReset();
    onOpenChange(value);
  };

  const submitVote = async () => {
    if (isElection && selectedCandidateIds.length > 0 && onCastElectionVote) {
      await onCastElectionVote(selectedCandidateIds);
    } else if (selectedChoiceId && onCastVote) {
      await onCastVote(selectedChoiceId);
    }
    handleReset();
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (requirePassword) {
      setStep('password');
      return;
    }
    await submitVote();
  };

  const handlePasswordSubmit = async (password: string) => {
    try {
      if (onPasswordSubmit) {
        await onPasswordSubmit(password);
      }
      await submitVote();
    } catch {
      // Error toast is handled by the password verification hook
    }
  };

  const toggleCandidate = (candidateId: string) => {
    setSelectedCandidateIds(prev => {
      if (prev.includes(candidateId)) {
        return prev.filter(id => id !== candidateId);
      }
      if (isMultiSelect) {
        if (prev.length >= maxVotes) return prev;
        return [...prev, candidateId];
      }
      // Single select — replace
      return [candidateId];
    });
  };

  const hasSelection = isElection ? selectedCandidateIds.length > 0 : !!selectedChoiceId;

  const selectedCandidates = candidates?.filter(c => selectedCandidateIds.includes(c.id)) ?? [];
  const selectedChoice = choices?.find(c => c.id === selectedChoiceId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <ScrollableDialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Vote className="h-5 w-5" />
            {step === 'password'
              ? t('features.events.voting.confirmWithPassword')
              : t('features.events.voting.castVote')}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <span>{title}</span>
              <VotePhaseBadge phase={phase} />
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Choice */}
        {step === 'choice' && (
          <div className="space-y-3 py-4">
            {isElection && candidates ? (
              // Election: candidate list (single or multi-select)
              <>
                {isMultiSelect && (
                  <div className="text-muted-foreground space-y-1 text-sm">
                    <p>
                      {t(
                        'features.events.voting.selectUpTo',
                        `Select up to ${maxVotes} candidates`
                      )}
                    </p>
                    {isListElection ? (
                      <>
                        <p>
                          {assignedVoteCount}
                          {translateText('generated.inline.0183_von_445584ed')}
                          {maxVotes}
                          {translateText('generated.inline.1231_stimmen_vergeben_6192649c')}
                        </p>
                        <p>
                          {remainingVoteCount}
                          {translateText('generated.inline.1232_stimmen_offen_628de92d')}
                        </p>
                      </>
                    ) : (
                      <p>
                        {assignedVoteCount}/{maxVotes}
                      </p>
                    )}
                    {isListElection ? (
                      <p>
                        {getElectionModeLabel('list')}
                        {seatCount ? ` · ${getSeatCountLabel(seatCount)}` : ''}
                      </p>
                    ) : null}
                  </div>
                )}
                {candidates.map(candidate => {
                  const isSelected = selectedCandidateIds.includes(candidate.id);
                  return (
                    <div
                      key={candidate.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-all duration-200',
                        'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/30',
                        'hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/35 dark:hover:to-indigo-900/45',
                        'hover:-translate-y-0.5 hover:shadow-md',
                        isSelected
                          ? 'border-green-500 from-blue-100 to-indigo-100 shadow-sm dark:from-blue-900/40 dark:to-indigo-900/50'
                          : 'border-blue-100 dark:border-blue-800/40'
                      )}
                      onClick={() => toggleCandidate(candidate.id)}
                    >
                      <Avatar className="h-12 w-12 ring-2 ring-white dark:ring-gray-800">
                        <AvatarImage src={candidate.avatar} alt={candidate.name} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-200 to-indigo-200 text-blue-800 dark:from-blue-800 dark:to-indigo-800 dark:text-blue-200">
                          {candidate.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 font-medium text-blue-900 dark:text-blue-100">
                        {candidate.name}
                      </span>
                      {isSelected ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Circle className="text-muted-foreground/40 h-5 w-5" />
                      )}
                    </div>
                  );
                })}
              </>
            ) : choices && choices.length > 0 ? (
              // Vote: dynamic choice list
              <div className="grid gap-3">
                {choices.map(choice => {
                  const isSelected = selectedChoiceId === choice.id;
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      onClick={() => setSelectedChoiceId(choice.id)}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-3 rounded-xl border px-5 py-4 text-left font-medium transition-all duration-200',
                        'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/30',
                        'hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/35 dark:hover:to-indigo-900/45',
                        'hover:-translate-y-0.5 hover:shadow-md',
                        isSelected
                          ? 'border-green-500 from-blue-100 to-indigo-100 text-blue-900 shadow-sm dark:from-blue-900/40 dark:to-indigo-900/50 dark:text-blue-100'
                          : 'text-foreground border-blue-100 dark:border-blue-800/40'
                      )}
                    >
                      {isSelected ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                      ) : (
                        <Circle className="text-muted-foreground/40 h-5 w-5 shrink-0" />
                      )}
                      {choice.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}

        {/* Confirm preview (shown inline when choice is made) */}
        {step === 'choice' && hasSelection && (
          <div className="bg-muted/30 rounded-lg border p-3">
            <p className="text-muted-foreground mb-2 text-sm font-medium">
              {t('features.events.voting.yourChoice')}:
            </p>
            {isElection && selectedCandidates.length > 0 ? (
              <div className="space-y-2">
                {selectedCandidates.map(c => (
                  <div key={c.id} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={c.avatar} alt={c.name} />
                      <AvatarFallback>{c.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{c.name}</span>
                  </div>
                ))}
              </div>
            ) : selectedChoice ? (
              <span className="font-medium">{selectedChoice.label}</span>
            ) : null}
          </div>
        )}

        {step === 'choice' && forwardingPreview ? (
          <AmendmentForwardingPreview
            nextEventId={forwardingPreview.nextEventId}
            nextGroupName={forwardingPreview.nextGroupName}
            nextEventTitle={forwardingPreview.nextEventTitle}
            nextEventStartDate={forwardingPreview.nextEventStartDate}
            compact
          />
        ) : null}

        {/* Step 3: Password */}
        {step === 'password' && (
          <div className="py-4">
            <VotePasswordInput
              onSubmit={handlePasswordSubmit}
              error={passwordError}
              isLoading={isPasswordVerifying}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t('common.actions.cancel')}
          </Button>
          {step === 'choice' && (
            <Button onClick={handleConfirm} disabled={isLoading || !hasSelection}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.actions.confirm')}
            </Button>
          )}
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}
