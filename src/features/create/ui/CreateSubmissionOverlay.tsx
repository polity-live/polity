'use client';

import { useEffect, useId, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, Check, type LucideIcon } from 'lucide-react';

import { CREATE_REVIEW_CARD_LAYOUT_ID } from '../logic/createReviewPreview';
import { getCreateSubmitTargetLabel } from '../logic/createSubmitTargets';
import type { CreateSubmitProgressStep, CreateSubmitTarget } from '../types/create-form.types';
import {
  CONTENT_TYPE_CONFIG,
  type ContentType,
} from '@/features/timeline/constants/content-type-config';
import { getContentTypeToneClasses } from '@/features/shared/theme';
import { Button } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';

type CreateSubmissionOverlayStatus = 'idle' | 'submitting' | 'ready' | 'error';

interface CreateSubmissionOverlayProps {
  status: CreateSubmissionOverlayStatus;
  entityType: ContentType;
  title: string;
  target?: CreateSubmitTarget | null;
  error?: unknown;
  progressSteps: CreateSubmitProgressStep[];
  reviewPreview?: ReactNode;
  onNavigate: () => void;
  onBack: () => void;
  onRetry: () => void;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Die Erstellung konnte nicht abgeschlossen werden.';
}

export function CreateSubmissionOverlay({
  status,
  entityType,
  title,
  target,
  error,
  progressSteps,
  reviewPreview,
  onNavigate,
  onBack,
  onRetry,
}: CreateSubmissionOverlayProps) {
  const reducedMotion = useReducedMotion();
  const titleId = useId();
  const descriptionId = useId();
  const tone = getContentTypeToneClasses(entityType);
  const config = CONTENT_TYPE_CONFIG[entityType];
  const Icon = config.icon as LucideIcon;
  const open = status !== 'idle';
  const targetLabel = target?.label ?? getCreateSubmitTargetLabel(entityType);
  const canNavigateToTarget = status === 'ready' || (status === 'error' && Boolean(target));

  useEffect(() => {
    if (canNavigateToTarget) {
      document.querySelector<HTMLButtonElement>('[data-create-submit-target="true"]')?.focus();
    }
  }, [canNavigateToTarget]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="bg-background/88 fixed inset-0 z-50 overflow-y-auto backdrop-blur-md"
          data-slot="create-submission-overlay"
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
                {status === 'ready'
                  ? 'Bereit'
                  : status === 'error'
                    ? 'Unterbrochen'
                    : 'Wird erstellt'}
              </p>
              <h2 id={titleId} className="mt-2 text-2xl leading-tight font-semibold sm:text-3xl">
                POLITY arbeitet.
              </h2>
              <p id={descriptionId} className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {status === 'error'
                  ? getErrorMessage(error)
                  : status === 'ready'
                    ? `${title} ist erstellt und bereit zum Öffnen.`
                    : title}
              </p>
            </div>

            <div className={cn('w-full', status === 'ready' && 'civic-success-settle')}>
              {reviewPreview ?? (
                <motion.div
                  layoutId={CREATE_REVIEW_CARD_LAYOUT_ID}
                  className={cn(
                    'bg-card text-card-foreground rounded-[28px] border p-6 shadow-[var(--shadow-floating)]',
                    tone.border
                  )}
                >
                  <div className="flex flex-col items-center text-center">
                    <div className={cn('mb-4 rounded-2xl border p-3 shadow-sm', tone.badge)}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
                      Review
                    </p>
                    <h3 className="mt-2 text-xl font-semibold tracking-normal">{title}</h3>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="w-full space-y-4">
              <div
                className="grid gap-2 sm:grid-cols-3"
                data-slot="create-submit-steps"
                aria-label="Erstellfortschritt"
              >
                {progressSteps.map((step, index) => {
                  const stepStatus = status === 'ready' ? 'complete' : (step.status ?? 'pending');
                  const isComplete = stepStatus === 'complete';
                  const isActive = stepStatus === 'active';
                  const isError = stepStatus === 'error' || (status === 'error' && isActive);

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
                            isComplete
                              ? tone.badge
                              : 'border-border bg-muted text-muted-foreground',
                            isError && getContentTypeToneClasses('vote').badge
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

              {status === 'error' && target ? (
                <Button
                  type="button"
                  size="lg"
                  onClick={onNavigate}
                  data-create-submit-target="true"
                  className="mx-auto flex w-full max-w-xs"
                >
                  {targetLabel}
                </Button>
              ) : status === 'error' ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" variant="outline" onClick={onBack}>
                    Zurück zum Formular
                  </Button>
                  <Button type="button" onClick={onRetry}>
                    Erneut versuchen
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  disabled={!canNavigateToTarget}
                  onClick={onNavigate}
                  data-create-submit-target="true"
                  className="mx-auto flex w-full max-w-xs"
                  successState={status === 'ready'}
                  successLabel={targetLabel}
                >
                  {targetLabel}
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export type { CreateSubmissionOverlayStatus };
