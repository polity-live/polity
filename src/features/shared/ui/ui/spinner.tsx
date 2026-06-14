import { Loader2 } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/features/shared/utils/utils.ts';

function Spinner({ className, ...props }: React.ComponentProps<typeof Loader2>) {
  return (
    <Loader2
      data-slot="spinner"
      aria-hidden="true"
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  );
}

export { Spinner };
