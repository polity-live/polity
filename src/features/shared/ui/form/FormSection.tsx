import type { ReactNode } from 'react';

import { cn } from '@/features/shared/utils/utils';

interface FormSectionProps {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

export function FormSection({
  title,
  description,
  children,
  action,
  className,
  headerClassName,
  contentClassName,
}: FormSectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      {title || description || action ? (
        <div
          className={cn(
            'flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between',
            headerClassName
          )}
        >
          <div className="space-y-1">
            {title ? <h3 className="text-base font-semibold">{title}</h3> : null}
            {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn('space-y-4', contentClassName)}>{children}</div>
    </section>
  );
}
