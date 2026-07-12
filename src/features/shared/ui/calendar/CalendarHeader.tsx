import type { ReactNode } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Calendar as CalendarIcon, Grid3x3, List, type LucideIcon } from 'lucide-react';

export type CalendarHeaderView = 'list' | 'day' | 'week' | 'month';
export type CalendarHeadingMode = 'visible' | 'sr-only' | 'none';

export interface CalendarHeaderViewOption<TView extends string = CalendarHeaderView> {
  value: TView;
  label: string;
  Icon?: LucideIcon;
}

export interface CalendarHeaderProps<TView extends string = CalendarHeaderView> {
  viewMode: TView;
  setViewMode: (mode: TView) => void;
  currentViewTitle: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  actions?: ReactNode;
  title?: ReactNode;
  headingMode?: CalendarHeadingMode;
  todayLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
  views?: CalendarHeaderViewOption<TView>[];
}
function useDefaultCalendarViews(): CalendarHeaderViewOption[] {
  const { t } = useTranslation();

  return [
    { value: 'list', label: t('features.calendar.views.list'), Icon: List },
    { value: 'week', label: t('features.calendar.views.week'), Icon: Grid3x3 },
    { value: 'month', label: t('features.calendar.views.month'), Icon: CalendarIcon },
  ];
}
import { CalendarHeaderPresenterView } from './CalendarHeaderPresenterView';

export function CalendarHeader<TView extends string = CalendarHeaderView>({
  viewMode,
  setViewMode,
  currentViewTitle,
  onPrevious,
  onNext,
  onToday,
  actions,
  title,
  headingMode = 'visible',
  todayLabel,
  previousLabel,
  nextLabel,
  views,
}: CalendarHeaderProps<TView>) {
  const { t } = useTranslation();
  const defaultViews = useDefaultCalendarViews() as CalendarHeaderViewOption<TView>[];
  const resolvedViews = views ?? defaultViews;
  const resolvedTodayLabel = todayLabel ?? t('features.calendar.today');
  const resolvedPreviousLabel =
    previousLabel ?? t('features.calendar.navigation.previous', 'Previous period');
  const resolvedNextLabel = nextLabel ?? t('features.calendar.navigation.next', 'Next period');
  return (
    <CalendarHeaderPresenterView
      viewMode={viewMode}
      setViewMode={setViewMode}
      currentViewTitle={currentViewTitle}
      onPrevious={onPrevious}
      onNext={onNext}
      onToday={onToday}
      actions={actions}
      title={title}
      headingMode={headingMode}
      resolvedViews={resolvedViews}
      resolvedTodayLabel={resolvedTodayLabel}
      resolvedPreviousLabel={resolvedPreviousLabel}
      resolvedNextLabel={resolvedNextLabel}
    />
  );
}
