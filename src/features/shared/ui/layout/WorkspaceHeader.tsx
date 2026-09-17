import type { ReactNode } from 'react';
import { cn } from '@/features/shared/utils/utils';

export function WorkspaceHeader({
  title,
  description,
  context,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  context?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header
      data-slot="workspace-header"
      className={cn('border-border/60 space-y-3 border-b pb-4', className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          {context ? <div className="text-muted-foreground text-xs">{context}</div> : null}
          <h1 className="font-sans text-xl leading-snug font-semibold tracking-tight sm:text-2xl">
            {title}
          </h1>
          {description ? (
            <p className="text-muted-foreground max-w-3xl text-sm">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </header>
  );
}
