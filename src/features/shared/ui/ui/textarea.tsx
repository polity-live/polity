import * as React from 'react';

import { cn } from '@/features/shared/utils/utils.ts';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'border-input bg-card ring-offset-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/45 flex min-h-[80px] w-full rounded-md border px-3 py-2 text-base shadow-sm transition-[color,background-color,border-color,box-shadow] duration-[var(--motion-duration-base)] ease-[var(--motion-ease-standard)] focus-visible:ring-[3px] focus-visible:ring-offset-0 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-[var(--badge-danger-border)] aria-invalid:ring-[var(--badge-danger-border)] md:text-sm',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
