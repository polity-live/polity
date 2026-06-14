import type { ReactNode } from 'react';

import { cn } from '@/features/shared/utils/utils';

interface PageShellProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function PageShell({ children, className, contentClassName }: PageShellProps) {
  return (
    <main className={cn('bg-background text-foreground min-h-dvh', className)}>
      <div
        className={cn(
          'mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8',
          contentClassName
        )}
      >
        {children}
      </div>
    </main>
  );
}

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}
    >
      <div className="min-w-0 space-y-2">
        {eyebrow ? (
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {eyebrow}
          </p>
        ) : null}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">{title}</h1>
          {description ? (
            <p className="text-muted-foreground max-w-3xl text-sm sm:text-base">{description}</p>
          ) : null}
        </div>
        {children}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

interface SectionProps {
  children: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

export function Section({
  children,
  title,
  description,
  actions,
  className,
  headerClassName,
  contentClassName,
}: SectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      {title || description || actions ? (
        <div
          className={cn(
            'flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between',
            headerClassName
          )}
        >
          <div className="space-y-1">
            {title ? <h2 className="text-lg font-semibold">{title}</h2> : null}
            {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={contentClassName}>{children}</div>
    </section>
  );
}

function PanelGrid({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="panel-grid"
      className={cn('grid gap-4 md:grid-cols-2 xl:grid-cols-3', className)}
      {...props}
    />
  );
}

function ActionToolbar({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="action-toolbar"
      className={cn('flex flex-wrap items-center gap-2', className)}
      {...props}
    />
  );
}

export { ActionToolbar, PanelGrid };
