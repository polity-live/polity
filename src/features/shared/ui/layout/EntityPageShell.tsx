import type { ReactNode } from 'react';

import { getEntityToneClasses, type PrimaryEntityTone } from '@/features/shared/theme';
import { cn } from '@/features/shared/utils/utils';

export interface EntityPageShellStat {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
}

export interface EntityPageShellProps {
  entityType: PrimaryEntityTone;
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  media?: ReactNode;
  actions?: ReactNode;
  badges?: ReactNode;
  stats?: EntityPageShellStat[];
  metadata?: ReactNode;
  tabs?: ReactNode;
  feedback?: ReactNode;
  children?: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

export function EntityPageShell({
  entityType,
  title,
  description,
  eyebrow,
  media,
  actions,
  badges,
  stats,
  metadata,
  tabs,
  feedback,
  children,
  className,
  headerClassName,
  contentClassName,
}: EntityPageShellProps) {
  const tone = getEntityToneClasses(entityType);

  return (
    <section className={cn('space-y-6', className)}>
      <header
        data-slot="entity-page-shell-header"
        className={cn(
          'bg-card overflow-hidden rounded-lg border shadow-[var(--shadow-panel)]',
          tone.headerAccent,
          headerClassName
        )}
      >
        <div className={cn('grid gap-0 lg:grid-cols-[minmax(0,1fr)_18rem]', tone.gradient)}>
          <div className="flex min-w-0 flex-col gap-5 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                {eyebrow ? (
                  <p className={cn('text-xs font-semibold tracking-wide uppercase', tone.text)}>
                    {eyebrow}
                  </p>
                ) : null}
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">{title}</h1>
                  {description ? (
                    <p className="text-muted-foreground max-w-3xl text-sm sm:text-base">
                      {description}
                    </p>
                  ) : null}
                </div>
              </div>
              {actions ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
              ) : null}
            </div>

            {badges || metadata ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {badges}
                {metadata ? <div className="text-muted-foreground">{metadata}</div> : null}
              </div>
            ) : null}

            {stats?.length ? (
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat, index) => (
                  <div
                    key={index}
                    className="border-border/70 rounded-md border bg-[var(--surface-overlay)] px-3 py-2 shadow-sm backdrop-blur-sm"
                  >
                    <dt className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      {stat.label}
                    </dt>
                    <dd className="mt-1 flex items-baseline gap-1 text-xl font-semibold">
                      <span>{stat.value}</span>
                      {stat.unit ? (
                        <span className="text-muted-foreground text-xs font-medium">
                          {stat.unit}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          {media ? (
            <div className="border-border/70 min-h-48 border-t bg-[var(--surface)] lg:border-t-0 lg:border-l">
              {media}
            </div>
          ) : null}
        </div>

        {tabs ? <div className="bg-card border-t px-5 py-3 sm:px-6">{tabs}</div> : null}
      </header>

      {feedback}

      {children ? <div className={cn('space-y-6', contentClassName)}>{children}</div> : null}
    </section>
  );
}
