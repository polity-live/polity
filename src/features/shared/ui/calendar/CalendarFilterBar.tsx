import type { ReactNode } from 'react';

import { FormControlInput } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Search, X } from 'lucide-react';

export interface CalendarFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dateFilter: string;
  onDateFilterChange: (date: string) => void;
  middleFilter?: ReactNode;
  searchPlaceholder?: string;
  clearDateLabel?: string;
  clearSearchLabel?: string;
}

export function CalendarFilterBar({
  searchQuery,
  onSearchChange,
  dateFilter,
  onDateFilterChange,
  middleFilter,
  searchPlaceholder,
  clearDateLabel,
  clearSearchLabel,
}: CalendarFilterBarProps) {
  const { t } = useTranslation();
  const resolvedClearSearchLabel =
    clearSearchLabel ?? t('features.calendar.search.clearSearch', 'Clear search');

  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <FormControlInput
          value={searchQuery}
          onChange={event => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder ?? t('features.calendar.search.placeholder')}
          className="pr-9 pl-9"
        />
        {searchQuery ? (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
            onClick={() => onSearchChange('')}
            aria-label={resolvedClearSearchLabel}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
      {middleFilter ? <div className="w-full lg:w-80 lg:shrink-0">{middleFilter}</div> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:shrink-0">
        <FormControlInput
          type="date"
          value={dateFilter}
          onChange={event => onDateFilterChange(event.target.value)}
          className="w-full sm:w-44"
        />
        {dateFilter ? (
          <Button variant="ghost" size="sm" onClick={() => onDateFilterChange('')}>
            <X className="mr-1 h-3.5 w-3.5" />
            {clearDateLabel ?? t('features.calendar.search.clearDate')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
