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
  const itemCount = visibleItems.length;
  const mobileColumnCount =
    itemCount <= 1 ? 1 : itemCount === 2 || itemCount === 4 || itemCount === 6 ? 2 : 3;

  return (
    <div className={cn('mb-6', className)}>
      <div
        data-mobile-columns={mobileColumnCount}
        className={cn(
          'grid w-full items-stretch justify-center gap-2 text-center sm:flex sm:flex-wrap sm:items-center sm:gap-4',
          mobileColumnCount === 1 && 'grid-cols-1 justify-items-center',
          mobileColumnCount === 2 && 'grid-cols-2',
          mobileColumnCount === 3 && 'grid-cols-6'
        )}
      >
        {visibleItems.map((item, index) => {
          const labelText = typeof item.label === 'string' ? item.label : undefined;
          const shouldAnimate = showAnimation && labelText === animationTargetLabel;

          return (
            <div
              key={index}
              className={cn(
                'bg-card relative flex min-w-0 flex-col justify-center rounded-md border px-1.5 py-2 shadow-sm sm:block sm:min-w-24 sm:px-4 sm:py-3',
                mobileColumnCount === 1 && 'w-auto min-w-24',
                mobileColumnCount === 3 && 'col-span-2',
                itemCount === 5 && index === 3 && 'col-start-2',
                itemClassName
              )}
            >
              <div
                className={cn(
                  'text-xl leading-none font-semibold sm:text-2xl sm:leading-normal',
                  shouldAnimate && 'animate-flash-green'
                )}
              >
                {item.value}
                {item.unit}
              </div>
              <div className="text-muted-foreground mt-1 text-[0.6rem] leading-tight [overflow-wrap:anywhere] hyphens-auto sm:mt-0 sm:text-sm sm:leading-normal">
                {item.label}
              </div>
              {shouldAnimate ? (
                <div
                  ref={animationRef}
                  className={cn(
                    'animate-fly-up absolute inset-x-0 top-0 text-xl font-bold opacity-0 sm:text-2xl',
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
