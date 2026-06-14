import * as React from 'react';

import { cn } from '@/features/shared/utils/utils.ts';

function Empty({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty"
      className={cn(
        'text-foreground border-border flex min-h-40 flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-[var(--surface)] p-8 text-center shadow-sm',
        className
      )}
      {...props}
    />
  );
}

function EmptyHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-header"
      className={cn('flex flex-col items-center gap-2', className)}
      {...props}
    />
  );
}

function EmptyIcon({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-icon"
      className={cn(
        'bg-card text-muted-foreground flex size-10 items-center justify-center rounded-md border shadow-sm',
        className
      )}
      {...props}
    />
  );
}

function EmptyTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3 data-slot="empty-title" className={cn('text-sm font-semibold', className)} {...props} />
  );
}

function EmptyDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="empty-description"
      className={cn('text-muted-foreground max-w-sm text-sm', className)}
      {...props}
    />
  );
}

function EmptyContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-content"
      className={cn('flex items-center gap-2', className)}
      {...props}
    />
  );
}

export { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyIcon, EmptyTitle };
