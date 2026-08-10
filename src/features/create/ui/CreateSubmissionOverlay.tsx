'use client';

import { useEffect, useId, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, Check, type LucideIcon } from 'lucide-react';

import { CREATE_REVIEW_CARD_LAYOUT_ID } from '../logic/createReviewPreview';
import { getCreateSubmitTargetLabelKey } from '../logic/createSubmitTargets';
import type { CreateSubmitProgressStep, CreateSubmitTarget } from '../types/create-form.types';
import {
  CONTENT_TYPE_CONFIG,
  type ContentType,
} from '@/features/timeline/constants/content-type-config';
import { getContentTypeToneClasses } from '@/features/shared/theme';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { LoadingProgressBar } from '@/features/shared/ui/feedback';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink';
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
  onBack: () => void;
  onRetry: () => void;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function serializeRouteParams(target: CreateSubmitTarget | null | undefined) {
  if (!target || target.kind !== 'route') return undefined;
  return JSON.stringify(target.params ?? {});
}

function routeHref(target: Extract<CreateSubmitTarget, { kind: 'route' }>) {
  const concretePath = Object.entries(target.params ?? {}).reduce(
    (path, [key, value]) =>
      path
        .replaceAll(`$${key}`, encodeURIComponent(value))
        .replaceAll(`{${key}}`, encodeURIComponent(value)),
    target.to
  );
  const params = new URLSearchParams();
  if (target.search && typeof target.search === 'object') {
    for (const [key, value] of Object.entries(target.search as Record<string, unknown>)) {
      if (value !== undefined && value !== null) params.set(key, String(value));
    }
  }
  const query = params.toString();
  const hash = target.hash ? `#${encodeURIComponent(target.hash)}` : '';
  return `${concretePath}${query ? `?${query}` : ''}${hash}`;
}

function targetHref(target: CreateSubmitTarget | null | undefined) {
  if (!target) return undefined;
  return target.kind === 'route' ? routeHref(target) : target.href;
}

function renderTargetLink(
  target: CreateSubmitTarget,
  href: string,
  content: ReactNode,
  actionId: string
) {
  if (target.kind === 'route') {
    return (
      <SmartLink href={href} data-action-id={actionId}>
        {content}
      </SmartLink>
    );
  }

  return (
    <a href={href} data-action-id={actionId}>
      {content}
    </a>
  );
}

export function CreateSubmissionOverlay({
  status,
  entityType,
  title,
  target,
  error,
  progressSteps,
  reviewPreview,
  onBack,
  onRetry,
}: CreateSubmissionOverlayProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const titleId = useId();
  const descriptionId = useId();
  const tone = getContentTypeToneClasses(entityType);
  const config = CONTENT_TYPE_CONFIG[entityType];
  const Icon = config.icon as LucideIcon;
  const open = status !== 'idle';
  const targetLabel =
    target?.label ?? t(target?.labelKey ?? getCreateSubmitTargetLabelKey(entityType));
  const canNavigateToTarget = Boolean(target) && (status === 'ready' || status === 'error');
  const href = targetHref(target);
  const targetButtonContent =
    status === 'ready' && canNavigateToTarget ? (
      <>
        <Check className="h-4 w-4" />
        <span>{targetLabel}</span>
      </>
    ) : (
      targetLabel
    );
  const displayProgressSteps = progressSteps.map(step => ({
    ...step,
    status:
      status === 'ready'
        ? 'complete'
        : status === 'error' && step.status === 'active'
          ? 'error'
          : (step.status ?? 'pending'),
  }));

  useEffect(() => {
    if (canNavigateToTarget) {
      document.querySelector<HTMLElement>('[data-create-submit-target="true"]')?.focus();
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
                  ? t('pages.create.progress.submission.overlay.ready')
                  : status === 'error'
                    ? t('pages.create.progress.submission.overlay.interrupted')
                    : t('pages.create.progress.submission.overlay.creating')}
              </p>
              <h2 id={titleId} className="mt-2 text-2xl leading-tight font-semibold sm:text-3xl">
                {t('pages.create.progress.submission.overlay.title')}
              </h2>
              <p id={descriptionId} className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {status === 'error'
                  ? getErrorMessage(
                      error,
                      t('pages.create.progress.submission.overlay.defaultError')
                    )
                  : status === 'ready'
                    ? t('pages.create.progress.submission.overlay.readyDescription', { title })
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
                      {t('pages.create.common.review')}
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
                aria-label={t('pages.create.progress.submission.overlay.progressLabel')}
              >
                {displayProgressSteps.map((step, index) => {
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
                        isError && getContentTypeToneClasses('vote').border
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <motion.span
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-xs font-semibold',
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
                              ? t('pages.create.progress.submission.overlay.reviewNeeded')
                              : isComplete
                                ? t('pages.create.progress.submission.overlay.completed')
                                : isActive
                                  ? t('pages.create.progress.submission.overlay.running')
                                  : t('pages.create.progress.submission.overlay.waiting')}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <LoadingProgressBar
                ariaLabel={t('pages.create.progress.submission.overlay.progressLabel')}
                steps={displayProgressSteps}
                indicatorClassName={cn(tone.text, 'bg-current')}
              />

              {status === 'error' && target ? (
                <Button
                  data-action-id="create.submission.target.open-error"
                  type="button"
                  size="lg"
                  asChild={Boolean(href)}
                  data-create-submit-target="true"
                  data-create-action="navigate-created-target"
                  data-create-target-kind={target?.kind}
                  data-create-target-to={target?.kind === 'route' ? target.to : target?.href}
                  data-create-target-params={serializeRouteParams(target)}
                  className="mx-auto flex w-full max-w-xs"
                >
                  {href && target
                    ? renderTargetLink(
                        target,
                        href,
                        targetButtonContent,
                        'create.submission.target.open-error'
                      )
                    : targetButtonContent}
                </Button>
              ) : status === 'error' ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    data-action-id="create.submission.back"
                    type="button"
                    variant="outline"
                    onClick={onBack}
                    data-create-action="back-to-form"
                  >
                    {t('pages.create.progress.submission.overlay.backToForm')}
                  </Button>
                  <Button
                    data-action-id="create.submission.retry"
                    type="button"
                    onClick={onRetry}
                    data-create-action="retry-submit"
                  >
                    {t('pages.create.progress.submission.overlay.retry')}
                  </Button>
                </div>
              ) : (
                <Button
                  data-action-id="create.submission.target.open-ready"
                  type="button"
                  size="lg"
                  disabled={!canNavigateToTarget}
                  asChild={canNavigateToTarget && Boolean(href)}
                  data-create-submit-target="true"
                  data-create-action="navigate-created-target"
                  data-create-target-kind={target?.kind}
                  data-create-target-to={target?.kind === 'route' ? target.to : target?.href}
                  data-create-target-params={serializeRouteParams(target)}
                  className="mx-auto flex w-full max-w-xs"
                  successState={status === 'ready'}
                  successLabel={targetLabel}
                >
                  {canNavigateToTarget && href && target
                    ? renderTargetLink(
                        target,
                        href,
                        targetButtonContent,
                        'create.submission.target.open-ready'
                      )
                    : targetButtonContent}
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
