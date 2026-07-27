'use client';

import { BadgeControl } from '@/features/shared/ui/status';
import { ReactNode } from 'react';
import { cn } from '@/features/shared/utils/utils.ts';

interface TimelineItemProps {
  order: number;
  startTime: string;
  endTime: string;
  duration: number;
  children: ReactNode;
  className?: string;
}

export function TimelineItem({
  order,
  startTime,
  endTime,
  duration,
  children,
  className,
}: TimelineItemProps) {
  return (
    <div className={cn('relative flex min-w-0 gap-2 sm:gap-3', className)}>
      {/* Time Column */}
      <div className="relative flex w-14 flex-shrink-0 flex-col items-center pt-3 sm:w-16">
        <div className="border-background bg-primary h-2.5 w-2.5 rounded-full border-2" />
        <div className="bg-muted mt-1.5 mb-1.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold">
          {order}
        </div>
        <div className="mt-1 text-center">
          <div className="text-xs leading-none font-semibold">{startTime}</div>
          <div className="text-muted-foreground mt-1 text-[11px] leading-none">{endTime}</div>
          <BadgeControl variant="outline" size="tiny" className="mt-1.5 px-1.5 py-0 leading-4">
            {duration}m
          </BadgeControl>
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
