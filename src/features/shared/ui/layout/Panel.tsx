import * as React from 'react';

import { cn } from '@/features/shared/utils/utils';

function Panel({ className, ...props }: React.ComponentProps<'section'>) {
  return (
    <section
      data-slot="panel"
      className={cn('bg-card text-card-foreground rounded-lg border shadow-xs', className)}
      {...props}
    />
  );
}

function PanelHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="panel-header"
      className={cn('flex flex-col gap-1.5 p-4 sm:p-5', className)}
      {...props}
    />
  );
}

function PanelTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return (
    <h2
      data-slot="panel-title"
      className={cn('text-base leading-none font-semibold', className)}
      {...props}
    />
  );
}

function PanelDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="panel-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

function PanelContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="panel-content"
      className={cn('p-4 pt-0 sm:p-5 sm:pt-0', className)}
      {...props}
    />
  );
}

export { Panel, PanelContent, PanelDescription, PanelHeader, PanelTitle };
