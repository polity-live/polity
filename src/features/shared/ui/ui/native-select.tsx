import * as React from 'react';
import { ChevronDownIcon } from 'lucide-react';

import { cn } from '@/features/shared/utils/utils.ts';

function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div data-slot="native-select-wrapper" className="relative">
      <select
        data-slot="native-select"
        className={cn(
          'border-input bg-card focus-visible:border-ring focus-visible:ring-ring/45 dark:bg-input/30 flex h-[var(--field-height)] w-full appearance-none rounded-md border px-3 py-1 pr-9 text-base shadow-sm transition-[color,background-color,border-color,box-shadow] duration-[var(--motion-duration-base)] ease-[var(--motion-ease-standard)] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-[var(--badge-danger-border)] aria-invalid:ring-[var(--badge-danger-border)] md:text-sm',
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 opacity-50" />
    </div>
  );
}

export { NativeSelect };
