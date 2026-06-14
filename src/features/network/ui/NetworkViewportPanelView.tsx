import type { ReactNode, RefObject } from 'react';

import { cn } from '@/features/shared/utils/utils';

interface NetworkViewportPanelViewProps {
  children: ReactNode;
  className?: string;
  containerRef: RefObject<HTMLDivElement | null>;
  height: number | null;
}

export function NetworkViewportPanelView({
  children,
  className,
  containerRef,
  height,
}: NetworkViewportPanelViewProps) {
  return (
    <div
      ref={containerRef}
      className={cn('min-h-[24rem] min-w-0', className)}
      style={height ? { height: `${height}px` } : undefined}
    >
      {children}
    </div>
  );
}
