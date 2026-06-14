import type { ReactNode } from 'react';

import { Button } from '@/features/shared/ui/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Grid3x3,
  List,
  type LucideIcon,
} from 'lucide-react';

export type CalendarHeaderView = 'list' | 'day' | 'week' | 'month';

export interface CalendarHeaderViewOption<TView extends string = CalendarHeaderView> {
  value: TView;
  label: string;
  Icon?: LucideIcon;
}

const DEFAULT_ICON_BY_VIEW: Partial<Record<CalendarHeaderView, LucideIcon>> = {
  day: List,
  list: List,
  week: Grid3x3,
  month: CalendarIcon,
};

export interface CalendarHeaderPresenterViewProps<TView extends string = CalendarHeaderView> {
  viewMode: TView;
  setViewMode: (mode: TView) => void;
  currentViewTitle: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  actions?: ReactNode;
  title?: ReactNode;
  resolvedViews: CalendarHeaderViewOption<TView>[];
  resolvedTodayLabel: string;
  resolvedPreviousLabel: string;
  resolvedNextLabel: string;
}

export function CalendarHeaderPresenterView<TView extends string = CalendarHeaderView>({
  viewMode,
  setViewMode,
  currentViewTitle,
  onPrevious,
  onNext,
  onToday,
  actions,
  title,
  resolvedViews,
  resolvedTodayLabel,
  resolvedPreviousLabel,
  resolvedNextLabel,
}: CalendarHeaderPresenterViewProps<TView>) {
  return (
    <>
      {(title || actions) && (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {title ? <h1 className="text-3xl font-bold">{title}</h1> : null}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onPrevious}
            aria-label={resolvedPreviousLabel}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={onToday}>
            {resolvedTodayLabel}
          </Button>
          <Button variant="outline" size="icon" onClick={onNext} aria-label={resolvedNextLabel}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="ml-0 text-lg font-semibold sm:ml-2">{currentViewTitle}</h2>
        </div>

        <Tabs value={viewMode} onValueChange={value => setViewMode(value as TView)}>
          <TabsList>
            {resolvedViews.map((view: any) => {
              const Icon =
                view.Icon ?? DEFAULT_ICON_BY_VIEW[view.value as CalendarHeaderView] ?? CalendarIcon;

              return (
                <TabsTrigger key={view.value} value={view.value}>
                  <Icon className="mr-2 h-4 w-4" />
                  {view.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>
    </>
  );
}
