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
    <div className={cn('relative flex gap-4', className)}>
      {/* Time Column */}
      <div className="relative flex w-24 flex-shrink-0 flex-col items-center pt-4">
        <div className="border-background bg-primary h-3 w-3 rounded-full border-2" />
        <div className="bg-muted mt-2 mb-2 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold">
          {order}
        </div>
        <div className="mt-2 text-center">
          <div className="text-sm font-semibold">{startTime}</div>
          <div className="text-muted-foreground mt-1 text-xs">{endTime}</div>
          <BadgeControl variant="outline" className="mt-2 text-xs">
            {duration}m
          </BadgeControl>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">{children}</div>
    </div>
  );
}
