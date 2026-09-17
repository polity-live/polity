import type { ReactNode } from 'react';

import { cn } from '@/features/shared/utils/utils';
import { WorkspaceHeader } from '@/features/shared/ui/layout/WorkspaceHeader';

interface CreateFlowFrameProps {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  isCarouselLayout: boolean;
  settingsAligned?: boolean;
}

export function CreateFlowFrame({
  title,
  action,
  children,
  isCarouselLayout,
  settingsAligned = false,
}: CreateFlowFrameProps) {
  return (
    <section
      className={cn(
        'mx-auto w-full px-4 py-4 sm:px-5 lg:px-6',
        settingsAligned ? 'max-w-4xl' : 'max-w-3xl',
        isCarouselLayout ? 'flex min-h-0 flex-1 flex-col' : 'space-y-5 sm:py-6'
      )}
      data-testid="create-flow-frame"
    >
      <WorkspaceHeader title={title} actions={action} className="shrink-0" />

      <div className={cn('min-w-0', isCarouselLayout ? 'flex min-h-0 flex-1 flex-col pt-4' : '')}>
        {children}
      </div>
    </section>
  );
}
