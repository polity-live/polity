import * as React from 'react';

import { cn } from '@/features/shared/utils/utils.ts';

function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'bg-muted text-muted-foreground pointer-events-none inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 font-mono text-[0.6875rem] font-medium select-none',
        className
      )}
      {...props}
    />
  );
}

export { Kbd };
