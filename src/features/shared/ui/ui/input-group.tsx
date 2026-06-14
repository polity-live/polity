import * as React from 'react';

import { cn } from '@/features/shared/utils/utils.ts';

function InputGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        'border-input bg-background focus-within:border-ring focus-within:ring-ring/50 has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:ring-destructive/20 dark:bg-input/30 dark:has-[[aria-invalid=true]]:ring-destructive/40 flex min-h-9 w-full items-center rounded-md border px-3 shadow-xs transition-[color,box-shadow] focus-within:ring-[3px]',
        className
      )}
      {...props}
    />
  );
}

function InputGroupAddon({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-group-addon"
      className={cn(
        'text-muted-foreground flex shrink-0 items-center gap-2 text-sm [&_svg:not([class*="size-"])]:size-4',
        className
      )}
      {...props}
    />
  );
}

function InputGroupInput({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      data-slot="input-group-input"
      className={cn(
        'placeholder:text-muted-foreground flex h-8 min-w-0 flex-1 bg-transparent px-2 text-base outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className
      )}
      {...props}
    />
  );
}

export { InputGroup, InputGroupAddon, InputGroupInput };
