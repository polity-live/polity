import { CollectionViewToggle } from '@/features/shared/ui/collections/CollectionViewToggle';
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
export type CalendarHeadingMode = 'visible' | 'sr-only' | 'none';

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
  search?: ReactNode;
  title?: ReactNode;
  headingMode?: CalendarHeadingMode;
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
  search,
  title,
  headingMode = 'visible',
  resolvedViews,
  resolvedTodayLabel,
  resolvedPreviousLabel,
  resolvedNextLabel,
}: CalendarHeaderPresenterViewProps<TView>) {
  if (search) {
    const previousPeriod = onPrevious;
    const currentPeriod = onToday;
    const nextPeriod = onNext;
    return (
      <div className="mb-3 space-y-2" data-slot="calendar-controls">
        {title ? <h1 className="sr-only">{title}</h1> : null}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="min-w-0 flex-1">{search}</div>
            <CollectionViewToggle
              value={viewMode === 'list' ? 'cards' : viewMode === 'compact' ? 'compact' : null}
              onChange={next => setViewMode((next === 'cards' ? 'list' : 'compact') as TView)}
            >
              {resolvedViews
                .filter(view => !['list', 'compact'].includes(view.value))
                .map(view => {
                  const Icon =
                    view.Icon ??
                    DEFAULT_ICON_BY_VIEW[view.value as CalendarHeaderView] ??
                    CalendarIcon;
                  return (
                    <Button
                      key={view.value}
                      variant={viewMode === view.value ? 'secondary' : 'ghost'}
                      size="icon"
                      className="rounded-none border-0"
                      aria-label={view.label}
                      title={view.label}
                      aria-pressed={viewMode === view.value}
                      onClick={() => setViewMode(view.value)}
                      data-action-id="calendar.toolbar.view"
                    >
                      <Icon className="size-4" />
                    </Button>
                  );
                })}
            </CollectionViewToggle>
          </div>
          <div className="flex shrink-0 items-center gap-2" data-slot="calendar-actions">
            {actions}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={previousPeriod}
            data-action-id="calendar.toolbar.previous"
            aria-label={resolvedPreviousLabel}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={currentPeriod}
            data-action-id="calendar.toolbar.today"
          >
            {resolvedTodayLabel}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={nextPeriod}
            aria-label={resolvedNextLabel}
            data-action-id="calendar.toolbar.next"
          >
            <ChevronRight className="size-4" />
          </Button>
          <h2 className="ml-2 font-sans text-sm font-medium">{currentViewTitle}</h2>
        </div>
      </div>
    );
  }
  return (
    <>
      {title && headingMode !== 'none' ? (
        <h1 className={headingMode === 'sr-only' ? 'sr-only' : 'mb-4 text-3xl font-bold'}>
          {title}
        </h1>
      ) : null}

      <div
        data-slot="calendar-controls"
        className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
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

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <Tabs value={viewMode} onValueChange={value => setViewMode(value as TView)}>
            <TabsList className="scrollbar-hide max-w-full justify-start overflow-x-auto">
              {resolvedViews.map((view: any) => {
                const Icon =
                  view.Icon ??
                  DEFAULT_ICON_BY_VIEW[view.value as CalendarHeaderView] ??
                  CalendarIcon;

                return (
                  <TabsTrigger key={view.value} value={view.value} className="shrink-0">
                    <Icon className="mr-2 h-4 w-4" />
                    {view.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
          {actions ? (
            <div
              data-slot="calendar-actions"
              className="flex shrink-0 flex-wrap items-center gap-2"
            >
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
