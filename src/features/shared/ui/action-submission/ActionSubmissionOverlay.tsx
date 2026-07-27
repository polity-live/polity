'use client';

import { useId, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  Calculator,
  Check,
  GitBranch,
  Link2,
  Send,
  ShieldCheck,
  Target,
  UserCheck,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import { LoadingProgressBar } from '@/features/shared/ui/feedback';
import { getContentTypeToneClasses, getSemanticToneClasses } from '@/features/shared/theme';
import { cn } from '@/features/shared/utils/utils';
import {
  translate as translateText,
  useTranslation,
} from '@/features/shared/hooks/use-translation';
import type { LocalizedCopyRef } from '@/features/shared/i18n/localized-copy';
import { localizeAppError, parseAppError } from '@/features/shared/errors';

export type ActionSubmissionKind = 'workflow' | 'link' | 'invite' | 'accept' | 'process' | 'tally';
export type ActionSubmissionStepKey = 'prepare' | 'commit' | 'sync';
export type ActionSubmissionProgressStatus = 'pending' | 'active' | 'complete' | 'error';
export type ActionSubmissionStatus = 'idle' | 'submitting' | 'ready' | 'success' | 'error';

export interface ActionSubmissionStep {
  key: ActionSubmissionStepKey;
  copy: LocalizedCopyRef;
  status: ActionSubmissionProgressStatus;
}

export interface ActionSubmissionPerson {
  id: string;
  name: string;
  avatar?: string | null;
}

export interface ActionSubmissionPreview {
  title: ReactNode;
  description?: ReactNode;
  entityLabel?: ReactNode;
  people?: ActionSubmissionPerson[];
  badges?: ReactNode[];
  path?: ReactNode[];
}

export interface ActionSubmissionTarget {
  label: ReactNode;
  onClick?: () => void;
}

interface ActionSubmissionOverlayProps {
  kind: ActionSubmissionKind;
  status: ActionSubmissionStatus;
  steps: ActionSubmissionStep[];
  preview: ActionSubmissionPreview;
  target?: ActionSubmissionTarget | null;
  error?: unknown;
  onBack: () => void;
  onRetry: () => void;
  className?: string;
}

function getKindCopy(kind: ActionSubmissionKind) {
  const prefix = `common.actionSubmission.kinds.${kind}`;
  return {
    headline: translateText(`${prefix}.headline`),
    active: translateText(`${prefix}.active`),
    success: translateText(`${prefix}.success`),
    description: translateText(`${prefix}.description`),
  };
}

function getIcon(kind: ActionSubmissionKind) {
  if (kind === 'tally') return Calculator;
  if (kind === 'process') return Target;
  if (kind === 'workflow') return GitBranch;
  if (kind === 'link') return Link2;
  if (kind === 'accept') return UserCheck;
  return Send;
}

function getTone(kind: ActionSubmissionKind) {
  if (kind === 'tally') return getContentTypeToneClasses('election');
  if (kind === 'process') return getContentTypeToneClasses('amendment');
  if (kind === 'workflow') return getContentTypeToneClasses('workflow');
  if (kind === 'link') return getSemanticToneClasses('info');
  if (kind === 'accept') return getSemanticToneClasses('success');
  return getSemanticToneClasses('accent');
}

function getErrorDetails(error: unknown) {
  const payload = parseAppError(error);

  if (payload?.code === 'action_blocked') {
    return {
      title: translateText('common.actionSubmission.errors.blockedTitle'),
      description: translateText('common.actionSubmission.errors.blockedDescription'),
      retryLabel: null,
      technicalDetail: null,
    };
  }

  if (payload?.code === 'already_exists') {
    return {
      title: translateText('common.actionSubmission.errors.duplicateTitle'),
      description: translateText('common.actionSubmission.errors.duplicateDescription'),
      retryLabel: null,
      technicalDetail: null,
    };
  }

  if (payload?.code === 'permission_denied') {
    return {
      title: translateText('common.actionSubmission.errors.permissionTitle'),
      description: translateText('common.actionSubmission.errors.permissionDescription'),
      retryLabel: null,
      technicalDetail: null,
    };
  }

  return {
    title: translateText('common.actionSubmission.errors.interruptedTitle'),
    description: localizeAppError(error),
    retryLabel: translateText('common.submissionOverlay.retry'),
    technicalDetail: null,
  };
}

function getStatusText(
  status: ActionSubmissionStatus,
  kind: ActionSubmissionKind,
  errorTitle: string
) {
  const copy = getKindCopy(kind);
  if (status === 'success' || status === 'ready') return copy.success;
  if (status === 'error') return errorTitle;
  return copy.active;
}

export function ActionSubmissionOverlay({
  kind,
  status,
  steps,
  preview,
  target,
  error,
  onBack,
  onRetry,
  className,
}: ActionSubmissionOverlayProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const titleId = useId();
  const descriptionId = useId();
  const open = status !== 'idle';
  const copy = getKindCopy(kind);
  const tone = status === 'error' ? getSemanticToneClasses('danger') : getTone(kind);
  const errorDetails = getErrorDetails(error);
  const Icon = getIcon(kind);
  const canUseTarget = status === 'success' || status === 'ready';
  const displaySteps = steps.map(step => ({
    ...step,
    label: t(step.copy.key, step.copy.params),
    status: canUseTarget ? ('complete' as const) : step.status,
  }));

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={cn(
            'bg-background/92 fixed inset-0 z-[90] overflow-y-auto backdrop-blur-md',
            className
          )}
          data-slot="action-submission-overlay"
          data-kind={kind}
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
            className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col items-center justify-center gap-4 px-4 py-6 sm:gap-5 sm:py-8"
            initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="w-full text-center">
              <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
                {getStatusText(status, kind, errorDetails.title)}
              </p>
              <h2 id={titleId} className="mt-2 text-2xl leading-tight font-semibold sm:text-3xl">
                {copy.headline}
              </h2>
              <p id={descriptionId} className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {status === 'error' ? errorDetails.description : copy.description}
              </p>
            </div>

            <motion.div
              className="bg-card text-card-foreground w-full rounded-[28px] border p-5 shadow-[var(--shadow-floating)] sm:p-6"
              data-slot="action-submission-card"
              animate={
                canUseTarget && !reducedMotion ? { scale: [1, 1.012, 1], y: [0, -2, 0] } : undefined
              }
              transition={{ duration: 0.46, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <div className="flex flex-col items-center text-center">
                <motion.div
                  className={cn('relative mb-4 rounded-2xl border p-4 shadow-sm', tone.badge)}
                  animate={
                    !canUseTarget && status !== 'error' && !reducedMotion
                      ? { y: [0, -3, 0], rotate: [0, -1, 0] }
                      : undefined
                  }
                  transition={{ duration: 1.25, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {canUseTarget ? (
                    <Check className="h-7 w-7" />
                  ) : status === 'error' ? (
                    <AlertTriangle className="h-7 w-7" />
                  ) : (
                    <Icon className="h-7 w-7" />
                  )}
                  {status !== 'error' ? (
                    <span
                      className={cn(
                        'bg-card absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-md border',
                        tone.border
                      )}
                    >
                      <ShieldCheck className={cn('h-3.5 w-3.5', tone.text)} />
                    </span>
                  ) : null}
                </motion.div>

                {preview.entityLabel ? (
                  <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
                    {preview.entityLabel}
                  </p>
                ) : null}
                <h3 className="mt-2 text-xl leading-tight font-semibold tracking-normal">
                  {preview.title}
                </h3>
                {preview.description ? (
                  <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
                    {preview.description}
                  </p>
                ) : null}

                {preview.path?.length ? (
                  <div className="mt-4 flex max-w-2xl flex-wrap items-center justify-center gap-2">
                    {preview.path.map((entry, index) => (
                      <span key={index} className="flex items-center gap-2">
                        {index > 0 ? <span className="text-muted-foreground">→</span> : null}
                        <span className="bg-background/70 rounded-md border px-3 py-1 text-sm">
                          {entry}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : null}

                {preview.people?.length ? (
                  <div className="mt-4 flex max-w-xl flex-wrap justify-center gap-2">
                    {preview.people.slice(0, 8).map(person => (
                      <div
                        key={person.id}
                        className="border-border/70 bg-background/70 flex items-center gap-2 rounded-md border px-2 py-1 text-sm"
                      >
                        <Avatar className="h-7 w-7">
                          {person.avatar ? (
                            <AvatarImage src={person.avatar} alt={person.name} />
                          ) : null}
                          <AvatarFallback>{person.name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="max-w-32 truncate">{person.name}</span>
                      </div>
                    ))}
                    {preview.people.length > 8 ? (
                      <span className="border-border/70 bg-background/70 rounded-md border px-3 py-1 text-sm">
                        +{preview.people.length - 8}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {preview.badges?.length ? (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {preview.badges.map((badge, index) => (
                      <span
                        key={index}
                        className="border-border/70 bg-background/70 rounded-md border px-3 py-1 text-sm"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </motion.div>

            <div
              className="grid w-full gap-2 sm:grid-cols-3"
              data-slot="action-submission-steps"
              aria-label={translateText('common.accessibility.actionProgress')}
            >
              {displaySteps.map((step, index) => {
                const isComplete = step.status === 'complete';
                const isActive = step.status === 'active';
                const isError = step.status === 'error';

                return (
                  <div
                    key={step.key}
                    className={cn(
                      'border-border/70 bg-card/90 relative overflow-hidden rounded-2xl border px-3 py-3 shadow-[var(--shadow-panel)]',
                      isActive && 'border-foreground/20',
                      isComplete && tone.border,
                      isError && 'border-destructive/60'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <motion.span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-xs font-semibold',
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
                            ? translateText('common.submissionOverlay.status.attentionRequired')
                            : isComplete
                              ? translateText('common.submissionOverlay.status.completed')
                              : isActive
                                ? translateText('common.submissionOverlay.status.running')
                                : translateText('common.submissionOverlay.status.waiting')}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <LoadingProgressBar
              ariaLabel={translateText('common.accessibility.actionProgress')}
              steps={displaySteps}
              indicatorClassName={cn(tone.text, 'bg-current')}
            />

            {status === 'error' ? (
              <div className="w-full space-y-3">
                {errorDetails.technicalDetail ? (
                  <details className="text-muted-foreground mx-auto max-w-xl text-xs">
                    <summary className="cursor-pointer text-center font-medium">
                      {translateText('common.submissionOverlay.technicalDetails')}
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
                    {translateText('common.submissionOverlay.back')}
                  </Button>
                  {errorDetails.retryLabel ? (
                    <Button type="button" onClick={onRetry}>
                      {errorDetails.retryLabel}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : target ? (
              <Button
                type="button"
                className="min-w-48"
                disabled={!canUseTarget}
                onClick={target.onClick}
              >
                {target.label}
              </Button>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
