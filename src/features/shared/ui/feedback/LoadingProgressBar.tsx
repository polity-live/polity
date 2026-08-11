'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

import { cn } from '@/features/shared/utils/utils';
import { TooltipHint } from '@/features/shared/ui/ui/tooltip';

export type LoadingProgressBarStepStatus = 'pending' | 'active' | 'complete' | 'error';

export interface LoadingProgressBarStep {
  key: string;
  label?: ReactNode;
  status?: LoadingProgressBarStepStatus;
}

const OPTIMISTIC_PROGRESS_START = 12;
const OPTIMISTIC_PROGRESS_CAP = 92;
const OPTIMISTIC_PROGRESS_SPEED_MS = 1800;
const OPTIMISTIC_REDUCED_MOTION_PROGRESS = 62;
const OPTIMISTIC_PROGRESS_MAX = OPTIMISTIC_PROGRESS_CAP - 0.1;

interface LoadingProgressBarProps {
  value?: number | null;
  steps?: LoadingProgressBarStep[];
  motionStyle?: 'sweep' | 'optimistic';
  ariaLabel?: string;
  className?: string;
  indicatorClassName?: string;
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function getAsymptoticProgress(elapsedMs: number) {
  const rawProgress =
    OPTIMISTIC_PROGRESS_CAP -
    (OPTIMISTIC_PROGRESS_CAP - OPTIMISTIC_PROGRESS_START) *
      Math.exp(-elapsedMs / OPTIMISTIC_PROGRESS_SPEED_MS);

  return Math.min(OPTIMISTIC_PROGRESS_MAX, Math.max(OPTIMISTIC_PROGRESS_START, rawProgress));
}

function useAsymptoticProgress(enabled: boolean) {
  const [progress, setProgress] = useState(OPTIMISTIC_PROGRESS_START);
  const frameRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setProgress(OPTIMISTIC_PROGRESS_START);
      return undefined;
    }

    startedAtRef.current = null;
    setProgress(OPTIMISTIC_PROGRESS_START);

    const updateProgress = (timestamp: number) => {
      startedAtRef.current ??= timestamp;
      setProgress(getAsymptoticProgress(timestamp - startedAtRef.current));
      frameRef.current = window.requestAnimationFrame(updateProgress);
    };

    frameRef.current = window.requestAnimationFrame(updateProgress);

    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      startedAtRef.current = null;
    };
  }, [enabled]);

  return progress;
}

function getMode(value: number | null | undefined, steps: LoadingProgressBarStep[] | undefined) {
  if (typeof value === 'number') return 'determinate';
  if (steps?.length) return 'steps';
  return 'indeterminate';
}

function getRootA11yProps({
  ariaLabel,
  mode,
  value,
}: {
  ariaLabel?: string;
  mode: ReturnType<typeof getMode>;
  value?: number | null;
}) {
  if (!ariaLabel) {
    return { 'aria-hidden': true as const };
  }

  const props: Record<string, string | number> = {
    role: 'progressbar',
    'aria-label': ariaLabel,
  };

  if (mode === 'determinate' && typeof value === 'number') {
    props['aria-valuemin'] = 0;
    props['aria-valuemax'] = 100;
    props['aria-valuenow'] = clampProgress(value);
  }

  return props;
}

function MovingIndicator({
  indicatorClassName,
  reducedMotion,
}: {
  indicatorClassName?: string;
  reducedMotion: boolean;
}) {
  if (reducedMotion) {
    return (
      <div
        data-slot="loading-progress-reduced-indicator"
        className={cn('bg-primary h-full w-1/2 rounded-full', indicatorClassName)}
      />
    );
  }

  return (
    <motion.div
      data-slot="loading-progress-active-indicator"
      className={cn('bg-primary h-full w-1/2 rounded-full', indicatorClassName)}
      initial={{ opacity: 0, x: '-125%' }}
      animate={{ opacity: [0, 1, 1, 0], x: ['-125%', '-25%', '125%', '250%'] }}
      transition={{ duration: 1.7, repeat: Infinity, ease: 'linear' }}
    />
  );
}

