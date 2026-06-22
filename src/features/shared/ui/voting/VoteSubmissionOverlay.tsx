'use client';

import { useId, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, Check, ShieldCheck, Vote } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import { getContentTypeToneClasses, getSemanticToneClasses } from '@/features/shared/theme';
import { cn } from '@/features/shared/utils/utils';
import type { VotingPhaseValue } from './VotingControls';

export type VoteSubmissionStepKey = 'verify' | 'cast' | 'sync';
export type VoteSubmissionProgressStatus = 'pending' | 'active' | 'complete' | 'error';
export type VoteSubmissionStatus =
  | 'idle'
  | 'verifying'
  | 'casting'
  | 'syncing'
  | 'success'
  | 'error';

export interface VoteSubmissionProgressStep {
  key: VoteSubmissionStepKey;
  label: ReactNode;
  status: VoteSubmissionProgressStatus;
}

export interface VoteSubmissionContext {
  reportProgress: (stepKey: VoteSubmissionStepKey, status: VoteSubmissionProgressStatus) => void;
}

export interface VoteSubmissionCandidate {
  id: string;
  name: string;
  avatar?: string;
}

export interface VoteSubmissionSelection {
  type: 'vote' | 'election';
  title?: ReactNode;
  phase: VotingPhaseValue;
  choiceLabel?: ReactNode;
  candidates?: VoteSubmissionCandidate[];
  maxVotes?: number;
}

interface VoteSubmissionOverlayProps {
  status: VoteSubmissionStatus;
  selection: VoteSubmissionSelection;
  progressSteps: VoteSubmissionProgressStep[];
  error?: unknown;
  onBack: () => void;
  onRetry: () => void;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Die Stimmabgabe konnte nicht abgeschlossen werden.';
}

function getErrorDetails(error: unknown) {
  const message = getErrorMessage(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes('duplicate key') ||
    normalized.includes('unique constraint') ||
    normalized.includes('already voted') ||
    normalized.includes('already exists') ||
    normalized.includes('bereits abgegeben') ||
    normalized.includes('schon vorhanden')
  ) {
    return {
      title: 'Stimme bereits vorhanden',
      description:
        'Für diese Abstimmung liegt bereits eine Stimme von dir vor. Polity zählt keine doppelte Abgabe.',
      backLabel: 'Zurück zur Abstimmung',
      retryLabel: null,
      tone: 'warning' as const,
      technicalDetail: null,
    };
  }

  if (
    normalized.includes('permission') ||
    normalized.includes('not allowed') ||
    normalized.includes('not eligible') ||
    normalized.includes('stimmrecht') ||
    normalized.includes('active_voting')
  ) {
    return {
      title: 'Stimmrecht nicht bestätigt',
      description:
        'Deine Stimme wurde nicht gezählt, weil dein Stimmrecht für diese Abstimmung nicht bestätigt werden konnte.',
      backLabel: 'Zurück zur Abstimmung',
      retryLabel: null,
      tone: 'danger' as const,
      technicalDetail: null,
    };
  }

  if (
    normalized.includes('password') ||
    normalized.includes('pin') ||
    normalized.includes('verify') ||
    normalized.includes('verification')
  ) {
    return {
      title: 'PIN nicht bestätigt',
      description: 'Die Stimmabgabe wurde nicht ausgeführt. Gib deine Voting-PIN erneut ein.',
      backLabel: 'PIN erneut eingeben',
      retryLabel: null,
      tone: 'danger' as const,
      technicalDetail: null,
    };
  }

  return {
    title: 'Prüfung unterbrochen',
    description:
      'Die Stimmabgabe wurde nicht bestätigt. Du kannst zur Eingabe zurück oder es erneut versuchen.',
    backLabel: 'Zurück zur Eingabe',
    retryLabel: 'Erneut versuchen',
    tone: 'danger' as const,
    technicalDetail: message,
  };
}

function getStatusText(
  status: VoteSubmissionStatus,
  errorDetails: ReturnType<typeof getErrorDetails>
) {
  if (status === 'success') return 'Stimme abgegeben';
  if (status === 'error') return errorDetails.title;
  return 'Stimmabgabe läuft';
}

function getDescription(
  status: VoteSubmissionStatus,
  selection: VoteSubmissionSelection,
  errorDetails: ReturnType<typeof getErrorDetails>
) {
  if (status === 'success') return 'Deine Auswahl wurde gezählt und synchronisiert.';
  if (status === 'error') return errorDetails.description;

  return selection.type === 'election'
    ? 'Deine Kandidatenauswahl wird geprüft, versiegelt und synchronisiert.'
    : 'Deine Auswahl wird geprüft, versiegelt und synchronisiert.';
}

