import type { ReactNode } from 'react';

import { cn } from '@/features/shared/utils/utils';

export interface ActionBarProps {
  children: ReactNode;
  className?: string;
}

export interface ResponsiveActionLabelProps {
  full: ReactNode;
  compact?: ReactNode;
}

export const compactActionButtonClassName =
  'h-8 gap-1 px-2 text-xs has-[>svg]:px-2 sm:h-9 sm:gap-2 sm:px-4 sm:text-sm sm:has-[>svg]:px-3';

export function ResponsiveActionLabel({ full, compact }: ResponsiveActionLabelProps) {
  if (compact == null) return <>{full}</>;

  return (
    <>
      <span className="sm:hidden">{compact}</span>
      <span className="hidden sm:inline">{full}</span>
    </>
  );
}

/**
 * Reusable action bar component for displaying action buttons
 * Typically placed below the stats bar on entity pages
 */
export function ActionBar({ children, className }: ActionBarProps) {
  return (
    <div className={cn('mb-4 flex flex-wrap justify-center gap-1.5 sm:mb-6 sm:gap-2', className)}>
      {children}
    </div>
  );
}
