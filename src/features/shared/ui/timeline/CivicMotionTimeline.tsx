'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/features/shared/utils/utils.ts';

export type CivicMotionTimelineTone =
  | 'neutral'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger';

export interface CivicMotionTimelineItem {
  description?: ReactNode;
  icon?: LucideIcon;
  id: string;
  isActive?: boolean;
  isComplete?: boolean;
  label: string;
  tone?: CivicMotionTimelineTone;
  value?: ReactNode;
}

interface CivicMotionTimelineProps {
  activeIndex?: number;
  ariaLabel?: string;
  branchLabel?: string;
  branches?: CivicMotionTimelineItem[];
  className?: string;
  compact?: boolean;
  items: CivicMotionTimelineItem[];
}

function getBoundedActiveIndex(items: CivicMotionTimelineItem[], activeIndex?: number) {
  if (items.length === 0) {
    return 0;
  }

  const explicitIndex =
    typeof activeIndex === 'number' ? activeIndex : items.findIndex(item => item.isActive);

  if (explicitIndex >= 0) {
    return Math.min(explicitIndex, items.length - 1);
  }

  const lastCompleteIndex = items.reduce(
    (lastIndex, item, index) => (item.isComplete ? index : lastIndex),
    -1
  );

  return Math.max(lastCompleteIndex, 0);
}

function getNodeCenterPositionPercent(index: number, itemCount: number) {
  if (itemCount <= 0) {
    return 50;
  }

  return ((index + 0.5) / itemCount) * 100;
}

function formatPositionPercent(position: number) {
  const normalizedPosition = Math.floor(position * 1000) / 1000;
  return `${Number(normalizedPosition.toFixed(3))}%`;
}

export function CivicMotionTimeline({
  activeIndex,
  ariaLabel,
  branchLabel,
  branches = [],
  className,
  compact = false,
  items,
}: CivicMotionTimelineProps) {
  if (items.length === 0) {
    return null;
  }

  const boundedActiveIndex = getBoundedActiveIndex(items, activeIndex);
  const startLeft = formatPositionPercent(getNodeCenterPositionPercent(0, items.length));
  const currentLeft = formatPositionPercent(
    getNodeCenterPositionPercent(boundedActiveIndex, items.length)
  );
  const endLeft = formatPositionPercent(
    getNodeCenterPositionPercent(items.length - 1, items.length)
  );
  const timelineStyle = {
    '--civic-motion-timeline-current-left': currentLeft,
    '--civic-motion-timeline-end-left': endLeft,
    '--civic-motion-timeline-start-left': startLeft,
  } as CSSProperties;
  const gridStyle = {
    gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
  } as CSSProperties;

  return (
    <div
      aria-label={ariaLabel}
      className={cn('civic-motion-timeline', compact && 'civic-motion-timeline-compact', className)}
      role={ariaLabel ? 'group' : undefined}
      style={timelineStyle}
    >
      <div className="civic-motion-timeline-main">
        {items.length > 1 ? (
          <>
            <div className="civic-motion-timeline-rail" aria-hidden="true" />
            <span className="civic-motion-timeline-marker" aria-hidden="true" />
          </>
        ) : null}

        <div className="civic-motion-timeline-items" role="list" style={gridStyle}>
          {items.map((item, index) => {
            const isActive = index === boundedActiveIndex || item.isActive;
            const Icon = item.icon;

            return (
              <div
                className={cn(
                  'civic-motion-timeline-item',
                  item.isComplete && 'civic-motion-timeline-item-complete',
                  isActive && 'civic-motion-timeline-item-active'
                )}
                data-tone={item.tone ?? 'neutral'}
                key={item.id}
                role="listitem"
              >
                <span className="civic-motion-timeline-dot" aria-hidden="true">
                  {Icon ? <Icon /> : null}
                </span>
                <div className="civic-motion-timeline-copy">
                  <p className="civic-motion-timeline-label">{item.label}</p>
                  {item.value ? (
                    <div className="civic-motion-timeline-value">{item.value}</div>
                  ) : null}
                  {item.description ? (
                    <div className="civic-motion-timeline-description">{item.description}</div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {branches.length > 0 ? (
        <div className="civic-motion-timeline-branches" role="list">
          {branchLabel ? <p className="civic-motion-timeline-branch-label">{branchLabel}</p> : null}
          {branches.map(branch => {
            const BranchIcon = branch.icon;

            return (
              <div
                className={cn(
                  'civic-motion-timeline-branch',
                  branch.isActive && 'civic-motion-timeline-branch-active'
                )}
                data-tone={branch.tone ?? 'neutral'}
                key={branch.id}
                role="listitem"
              >
                <span className="civic-motion-timeline-branch-dot" aria-hidden="true">
                  {BranchIcon ? <BranchIcon /> : null}
                </span>
                <div className="min-w-0">
                  <p className="civic-motion-timeline-label">{branch.label}</p>
                  {branch.value ? (
                    <div className="civic-motion-timeline-value">{branch.value}</div>
                  ) : null}
                  {branch.description ? (
                    <div className="civic-motion-timeline-description">{branch.description}</div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