export function VoteSubmissionOverlay({
  status,
  selection,
  progressSteps,
  error,
  onBack,
  onRetry,
}: VoteSubmissionOverlayProps) {
  const reducedMotion = useReducedMotion();
  const titleId = useId();
  const descriptionId = useId();
  const open = status !== 'idle';
  const errorDetails = getErrorDetails(error);
  const tone =
    status === 'error'
      ? getSemanticToneClasses(errorDetails.tone)
      : getContentTypeToneClasses('vote');
  const selectedCandidates = selection.candidates ?? [];

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="bg-background/90 fixed inset-0 z-[80] overflow-y-auto backdrop-blur-md"
          data-slot="vote-submission-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.18 }}
        >
          <motion.div
            className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center gap-4 px-4 py-6 sm:py-8"
            initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="w-full text-center">
              <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
                {getStatusText(status, errorDetails)}
              </p>
              <h2 id={titleId} className="mt-2 text-2xl leading-tight font-semibold sm:text-3xl">
                POLITY zählt.
              </h2>
              <p id={descriptionId} className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {getDescription(status, selection, errorDetails)}
              </p>
            </div>

            <motion.div
              className="bg-card text-card-foreground w-full rounded-[28px] border p-5 shadow-[var(--shadow-floating)] sm:p-6"
              data-slot="vote-submission-card"
              animate={
                status === 'success' && !reducedMotion
                  ? { scale: [1, 1.012, 1], y: [0, -2, 0] }
                  : undefined
              }
              transition={{ duration: 0.46, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <div className="flex flex-col items-center text-center">
                <motion.div
                  className={cn('relative mb-4 rounded-2xl border p-4 shadow-sm', tone.badge)}
                  animate={
                    status !== 'success' && status !== 'error' && !reducedMotion
                      ? { y: [0, -3, 0], rotate: [0, -1, 0] }
                      : undefined
                  }
                  transition={{ duration: 1.25, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {status === 'success' ? (
                    <Check className="h-7 w-7" />
                  ) : status === 'error' ? (
                    <AlertTriangle className="h-7 w-7" />
                  ) : (
                    <Vote className="h-7 w-7" />
                  )}
                  {status !== 'error' ? (
                    <span
                      className={cn(
                        'bg-card absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full border',
                        tone.border
                      )}
                    >
                      <ShieldCheck className={cn('h-3.5 w-3.5', tone.text)} />
                    </span>
                  ) : null}
                </motion.div>

                <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
                  Auswahl
                </p>
                {selection.title ? (
                  <h3 className="mt-2 text-xl leading-tight font-semibold tracking-normal">
                    {selection.title}
                  </h3>
                ) : null}

                <div className="mt-4 w-full max-w-xl">
                  {selection.type === 'election' ? (
                    <div className="space-y-2">
                      {selectedCandidates.map(candidate => (
                        <div
                          key={candidate.id}
                          className="border-border/70 bg-background/70 flex items-center gap-3 rounded-2xl border px-3 py-2 text-left"
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={candidate.avatar} alt={candidate.name} />
                            <AvatarFallback>
                              {candidate.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {candidate.name}
                          </span>
                        </div>
                      ))}
                      {selection.maxVotes ? (
                        <p className="text-muted-foreground text-xs">
                          {selectedCandidates.length}/{selection.maxVotes} Stimmen ausgewählt
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="border-border/70 bg-background/70 rounded-2xl border px-4 py-3 text-sm font-medium">
                      {selection.choiceLabel}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            <div
              className="grid w-full gap-2 sm:grid-cols-3"
              data-slot="vote-submit-steps"
              aria-label="Stimmabgabefortschritt"
            >
              {progressSteps.map((step, index) => {
                const isComplete = step.status === 'complete' || status === 'success';
                const isActive = step.status === 'active';
                const isError = step.status === 'error' || (status === 'error' && isActive);

                return (
                  <div
                    key={step.key}
                    className={cn(
                      'border-border/70 bg-card/90 relative overflow-hidden rounded-2xl border px-3 py-3 shadow-[var(--shadow-panel)]',
                      isActive && 'border-foreground/20',
                      isComplete && tone.border,
                      isError && getContentTypeToneClasses('vote').border
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <motion.span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                          isComplete ? tone.badge : 'border-border bg-muted text-muted-foreground',
                          isError && 'border-destructive/60 bg-destructive/10 text-destructive'
                        )}
                        animate={
                          isActive && !reducedMotion
                            ? { scale: [1, 1.05, 1], y: [0, -1, 0] }
                            : undefined
                        }
                        transition={
                          isActive && !reducedMotion
                            ? { duration: 1.15, repeat: Infinity, ease: 'easeInOut' }
                            : undefined
                        }
                      >
                        {isError ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : isComplete ? (
                          <Check className="h-4 w-4" />
                        ) : isActive ? (
                          <span
                            className={cn('h-2.5 w-2.5 rounded-full', tone.text, 'bg-current')}
                          />
                        ) : (
                          index + 1
                        )}
                      </motion.span>

                      <div className="min-w-0 text-left">
                        <p className="truncate text-sm font-medium">{step.label}</p>
                        <p className="text-muted-foreground text-xs">
                          {isError
                            ? 'Prüfung nötig'
                            : isComplete
                              ? 'Abgeschlossen'
                              : isActive
                                ? 'Läuft'
                                : 'Wartet'}
                        </p>
                      </div>
                    </div>

                    {isActive ? (
                      <div className="bg-muted mt-3 h-1 overflow-hidden rounded-full">
                        <motion.div
                          className={cn('h-full rounded-full', tone.text, 'bg-current')}
                          initial={reducedMotion ? false : { width: '18%' }}
                          animate={
                            reducedMotion ? { width: '52%' } : { width: ['18%', '68%', '38%'] }
                          }
                          transition={
                            reducedMotion
                              ? { duration: 0 }
                              : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {status === 'error' ? (
              <div className="w-full space-y-3">
                {errorDetails.technicalDetail ? (
                  <details className="text-muted-foreground mx-auto max-w-xl text-xs">
                    <summary className="cursor-pointer text-center font-medium">
                      Technische Details
                    </summary>
                    <p className="bg-card mt-2 rounded-md border px-3 py-2">
                      {errorDetails.technicalDetail}
                    </p>
                  </details>
                ) : null}
                <div
                  className={cn(
                    'grid gap-2',
                    errorDetails.retryLabel ? 'sm:grid-cols-2' : 'mx-auto max-w-xs'
                  )}
                >
                  <Button type="button" variant="outline" onClick={onBack}>
                    {errorDetails.backLabel}
                  </Button>
                  {errorDetails.retryLabel ? (
                    <Button type="button" onClick={onRetry}>
                      {errorDetails.retryLabel}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