function OptimisticIndicator({
  indicatorClassName,
  reducedMotion,
}: {
  indicatorClassName?: string;
  reducedMotion: boolean;
}) {
  const progress = useAsymptoticProgress(!reducedMotion);

  if (reducedMotion) {
    return (
      <div
        data-slot="loading-progress-optimistic-indicator"
        data-reduced-motion="true"
        className={cn(
          'bg-primary relative h-full overflow-hidden rounded-full',
          indicatorClassName
        )}
        style={{ width: `${OPTIMISTIC_REDUCED_MOTION_PROGRESS}%` }}
      />
    );
  }

  return (
    <div
      data-slot="loading-progress-optimistic-indicator"
      className={cn('bg-primary relative h-full overflow-hidden rounded-full', indicatorClassName)}
      style={{ width: `${progress}%` }}
    >
      <motion.span
        aria-hidden="true"
        data-slot="loading-progress-optimistic-sheen"
        className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent"
        initial={{ opacity: 0, x: '-120%' }}
        animate={{ opacity: [0, 0.85, 0.85, 0], x: ['-120%', '15%', '170%', '230%'] }}
        transition={{
          delay: 1.1,
          duration: 2.8,
          repeat: Infinity,
          repeatDelay: 0.9,
          ease: 'easeOut',
        }}
      />
    </div>
  );
}

export function LoadingProgressBar({
  value,
  steps,
  motionStyle = 'sweep',
  ariaLabel,
  className,
  indicatorClassName,
}: LoadingProgressBarProps) {
  const reducedMotion = Boolean(useReducedMotion());
  const mode = getMode(value, steps);
  const resolvedValue = typeof value === 'number' ? clampProgress(value) : null;
  const rootA11yProps = getRootA11yProps({ ariaLabel, mode, value });

  if (mode === 'determinate') {
    return (
      <div
        {...rootA11yProps}
        data-mode="determinate"
        data-slot="loading-progress-bar"
        className={cn('bg-muted h-1.5 w-full overflow-hidden rounded-full', className)}
      >
        <div
          data-slot="loading-progress-indicator"
          className={cn('bg-primary h-full rounded-full transition-[width]', indicatorClassName)}
          style={{ width: `${resolvedValue}%` }}
        />
      </div>
    );
  }

  if (mode === 'steps') {
    return (
      <div
        {...rootA11yProps}
        data-mode="steps"
        data-slot="loading-progress-bar"
        className={cn('flex h-1.5 w-full gap-1', className)}
      >
        {steps?.map(step => {
          const status = step.status ?? 'pending';
          const isComplete = status === 'complete';
          const isActive = status === 'active';
          const isError = status === 'error';
          const tooltip = typeof step.label === 'string' ? step.label : undefined;

          const progressStep = (
            <div
              key={step.key}
              data-slot="loading-progress-step"
              data-status={status}
              className={cn(
                'bg-muted min-w-0 flex-1 overflow-hidden rounded-full',
                isError && 'bg-destructive/15'
              )}
            >
              {isComplete ? (
                <div
                  data-slot="loading-progress-step-fill"
                  className={cn('bg-primary h-full w-full rounded-full', indicatorClassName)}
                />
              ) : isError ? (
                <div
                  data-slot="loading-progress-step-error"
                  className="bg-destructive h-full w-full rounded-full"
                />
              ) : isActive ? (
                <MovingIndicator
                  indicatorClassName={indicatorClassName}
                  reducedMotion={reducedMotion}
                />
              ) : null}
            </div>
          );

          return tooltip ? (
            <TooltipHint key={step.key} content={tooltip}>
              {progressStep}
            </TooltipHint>
          ) : (
            progressStep
          );
        })}
      </div>
    );
  }

  return (
    <div
      {...rootA11yProps}
      data-mode="indeterminate"
      data-motion-style={motionStyle}
      data-slot="loading-progress-bar"
      className={cn('bg-muted h-1.5 w-full overflow-hidden rounded-full', className)}
    >
      {motionStyle === 'optimistic' ? (
        <OptimisticIndicator
          indicatorClassName={indicatorClassName}
          reducedMotion={reducedMotion}
        />
      ) : (
        <MovingIndicator indicatorClassName={indicatorClassName} reducedMotion={reducedMotion} />
      )}
    </div>
  );
}
