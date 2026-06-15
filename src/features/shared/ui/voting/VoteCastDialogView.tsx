'use client';

import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CheckCircle2, Circle, Vote } from 'lucide-react';

import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { choiceSelect } from '@/features/shared/motion';
import { getSemanticToneClasses } from '@/features/shared/theme';
import { cn } from '@/features/shared/utils/utils';
import { VotePasswordInput } from './VotePasswordInput';
import { VotingPhaseBadge, type VotingPhaseValue } from './VotingControls';

export interface VoteCastCandidate {
  id: string;
  name: string;
  avatar?: string;
}

export interface VoteCastChoice {
  id: string;
  label: string;
}

export type VoteCastDialogStep = 'choice' | 'confirm' | 'password';

export interface VoteCastDialogViewLabels {
  castVote: ReactNode;
  confirmWithPassword: ReactNode;
  cancel: ReactNode;
  confirm: ReactNode;
  yourChoice: ReactNode;
  selectUpTo?: ReactNode;
  assignedVotes?: ReactNode;
  remainingVotes?: ReactNode;
  electionModeSummary?: ReactNode;
}

export interface VoteCastDialogViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: VoteCastDialogStep;
  phase: VotingPhaseValue;
  title?: ReactNode;
  candidates?: VoteCastCandidate[];
  choices?: VoteCastChoice[];
  selectedCandidateIds: string[];
  selectedChoiceId: string | null;
  maxVotes: number;
  isMultiSelect?: boolean;
  isListElection?: boolean;
  requirePassword?: boolean;
  passwordError?: string | null;
  isPasswordVerifying?: boolean;
  isLoading?: boolean;
  submissionActive?: boolean;
  forwardingPreviewContent?: ReactNode;
  submissionOverlay?: ReactNode;
  labels: VoteCastDialogViewLabels;
  onToggleCandidate: (candidateId: string) => void;
  onSelectChoice: (choiceId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onPasswordSubmit: (password: string) => void | Promise<void>;
}

