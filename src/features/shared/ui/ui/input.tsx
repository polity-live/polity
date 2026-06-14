import * as React from 'react';

import { cn } from '@/features/shared/utils/utils.ts';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        data-slot="input"
        className={cn(
          'border-input selection:bg-primary selection:text-primary-foreground file:text-foreground placeholder:text-muted-foreground dark:bg-input/30 bg-card flex h-[var(--field-height)] w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-sm transition-[color,background-color,border-color,box-shadow] duration-[var(--motion-duration-base)] ease-[var(--motion-ease-standard)] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          'focus-visible:border-ring focus-visible:ring-ring/45 focus-visible:ring-[3px]',
          'aria-invalid:border-[var(--badge-danger-border)] aria-invalid:ring-[var(--badge-danger-border)]',
          'data-[valid=true]:border-[var(--badge-success-border)]',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
