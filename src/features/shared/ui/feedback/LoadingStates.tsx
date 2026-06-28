import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Database, LogOut, RefreshCw, UserRound, Wifi } from 'lucide-react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { Button } from '@/features/shared/ui/ui/button';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import { LoadingProgressBar } from './LoadingProgressBar';

const DEFAULT_RECOVERY_TIMEOUT_MS = 8000;

type LoadingAction = () => void | Promise<void>;

interface AppBootLoadingStateProps {
  title?: ReactNode;
  description?: ReactNode;
  recoveryTitle?: ReactNode;
  recoveryDescription?: ReactNode;
  details?: ReactNode;
  timeoutMs?: number;
  onRetry?: LoadingAction;
  onSignOut?: LoadingAction;
  className?: string;
}

function useDelayedRecovery(timeoutMs: number) {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    setIsSlow(false);
    const timeoutId = window.setTimeout(() => setIsSlow(true), timeoutMs);
    return () => window.clearTimeout(timeoutId);
  }, [timeoutMs]);

  return isSlow;
}

export function AppBootLoadingState({
  title,
  description,
  recoveryTitle,
  recoveryDescription,
  details,
  timeoutMs = DEFAULT_RECOVERY_TIMEOUT_MS,
  onRetry,
  onSignOut,
  className,
}: AppBootLoadingStateProps) {
  const { t } = useTranslation();
  const isSlow = useDelayedRecovery(timeoutMs);
  const steps = useMemo(
    () => [
      { icon: Wifi, label: t('common.loading.appBoot.steps.connecting') },
      { icon: Database, label: t('common.loading.appBoot.steps.localData') },
      { icon: UserRound, label: t('common.loading.appBoot.steps.profile') },
    ],
    [t]
  );

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'bg-background flex min-h-dvh w-full items-center justify-center px-6 py-16',
        className
      )}
      data-slot="app-boot-loading"
    >
      <div className="w-full max-w-xl space-y-7 text-center">
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
            Polity
          </p>
          <h1 className="text-2xl leading-tight font-semibold sm:text-3xl">
            {isSlow
              ? (recoveryTitle ?? t('common.loading.appBoot.recoveryTitle'))
              : (title ?? t('common.loading.appBoot.title'))}
          </h1>
          <p className="text-muted-foreground mx-auto max-w-md text-sm leading-relaxed">
            {isSlow
              ? (recoveryDescription ?? t('common.loading.appBoot.recoveryDescription'))
              : (description ?? t('common.loading.appBoot.description'))}
          </p>
          <LoadingProgressBar
            ariaLabel={t('common.loading.appBoot.label')}
            className="mx-auto max-w-sm"
            motionStyle="optimistic"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-3" aria-label={t('common.loading.appBoot.label')}>
          {steps.map((step, index) => {
            const Icon = step.icon;

            return (
              <div key={step.label} className="border-border bg-card rounded-md border px-3 py-3">
                <div className="flex items-center gap-3 text-left">
                  <span
                    className={cn(
                      'bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full',
                      index === 0 && !isSlow && 'animate-pulse'
                    )}
                  >
                    {isSlow ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
                  </span>
                  <span className="text-sm font-medium">{step.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {isSlow ? (
          <div className="space-y-3">
            <div className="flex flex-wrap justify-center gap-2">
              {onRetry ? (
                <Button type="button" variant="outline" onClick={() => void onRetry()}>
                  <RefreshCw className="size-4" />
                  {t('common.loading.appBoot.retry')}
                </Button>
              ) : null}
              {onSignOut ? (
                <Button type="button" variant="ghost" onClick={() => void onSignOut()}>
                  <LogOut className="size-4" />
                  {t('common.loading.appBoot.signOut')}
                </Button>
              ) : null}
            </div>
            {details ? (
              <p className="text-muted-foreground text-xs">
                {t('common.loading.appBoot.details')}: {details}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface PageSkeletonProps {
  variant?: 'calendar' | 'entity' | 'profile' | 'settings';
  label?: ReactNode;
  className?: string;
}

export function PageSkeleton({ variant = 'entity', label, className }: PageSkeletonProps) {
  if (variant === 'calendar') {
    return <CalendarPageSkeleton label={label} className={className} />;
  }

  if (variant === 'profile') {
    return <ProfilePageSkeleton label={label} className={className} />;
  }

  if (variant === 'settings') {
    return <SettingsPageSkeleton label={label} className={className} />;
  }

  return <EntityPageSkeleton label={label} className={className} />;
}

function CalendarPageSkeleton({ label, className }: Omit<PageSkeletonProps, 'variant'>) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('common.loading.pageSkeleton.calendar');

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn('space-y-5 py-6', className)}
      data-slot="calendar-page-skeleton"
    >
      <span className="sr-only">{resolvedLabel}</span>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_180px]">
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }, (_, index) => (
          <Skeleton key={index} className="aspect-square min-h-16 rounded-md" />
        ))}
      </div>
    </div>
  );
}

export function ProfilePageSkeleton({ label, className }: Omit<PageSkeletonProps, 'variant'>) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('common.loading.pageSkeleton.profile');

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn('space-y-8 py-6', className)}
      data-slot="profile-page-skeleton"
    >
      <span className="sr-only">{resolvedLabel}</span>
      <div className="space-y-3 text-center">
        <Skeleton className="mx-auto h-10 w-64 max-w-[70vw]" />
        <Skeleton className="mx-auto h-4 w-80 max-w-[80vw]" />
      </div>
      <Skeleton className="mx-auto h-56 w-full max-w-4xl rounded-lg" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-20 rounded-md" />
        <Skeleton className="h-20 rounded-md" />
        <Skeleton className="h-20 rounded-md" />
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Skeleton className="h-9 w-32 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <div className="space-y-4">
        <div className="flex gap-2 border-b pb-2">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
        <SectionSkeleton rows={3} />
      </div>
    </div>
  );
}