export function VoteCastDialogView({
  open,
  onOpenChange,
  step,
  phase,
  title,
  candidates,
  choices,
  selectedCandidateIds,
  selectedChoiceId,
  maxVotes,
  isMultiSelect = false,
  isListElection = false,
  passwordError,
  isPasswordVerifying,
  isLoading,
  submissionActive = false,
  forwardingPreviewContent,
  submissionOverlay,
  labels,
  onToggleCandidate,
  onSelectChoice,
  onConfirm,
  onCancel,
  onPasswordSubmit,
}: VoteCastDialogViewProps) {
  const isElection = Boolean(candidates?.length);
  const selectedCandidates =
    candidates?.filter((candidate: any) => selectedCandidateIds.includes(candidate.id)) ?? [];
  const selectedChoice = choices?.find((choice: any) => choice.id === selectedChoiceId);
  const assignedVoteCount = selectedCandidateIds.length;
  const hasSelection = isElection ? selectedCandidateIds.length > 0 : Boolean(selectedChoiceId);
  const reducedMotion = useReducedMotion();
  const selectedTone = getSemanticToneClasses('success');
  const dialogContentClassName = submissionActive
    ? '!z-[140] h-dvh max-h-none !max-h-none w-screen max-w-none overflow-hidden rounded-none border-0 bg-transparent p-0 shadow-none sm:max-w-none'
    : '!z-[140] max-h-[80vh] overflow-y-auto sm:max-w-lg';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent
        className={dialogContentClassName}
        showCloseButton={!submissionActive}
      >
        {!submissionActive ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Vote className="h-5 w-5" />
                {step === 'password' ? labels.confirmWithPassword : labels.castVote}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <span>{title}</span>
                  <VotingPhaseBadge phase={phase} />
                </div>
              </DialogDescription>
            </DialogHeader>

            {step === 'choice' ? (
              <div className="space-y-3 py-4">
                {isElection && candidates ? (
                  <>
                    {isMultiSelect ? (
                      <div className="text-muted-foreground space-y-1 text-sm">
                        {labels.selectUpTo ? <p>{labels.selectUpTo}</p> : null}
                        {isListElection ? (
                          <>
                            {labels.assignedVotes ? (
                              <p>{labels.assignedVotes}</p>
                            ) : (
                              <p>
                                {assignedVoteCount}/{maxVotes}
                              </p>
                            )}
                            {labels.remainingVotes ? <p>{labels.remainingVotes}</p> : null}
                          </>
                        ) : (
                          <p>
                            {assignedVoteCount}/{maxVotes}
                          </p>
                        )}
                        {labels.electionModeSummary ? <p>{labels.electionModeSummary}</p> : null}
                      </div>
                    ) : null}
                    {candidates.map((candidate: any) => {
                      const isSelected = selectedCandidateIds.includes(candidate.id);

                      return (
                        <motion.div
                          key={candidate.id}
                          layout={!reducedMotion}
                          variants={reducedMotion ? undefined : choiceSelect}
                          initial="rest"
                          animate={isSelected ? 'selected' : 'rest'}
                          whileTap={reducedMotion ? undefined : 'tap'}
                        >
                          <Button
                            type="button"
                            variant="outline"
                            aria-pressed={isSelected}
                            className={cn(
                              'flex h-auto w-full cursor-pointer items-center justify-start gap-4 rounded-xl border p-4 text-left whitespace-normal transition-all duration-200',
                              'bg-card hover:bg-muted/45 hover:-translate-y-0.5 hover:shadow-md',
                              isSelected
                                ? cn(selectedTone.surface, 'shadow-sm')
                                : 'border-border/70 text-foreground'
                            )}
                            onClick={() => onToggleCandidate(candidate.id)}
                          >
                            <Avatar className="ring-background h-12 w-12 ring-2">
                              <AvatarImage src={candidate.avatar} alt={candidate.name} />
                              <AvatarFallback className="border-border bg-muted text-foreground border">
                                {candidate.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="flex-1 font-medium">{candidate.name}</span>
                            <AnimatePresence mode="wait" initial={false}>
                              {isSelected ? (
                                <motion.span
                                  key="selected"
                                  initial={reducedMotion ? false : { opacity: 0, scale: 0.75 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={reducedMotion ? undefined : { opacity: 0, scale: 0.75 }}
                                  transition={{ duration: 0.16 }}
                                >
                                  <CheckCircle2 className="h-5 w-5 text-[var(--badge-success-fg)]" />
                                </motion.span>
                              ) : (
                                <motion.span
                                  key="idle"
                                  initial={reducedMotion ? false : { opacity: 0, scale: 0.75 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={reducedMotion ? undefined : { opacity: 0, scale: 0.75 }}
                                  transition={{ duration: 0.16 }}
                                >
                                  <Circle className="text-muted-foreground/40 h-5 w-5" />
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </Button>
                        </motion.div>
                      );
                    })}
                  </>
                ) : choices && choices.length > 0 ? (
                  <div className="grid gap-3">
                    {choices.map((choice: any) => {
                      const isSelected = selectedChoiceId === choice.id;

                      return (
                        <motion.div
                          key={choice.id}
                          layout={!reducedMotion}
                          variants={reducedMotion ? undefined : choiceSelect}
                          initial="rest"
                          animate={isSelected ? 'selected' : 'rest'}
                          whileTap={reducedMotion ? undefined : 'tap'}
                        >
                          <Button
                            type="button"
                            variant="outline"
                            aria-pressed={isSelected}
                            onClick={() => onSelectChoice(choice.id)}
                            className={cn(
                              'flex h-auto w-full cursor-pointer items-center justify-start gap-3 rounded-xl border px-5 py-4 text-left font-medium whitespace-normal transition-all duration-200',
                              'bg-card hover:bg-muted/45 hover:-translate-y-0.5 hover:shadow-md',
                              isSelected
                                ? cn(selectedTone.surface, 'shadow-sm')
                                : 'text-foreground border-border/70'
                            )}
                          >
                            <AnimatePresence mode="wait" initial={false}>
                              {isSelected ? (
                                <motion.span
                                  key="selected"
                                  initial={reducedMotion ? false : { opacity: 0, scale: 0.75 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={reducedMotion ? undefined : { opacity: 0, scale: 0.75 }}
                                  transition={{ duration: 0.16 }}
                                >
                                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--badge-success-fg)]" />
                                </motion.span>
                              ) : (
                                <motion.span
                                  key="idle"
                                  initial={reducedMotion ? false : { opacity: 0, scale: 0.75 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={reducedMotion ? undefined : { opacity: 0, scale: 0.75 }}
                                  transition={{ duration: 0.16 }}
                                >
                                  <Circle className="text-muted-foreground/40 h-5 w-5 shrink-0" />
                                </motion.span>
                              )}
                            </AnimatePresence>
                            {choice.label}
                          </Button>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}

            <AnimatePresence initial={false}>
              {step === 'choice' && hasSelection ? (
                <motion.div
                  layout={!reducedMotion}
                  initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="bg-muted/30 rounded-lg border p-3"
                >
                  <p className="text-muted-foreground mb-2 text-sm font-medium">
                    {labels.yourChoice}:
                  </p>
                  {isElection && selectedCandidates.length > 0 ? (
                    <div className="space-y-2">
                      {selectedCandidates.map((candidate: any) => (
                        <motion.div
                          key={candidate.id}
                          layout={!reducedMotion}
                          className="flex items-center gap-3"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={candidate.avatar} alt={candidate.name} />
                            <AvatarFallback>
                              {candidate.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{candidate.name}</span>
                        </motion.div>
                      ))}
                    </div>
                  ) : selectedChoice ? (
                    <span className="font-medium">{selectedChoice.label}</span>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>

            {step === 'choice' ? forwardingPreviewContent : null}

            {step === 'password' ? (
              <div className="py-4">
                <VotePasswordInput
                  onSubmit={onPasswordSubmit}
                  error={passwordError}
                  isLoading={isPasswordVerifying}
                />
              </div>
            ) : null}

            <DialogFooter>
              <Button variant="outline" onClick={onCancel}>
                {labels.cancel}
              </Button>
              {step === 'choice' ? (
                <Button onClick={onConfirm} disabled={isLoading || !hasSelection}>
                  {labels.confirm}
                </Button>
              ) : null}
            </DialogFooter>
          </>
        ) : null}

        {submissionOverlay}
      </ScrollableDialogContent>
    </Dialog>
  );
}
