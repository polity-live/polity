'use client';

import { CheckCircle2, Circle, type LucideIcon } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';

import { BadgeControl } from '@/features/shared/ui/status';
import { Progress } from '@/features/shared/ui/ui/progress';
import { Button } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';

export interface SectionProgressTopBarItem {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  completed?: boolean;
  disabled?: boolean;
}

interface SectionProgressTopBarProps {
  items: SectionProgressTopBarItem[];
  activeId: string;
  progressValue: number;
  label?: ReactNode;
  countLabel?: ReactNode;
  onItemSelect?: (id: string) => void;
  sticky?: boolean;
  showDescriptions?: boolean;
  className?: string;
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function SectionProgressTopBar({
  items,
  activeId,
  progressValue,
  label,
  countLabel,
  onItemSelect,
  sticky = false,
  showDescriptions = false,
  className,
}: SectionProgressTopBarProps) {
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({
      block: 'nearest',
      inline: 'center',
      behavior: 'smooth',
    });
  }, [activeId]);

  return (
    <div
      className={cn(
        'bg-background/95 z-20 border-b px-4 py-3 backdrop-blur',
        sticky && 'sticky top-0',
        className
      )}
      data-slot="section-progress-topbar"
    >
      <div className="space-y-3">
        {(label || countLabel) && (
          <div className="flex items-center justify-between gap-3">
            {label ? (
              <BadgeControl variant="outline" size="xs">
                {label}
              </BadgeControl>
            ) : (
              <span />
            )}
            {countLabel && (
              <span className="text-muted-foreground text-xs font-medium">{countLabel}</span>
            )}
          </div>
        )}

        <Progress value={clampProgress(progressValue)} className="h-1.5" />

        <ol className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
          {items.map(item => {
            const Icon = item.icon;
            const isActive = item.id === activeId;
            const isDisabled = item.disabled || !onItemSelect;

            return (
              <li key={item.id} className="flex-none">
                <Button
                  ref={isActive ? activeItemRef : undefined}
                  type="button"
                  variant="ghost"
                  aria-current={isActive ? 'step' : undefined}
                  disabled={isDisabled}
                  tooltip={typeof item.label === 'string' ? item.label : undefined}
                  className={cn(
                    'flex min-w-[7.25rem] items-center gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors',
                    isActive
                      ? 'border-primary bg-primary/5 text-foreground'
                      : item.completed
                        ? 'border-success/30 bg-success/5'
                        : 'bg-card text-muted-foreground',
                    !isDisabled && 'hover:border-primary/40 hover:bg-accent/40',
                    isDisabled && 'cursor-default'
                  )}
                  onClick={() => {
                    if (!isDisabled) {
                      onItemSelect?.(item.id);
                    }
                  }}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 flex-none items-center justify-center rounded-md border',
                      isActive
                        ? 'border-primary bg-primary text-primary-foreground'
                        : item.completed
                          ? 'border-success/40 bg-success/10 text-success'
                          : 'bg-background'
                    )}
                  >
                    {item.completed ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : isActive && Icon ? (
                      <Icon className="h-3.5 w-3.5" />
                    ) : (
                      <Circle className={isActive ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5'} />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{item.label}</span>
                    {showDescriptions && item.description ? (
                      <span className="text-muted-foreground mt-1 line-clamp-2 block text-xs leading-5">
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                </Button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
