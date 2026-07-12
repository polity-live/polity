import type { ComponentProps, ReactNode } from 'react';

import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { cn } from '@/features/shared/utils/utils';

export function AgendaPageShell({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mx-auto w-full max-w-7xl space-y-5 pb-8', className)} {...props} />;
}

export function AgendaSurface({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn(
        'bg-card/70 border-border/70 overflow-hidden rounded-xl border shadow-none',
        className
      )}
      {...props}
    />
  );
}

export function AgendaSectionHeading({
  action,
  description,
  eyebrow,
  title,
}: {
  action?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        {eyebrow ? (
          <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="text-lg leading-tight font-semibold tracking-tight sm:text-xl">{title}</h2>
        {description ? (
          <p className="text-muted-foreground max-w-3xl text-sm">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export const agendaDialogContentClassName = {
  standard:
    'gap-0 overflow-hidden rounded-xl p-0 sm:max-w-xl [&_[data-slot=dialog-header]]:px-5 [&_[data-slot=dialog-header]]:py-4 [&_[data-slot=dialog-footer]]:px-5 [&_[data-slot=dialog-footer]]:py-4',
  wide: 'gap-0 overflow-hidden rounded-xl p-0 sm:max-w-3xl [&_[data-slot=dialog-header]]:px-5 [&_[data-slot=dialog-header]]:py-4 [&_[data-slot=dialog-footer]]:px-5 [&_[data-slot=dialog-footer]]:py-4',
  fullscreen:
    'bg-background !fixed !inset-0 !z-[100] flex h-dvh !h-[100dvh] max-h-none !max-h-[100dvh] w-screen !w-[100dvw] max-w-none !max-w-[100dvw] !translate-x-0 !translate-y-0 flex-col gap-0 !overflow-hidden rounded-none !rounded-none border-0 !border-0 p-0 !p-0 shadow-none',
} as const;

export function AgendaDialogContent({
  className,
  size = 'standard',
  ...props
}: ComponentProps<typeof ScrollableDialogContent> & {
  size?: keyof typeof agendaDialogContentClassName;
}) {
  return (
    <ScrollableDialogContent
      className={cn(agendaDialogContentClassName[size], className)}
      {...props}
    />
  );
}

export function AgendaDialogBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('space-y-4 overflow-y-auto px-5 py-5', className)} {...props} />;
}
