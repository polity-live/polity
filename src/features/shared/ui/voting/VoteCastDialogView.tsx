'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, Circle, Loader2, Vote } from 'lucide-react';

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
  forwardingPreviewContent?: ReactNode;
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
  forwardingPreviewContent,
  labels,
  onToggleCandidate,
  onSelectChoice,
  onConfirm,
  onCancel,
  onPasswordSubmit,
}: VoteCastDialogViewProps) {
  const isElection = Boolean(candidates?.length);
  const selectedCandidates =
    candidates?.filter(candidate => selectedCandidateIds.includes(candidate.id)) ?? [];
  const selectedChoice = choices?.find(choice => choice.id === selectedChoiceId);
  const assignedVoteCount = selectedCandidateIds.length;
  const hasSelection = isElection ? selectedCandidateIds.length > 0 : Boolean(selectedChoiceId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
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
                {candidates.map(candidate => {
                  const isSelected = selectedCandidateIds.includes(candidate.id);

                  return (
                    <Button
                      key={candidate.id}
                      type="button"
                      variant="outline"
                      aria-pressed={isSelected}
                      className={cn(
                        'flex h-auto w-full cursor-pointer items-center justify-start gap-4 rounded-xl border p-4 text-left whitespace-normal transition-all duration-200',
                        'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/30',
                        'hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/35 dark:hover:to-indigo-900/45',
                        'hover:-translate-y-0.5 hover:shadow-md',
                        isSelected
                          ? 'border-green-500 from-blue-100 to-indigo-100 shadow-sm dark:from-blue-900/40 dark:to-indigo-900/50'
                          : 'border-blue-100 dark:border-blue-800/40'
                      )}
                      onClick={() => onToggleCandidate(candidate.id)}
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
                    </Button>
                  );
                })}
              </>
            ) : choices && choices.length > 0 ? (
              <div className="grid gap-3">
                {choices.map(choice => {
                  const isSelected = selectedChoiceId === choice.id;

                  return (
                    <Button
                      key={choice.id}
                      type="button"
                      variant="outline"
                      aria-pressed={isSelected}
                      onClick={() => onSelectChoice(choice.id)}
                      className={cn(
                        'flex h-auto w-full cursor-pointer items-center justify-start gap-3 rounded-xl border px-5 py-4 text-left font-medium whitespace-normal transition-all duration-200',
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
                    </Button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 'choice' && hasSelection ? (
          <div className="bg-muted/30 rounded-lg border p-3">
            <p className="text-muted-foreground mb-2 text-sm font-medium">{labels.yourChoice}:</p>
            {isElection && selectedCandidates.length > 0 ? (
              <div className="space-y-2">
                {selectedCandidates.map(candidate => (
                  <div key={candidate.id} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={candidate.avatar} alt={candidate.name} />
                      <AvatarFallback>{candidate.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{candidate.name}</span>
                  </div>
                ))}
              </div>
            ) : selectedChoice ? (
              <span className="font-medium">{selectedChoice.label}</span>
            ) : null}
          </div>
        ) : null}

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
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {labels.confirm}
            </Button>
          ) : null}
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}
