import type { CSSProperties, ReactNode } from 'react';

import { Button, type ButtonProps } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';

export const WEEK_VIEW_GRID_TEMPLATE_COLUMNS = '4.5rem repeat(7, minmax(10rem, 1fr))';
export const WEEK_VIEW_GRID_MIN_WIDTH = '74.5rem';

const WEEK_VIEW_EVENT_COLUMN_GAP_PX = 6;

interface WeekViewBlockStyleOptions {
  column: number;
  columnCount: number;
  top: number;
  height: number;
  columnGap?: number;
}

export function getWeekViewBlockStyle({
  column,
  columnCount,
  top,
  height,
  columnGap = WEEK_VIEW_EVENT_COLUMN_GAP_PX,
}: WeekViewBlockStyleOptions): CSSProperties {
  const widthPercent = 100 / columnCount;

  return {
    top: `${top}px`,
    height: `${height}px`,
    width: `calc(${widthPercent}% - ${columnGap}px)`,
    left: `calc(${widthPercent * column}% + ${columnGap / 2}px)`,
  };
}

type WeekViewDayHeaderButtonProps = Omit<
  ButtonProps,
  'children' | 'onClick' | 'size' | 'variant'
> & {
  date: Date;
  locale: string;
  isSelected?: boolean;
  isToday?: boolean;
  onDateSelect: (date: Date) => void;
};

export function WeekViewDayHeaderButton({
  date,
  locale,
  isSelected,
  isToday,
  onDateSelect,
  className,
  ...props
}: WeekViewDayHeaderButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-pressed={isSelected}
      className={cn(
        'sticky top-0 z-30 h-auto rounded-none border-b px-2 py-3 text-center backdrop-blur transition-colors',
        isSelected
          ? 'bg-accent/80'
          : isToday
            ? 'border-primary/30 bg-primary/10'
            : 'bg-background/95 hover:bg-accent/40',
        className
      )}
      onClick={() => onDateSelect(date)}
      {...props}
    >
      <span className="flex flex-col">
        <span className="text-muted-foreground text-xs font-medium">
          {date.toLocaleDateString(locale, { weekday: 'short' })}
        </span>
        <span className={cn('text-lg font-semibold', (isToday || isSelected) && 'text-primary')}>
          {date.getDate()}
        </span>
      </span>
    </Button>
  );
}

type WeekViewBlockButtonTone = 'event' | 'card';

type WeekViewBlockButtonProps = Omit<ButtonProps, 'size' | 'variant'> & {
  tone?: WeekViewBlockButtonTone;
  children: ReactNode;
};

const weekViewBlockButtonToneClasses: Record<WeekViewBlockButtonTone, string> = {
  event: 'transition-all hover:ring-2 hover:ring-primary/20',
  card: 'bg-card transition-colors hover:bg-accent',
};

export function WeekViewBlockButton({
  tone = 'event',
  className,
  children,
  ...props
}: WeekViewBlockButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        'absolute z-20 block h-auto overflow-hidden rounded-md border p-1.5 text-left text-xs whitespace-normal shadow-sm',
        weekViewBlockButtonToneClasses[tone],
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
}