interface MapPanelSkeletonProps {
  label?: ReactNode;
  className?: string;
  heightClassName?: string;
}

export function MapPanelSkeleton({
  label,
  className,
  heightClassName = 'h-72',
}: MapPanelSkeletonProps) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('common.locationPicker.loading');

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'bg-muted/20 relative overflow-hidden rounded-md border border-dashed',
        heightClassName,
        className
      )}
      data-slot="map-panel-skeleton"
    >
      <span className="sr-only">{resolvedLabel}</span>
      <div className="absolute inset-0 grid grid-cols-4 gap-px opacity-80">
        {Array.from({ length: 16 }, (_, index) => (
          <Skeleton key={index} className="h-full rounded-none" />
        ))}
      </div>
      <div className="bg-border absolute inset-x-6 top-1/2 h-px -translate-y-1/2" />
      <div className="bg-border absolute inset-y-6 left-1/2 w-px -translate-x-1/2" />
      <Skeleton className="absolute top-8 left-8 h-10 w-24 rounded-md" />
      <Skeleton className="absolute right-10 bottom-10 size-10 rounded-full" />
      <Skeleton className="absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full" />
    </div>
  );
}

function EntityPageSkeleton({ label, className }: Omit<PageSkeletonProps, 'variant'>) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('common.loading.pageSkeleton.entity');

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn('space-y-6 py-6', className)}
      data-slot="entity-page-skeleton"
    >
      <span className="sr-only">{resolvedLabel}</span>
      <div className="space-y-3">
        <Skeleton className="h-5 w-32 rounded-full" />
        <Skeleton className="h-10 w-80 max-w-full" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-20 rounded-md" />
        <Skeleton className="h-20 rounded-md" />
        <Skeleton className="h-20 rounded-md" />
      </div>
      <SectionSkeleton rows={4} />
    </div>
  );
}

function SettingsPageSkeleton({ label, className }: Omit<PageSkeletonProps, 'variant'>) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('common.loading.pageSkeleton.settings');

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn('space-y-5 py-6', className)}
      data-slot="settings-page-skeleton"
    >
      <span className="sr-only">{resolvedLabel}</span>
      <div className="space-y-3">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-2">
          <Skeleton className="h-9 rounded-md" />
          <Skeleton className="h-9 rounded-md" />
          <Skeleton className="h-9 rounded-md" />
        </div>
        <SectionSkeleton rows={5} />
      </div>
    </div>
  );
}

interface SectionSkeletonProps {
  rows?: number;
  label?: ReactNode;
  className?: string;
  density?: 'compact' | 'default';
}

export function SectionSkeleton({
  rows = 3,
  label,
  className,
  density = 'default',
}: SectionSkeletonProps) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('common.loading.sectionSkeleton.label');
  const isCompact = density === 'compact';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn('space-y-3', className)}
      data-slot="section-skeleton"
    >
      <span className="sr-only">{resolvedLabel}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className={cn('border-border bg-card rounded-md border', isCompact ? 'p-3' : 'p-4')}
        >
          <div className="flex items-start gap-3">
            <Skeleton className={cn('shrink-0 rounded-full', isCompact ? 'size-8' : 'size-10')} />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface InlineLoadingTextProps {
  label?: ReactNode;
  className?: string;
}

export function InlineLoadingText({ label, className }: InlineLoadingTextProps) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn('text-muted-foreground flex items-center gap-2 text-sm', className)}
      data-slot="inline-loading-text"
    >
      <span className="inline-block size-2 rounded-full bg-current opacity-70" aria-hidden="true" />
      <span>{label ?? t('common.loading.general')}</span>
    </div>
  );
}
