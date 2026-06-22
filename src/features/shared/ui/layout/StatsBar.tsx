import type { ReactNode, RefObject } from 'react';

import { cn } from '@/features/shared/utils/utils';

export interface StatsBarItem {
  value: number | string;
  label: ReactNode;
  unit?: ReactNode;
  show?: boolean;
}

interface StatsBarProps {
  items?: StatsBarItem[];
  className?: string;
  itemClassName?: string;
  showAnimation?: boolean;
  animationText?: string;
  animationRef?: RefObject<HTMLDivElement | null>;
  animationTargetLabel?: string;
}

export function StatsBar({
  items,
  className,
  itemClassName,
  showAnimation,
  animationText,
  animationRef,
  animationTargetLabel = 'Subscribers',
}: StatsBarProps) {
  const resolvedItems = items ?? [];

  const visibleItems = resolvedItems.filter(item => item.show !== false);

  return (
    <div className={cn('mb-6', className)}>
      <div className="flex flex-wrap items-center justify-center gap-3 text-center sm:gap-4">
        {visibleItems.map((item, index) => {
          const labelText = typeof item.label === 'string' ? item.label : undefined;
          const shouldAnimate = showAnimation && labelText === animationTargetLabel;

          return (
            <div
              key={index}
              className={cn(
                'bg-card relative min-w-24 rounded-md border px-4 py-3 shadow-sm',
                itemClassName
              )}
            >
              <div className={cn('text-2xl font-semibold', shouldAnimate && 'animate-flash-green')}>
                {item.value}
                {item.unit}
              </div>
              <div className="text-muted-foreground text-sm">{item.label}</div>
              {shouldAnimate ? (
                <div
                  ref={animationRef}
                  className={cn(
                    'animate-fly-up absolute inset-x-0 top-0 text-2xl font-bold opacity-0',
                    animationText?.includes('-') ? 'text-red-500' : 'text-green-500'
                  )}
                >
                  {animationText}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const StatsStrip = StatsBar;

export type { StatsBarProps };
