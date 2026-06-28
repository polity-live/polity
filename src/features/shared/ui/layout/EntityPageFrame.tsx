import type { ReactNode } from 'react';

import { cn } from '@/features/shared/utils/utils';

interface EntityPageFrameProps {
  children: ReactNode;
  className?: string;
}

export function EntityPageFrame({ children, className }: EntityPageFrameProps) {
  return <div className={cn('mx-auto w-full max-w-7xl px-4 py-6', className)}>{children}</div>;
}
