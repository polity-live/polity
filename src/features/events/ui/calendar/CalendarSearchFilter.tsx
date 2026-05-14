import type { ReactNode } from 'react';
import { Input } from '@/features/shared/ui/ui/input';
import { Button } from '@/features/shared/ui/ui/button';
import { Search, X } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface CalendarSearchFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dateFilter: string;
  onDateFilterChange: (date: string) => void;
  middleFilter?: ReactNode;
}

export function CalendarSearchFilter({
  searchQuery,
  onSearchChange,
  dateFilter,
  onDateFilterChange,
  middleFilter,
}: CalendarSearchFilterProps) {
  const { t } = useTranslation();

  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={t('features.calendar.search.placeholder')}
          className="pr-9 pl-9"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
            onClick={() => onSearchChange('')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {middleFilter && <div className="w-full lg:w-80 lg:shrink-0">{middleFilter}</div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:shrink-0">
        <Input
          type="date"
          value={dateFilter}
          onChange={e => onDateFilterChange(e.target.value)}
          className="w-full sm:w-44"
        />
        {dateFilter && (
          <Button variant="ghost" size="sm" onClick={() => onDateFilterChange('')}>
            <X className="mr-1 h-3.5 w-3.5" />
            {t('features.calendar.search.clearDate')}
          </Button>
        )}
      </div>
    </div>
  );
}
