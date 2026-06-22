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
import { choiceSelect, listItem, staggerContainer } from '@/features/shared/motion';
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
  noVotingPasswordSettingsHref?: string;
  isPasswordVerifying?: boolean;
  isLoading?: boolean;
  submissionActive?: boolean;
  forwardingPreviewContent?: ReactNode;
  documentPreviewContent?: ReactNode;
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
  noVotingPasswordSettingsHref,
  isPasswordVerifying,
  isLoading,
  submissionActive = false,
  forwardingPreviewContent,
  documentPreviewContent,
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
    candidates?.filter(candidate => selectedCandidateIds.includes(candidate.id)) ?? [];
  const selectedChoice = choices?.find(choice => choice.id === selectedChoiceId);
  const assignedVoteCount = selectedCandidateIds.length;
  const remainingVoteCount = Math.max(0, maxVotes - assignedVoteCount);
  const hasSelection = isElection ? selectedCandidateIds.length > 0 : Boolean(selectedChoiceId);
  const reducedMotion = useReducedMotion();
  const selectedTone = getSemanticToneClasses('success');
  const voteProgressPercent =
    maxVotes > 0 ? Math.min(100, Math.max(0, (assignedVoteCount / maxVotes) * 100)) : 0;
  const hasChoiceSidebarContent =
    hasSelection || forwardingPreviewContent || documentPreviewContent;
  const dialogContentClassName = submissionActive
    ? '!z-[140] h-dvh max-h-none !max-h-none w-screen max-w-none overflow-hidden rounded-none border-0 bg-transparent p-0 shadow-none sm:max-w-none'
    : '!z-[140] h-dvh max-h-none !max-h-none w-screen max-w-none overflow-y-auto rounded-none border-0 bg-background p-0 shadow-none sm:max-w-none';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent
        className={dialogContentClassName}
        showCloseButton={!submissionActive}
      >
        {!submissionActive ? (
          <div className="min-h-dvh bg-[linear-gradient(180deg,var(--surface-raised)_0%,var(--background)_42%,var(--background)_100%)]">
            <div
              className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col justify-center px-4 py-6 sm:py-8"
              data-slot="vote-cast-centered-shell"
            >
              <div className="bg-card/85 w-full overflow-hidden rounded-lg border shadow-[var(--shadow-floating)]">
                <motion.div
                  className="border-b bg-[var(--surface-overlay)] px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8"
                  initial={reducedMotion ? false : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="mx-auto flex w-full flex-col gap-4">
                    <DialogHeader className="pr-12 text-left sm:text-left">
                      <DialogTitle className="flex items-center gap-3 text-xl leading-tight sm:text-2xl">
                        <span className="border-border bg-card text-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border shadow-sm">
                          <Vote className="h-5 w-5" />
                        </span>
                        <span>
                          {step === 'password' ? labels.confirmWithPassword : labels.castVote}
                        </span>
                      </DialogTitle>
                      <DialogDescription asChild>
                        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                          {title ? (
                            <span className="text-foreground font-medium">{title}</span>
                          ) : null}
                          <VotingPhaseBadge phase={phase} />
                          {labels.electionModeSummary ? (
                            <span>{labels.electionModeSummary}</span>
                          ) : null}
                        </div>
                      </DialogDescription>
                    </DialogHeader>

                    {step === 'choice' && isMultiSelect ? (
                      <motion.div
                        className="grid gap-3"
                        variants={staggerContainer}
                        initial={reducedMotion ? false : 'initial'}
                        animate="animate"
                      >
                        {labels.selectUpTo ? (
                          <motion.div
                            variants={reducedMotion ? undefined : listItem}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <span className="border-border bg-background/70 text-muted-foreground rounded-full border px-3 py-1 text-xs font-semibold">
                              {labels.selectUpTo}
                            </span>
                          </motion.div>
                        ) : null}

                        <motion.div
                          variants={reducedMotion ? undefined : listItem}
                          className="grid gap-2 sm:grid-cols-2"
                        >
                          <div className="border-border/70 bg-card/80 rounded-lg border px-4 py-3 shadow-sm">
                            <p className="text-sm font-semibold">
                              {isListElection && labels.assignedVotes
                                ? labels.assignedVotes
                                : `${assignedVoteCount}/${maxVotes}`}
                            </p>
                          </div>
                          <div className="border-border/70 bg-card/80 rounded-lg border px-4 py-3 shadow-sm">
                            <p className="text-sm font-semibold">
                              {isListElection && labels.remainingVotes
                                ? labels.remainingVotes
                                : `${remainingVoteCount} offen`}
                            </p>
                          </div>
                        </motion.div>

                        <motion.div
                          variants={reducedMotion ? undefined : listItem}
                          className="bg-muted relative h-2 overflow-hidden rounded-full"
                          aria-hidden="true"
                        >
                          <motion.div
                            className="bg-highlight h-full rounded-full"
                            initial={reducedMotion ? false : { width: 0 }}
                            animate={{ width: `${voteProgressPercent}%` }}
                            transition={{
                              duration: reducedMotion ? 0 : 0.32,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                          />
                          <motion.span
                            className="bg-highlight ring-background absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-sm ring-4"
                            initial={reducedMotion ? false : { left: '0%' }}
                            animate={{ left: `${voteProgressPercent}%` }}
                            transition={{
                              duration: reducedMotion ? 0 : 0.32,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                          />
                        </motion.div>
                      </motion.div>
                    ) : null}
                  </div>
                </motion.div>

                {step === 'choice' ? (
                  <main className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
                    <div
                      className={cn(
                        'mx-auto grid w-full max-w-5xl gap-4',
                        hasChoiceSidebarContent
                          ? 'lg:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)]'
                          : 'lg:max-w-3xl'
                      )}
                    >
                      <motion.div
                        className="grid gap-3"
                        variants={staggerContainer}
                        initial={reducedMotion ? false : 'initial'}
                        animate="animate"
                      >
                        {isElection && candidates
                          ? candidates.map(candidate => {
                              const isSelected = selectedCandidateIds.includes(candidate.id);

                              return (
                                <motion.div
                                  key={candidate.id}
                                  variants={reducedMotion ? undefined : listItem}
                                >
                                  <motion.div
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
                                        'group flex h-auto w-full cursor-pointer items-center justify-start gap-4 rounded-lg border p-4 text-left whitespace-normal transition-all duration-200',
                                        'bg-card/90 hover:bg-card hover:border-foreground/20 hover:shadow-[var(--shadow-panel)]',
                                        isSelected
                                          ? cn(selectedTone.surface, 'shadow-[var(--shadow-panel)]')
                                          : 'border-border/70 text-foreground'
                                      )}
                                      onClick={() => onToggleCandidate(candidate.id)}
                                    >
                                      <Avatar className="ring-background h-11 w-11 shrink-0 ring-2">
                                        <AvatarImage src={candidate.avatar} alt={candidate.name} />
                                        <AvatarFallback className="border-border bg-muted text-foreground border">
                                          {candidate.name.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="min-w-0 flex-1 font-medium break-words">
                                        {candidate.name}
                                      </span>
                                      <SelectionStateIcon
                                        isSelected={isSelected}
                                        reducedMotion={Boolean(reducedMotion)}
                                      />
                                    </Button>
                                  </motion.div>
                                </motion.div>
                              );
                            })
                          : choices?.map(choice => {
                              const isSelected = selectedChoiceId === choice.id;

                              return (
                                <motion.div
                                  key={choice.id}
                                  variants={reducedMotion ? undefined : listItem}
                                >
                                  <motion.div
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
                                        'flex h-auto w-full cursor-pointer items-center justify-start gap-3 rounded-lg border px-5 py-4 text-left font-medium whitespace-normal transition-all duration-200',
                                        'bg-card/90 hover:bg-card hover:border-foreground/20 hover:shadow-[var(--shadow-panel)]',
                                        isSelected
                                          ? cn(selectedTone.surface, 'shadow-[var(--shadow-panel)]')
                                          : 'text-foreground border-border/70'
                                      )}
                                    >
                                      <SelectionStateIcon
                                        isSelected={isSelected}
                                        reducedMotion={Boolean(reducedMotion)}
                                      />
                                      <span className="min-w-0 break-words">{choice.label}</span>
                                    </Button>
                                  </motion.div>
                                </motion.div>
                              );
                            })}
                      </motion.div>

                      {hasChoiceSidebarContent ? (
                        <aside className="space-y-3">
                          <AnimatePresence initial={false}>
                            {hasSelection ? (
                              <motion.div
                                layout={!reducedMotion}
                                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
                                transition={{ duration: 0.18 }}
                                className="border-border/70 bg-card/90 rounded-lg border p-4 shadow-sm"
                              >
                                <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-[0.14em] uppercase">
                                  {labels.yourChoice}
                                </p>
                                {isElection && selectedCandidates.length > 0 ? (
                                  <div className="space-y-2">
                                    {selectedCandidates.map(candidate => (
                                      <motion.div
                                        key={candidate.id}
                                        layout={!reducedMotion}
                                        className="border-border/70 bg-background/70 flex items-center gap-3 rounded-lg border px-3 py-2"
                                      >
                                        <Avatar className="h-8 w-8 shrink-0">
                                          <AvatarImage
                                            src={candidate.avatar}
                                            alt={candidate.name}
                                          />
                                          <AvatarFallback>
                                            {candidate.name.charAt(0).toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                          {candidate.name}
                                        </span>
                                      </motion.div>
                                    ))}
                                  </div>
                                ) : selectedChoice ? (
                                  <div className="border-border/70 bg-background/70 rounded-lg border px-3 py-2 text-sm font-medium">
                                    {selectedChoice.label}
                                  </div>
                                ) : null}
                              </motion.div>
                            ) : null}
                          </AnimatePresence>
                          {forwardingPreviewContent}
                          {documentPreviewContent}
                        </aside>
                      ) : null}
                    </div>
                  </main>
                ) : null}

                {step === 'password' ? (
                  <main className="px-4 py-6 sm:px-6 lg:px-8">
                    <div
                      className={cn(
                        'mx-auto grid w-full max-w-5xl gap-4',
                        documentPreviewContent
                          ? 'lg:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)]'
                          : 'max-w-xl'
                      )}
                    >
                      <motion.div
                        className="border-border/70 bg-card/90 w-full rounded-lg border p-5 shadow-[var(--shadow-panel)] sm:p-6"
                        initial={reducedMotion ? false : { opacity: 0, y: 8, scale: 0.99 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <VotePasswordInput
                          onSubmit={onPasswordSubmit}
                          error={passwordError}
                          noVotingPasswordSettingsHref={noVotingPasswordSettingsHref}
                          isLoading={isPasswordVerifying}
                        />
                      </motion.div>
                      {documentPreviewContent ? (
                        <aside className="space-y-3">{documentPreviewContent}</aside>
                      ) : null}
                    </div>
                  </main>
                ) : null}

                <footer className="border-t bg-[var(--surface-overlay)] px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8">
                  <DialogFooter className="mx-auto w-full max-w-5xl gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <Button variant="outline" className="w-full sm:w-auto" onClick={onCancel}>
                      {labels.cancel}
                    </Button>
                    {step === 'choice' ? (
                      <Button
                        className="w-full sm:w-auto sm:min-w-32"
                        onClick={onConfirm}
                        disabled={isLoading || !hasSelection}
                      >
                        {labels.confirm}
                      </Button>
                    ) : null}
                  </DialogFooter>
                </footer>
              </div>
            </div>
          </div>
        ) : null}

        {submissionOverlay}
      </ScrollableDialogContent>
    </Dialog>
  );
}

function SelectionStateIcon({
  isSelected,
  reducedMotion,
}: {
  isSelected: boolean;
  reducedMotion: boolean;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {isSelected ? (
        <motion.span
          key="selected"
          initial={reducedMotion ? false : { opacity: 0, scale: 0.75 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0, scale: 0.75 }}
          transition={{ duration: 0.16 }}
          className="shrink-0"
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
          className="shrink-0"
        >
          <Circle className="text-muted-foreground/40 h-5 w-5" />
        </motion.span>
      )}
    </AnimatePresence>
  );
}
