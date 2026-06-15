import type { ReactNode } from 'react';

import { cn } from '@/features/shared/utils/utils';

interface CreateFlowFrameProps {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  isCarouselLayout: boolean;
}

export function CreateFlowFrame({
  title,
  action,
  children,
  isCarouselLayout,
}: CreateFlowFrameProps) {
  return (
    <section
      className={cn(
        'mx-auto w-full max-w-6xl px-4 py-4 sm:px-5 lg:px-6',
        isCarouselLayout ? 'flex min-h-0 flex-1 flex-col' : 'space-y-5 sm:py-6'
      )}
      data-testid="create-flow-frame"
    >
      <header className="flex shrink-0 flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl leading-tight font-bold tracking-tight sm:text-3xl">
            {title}
          </h1>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>

      <div className={cn('min-w-0', isCarouselLayout ? 'flex min-h-0 flex-1 flex-col pt-4' : '')}>
        {children}
      </div>
    </section>
  );
}
