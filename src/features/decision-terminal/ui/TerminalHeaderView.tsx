import { featureThemeClassName } from '@/features/shared/theme';
import { FormControlInput } from '@/features/shared/ui/form';
import { cn } from '@/features/shared/utils/utils';
import { Button } from '@/features/shared/ui/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu';
import { Search, Settings, SlidersHorizontal, Eye } from 'lucide-react';

import type { TerminalFilter, VisibilityFilter } from './TerminalHeader';

interface TerminalHeaderViewProps {
  activeFilter: TerminalFilter;
  onFilterChange: (filter: TerminalFilter) => void;
  onVisibilityFilterChange: (filter: VisibilityFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  urgentCount: number;
  activeCount: number;
  className?: string;
  showSearch: boolean;
  filters: { value: TerminalFilter; label: string }[];
  visibilityLabel: string;
  labels: {
    title: string;
    urgent: string;
    active: string;
    all: string;
    public: string;
    authenticated: string;
    private: string;
    searchPlaceholder: string;
    density: string;
    refreshRate: string;
    soundAlerts: string;
  };
  onShowSearch: () => void;
  onSearchBlur: () => void;
}

export function TerminalHeaderView({
  activeFilter,
  onFilterChange,
  onVisibilityFilterChange,
  searchQuery,
  onSearchChange,
  urgentCount,
  activeCount,
  className,
  showSearch,
  filters,
  visibilityLabel,
  labels,
  onShowSearch,
  onSearchBlur,
}: TerminalHeaderViewProps) {
  return (
    <div
      className={cn(
        featureThemeClassName('decisionterminalTerminalHeaderNeutralBorder'),
        className
      )}
    >
      <div className="flex flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold">🖥️ {labels.title}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {urgentCount > 0 && (
            <span className="flex items-center gap-1 font-mono text-xs">
              <span className={featureThemeClassName('decisionterminalTerminalHeaderDangerText')}>
                🔴
              </span>
              <span
                className={featureThemeClassName('decisionterminalTerminalHeaderDangerTextAlpha')}
              >
                {urgentCount} {labels.urgent}
              </span>
            </span>
          )}
          <span className="text-muted-foreground flex items-center gap-1 font-mono text-xs">
            📊 {activeCount} {labels.active}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {filters.map(filter => (
            <Button
              key={filter.value}
              variant={activeFilter === filter.value ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onFilterChange(filter.value)}
              className={cn(
                'font-mono text-xs',
                activeFilter === filter.value && 'bg-muted font-medium'
              )}
            >
              {filter.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" presentation="monoCompact" className="h-8 gap-1">
                <Eye className="h-3.5 w-3.5" />
                {visibilityLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onVisibilityFilterChange('all')}>
                {labels.all}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onVisibilityFilterChange('public')}>
                {labels.public}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onVisibilityFilterChange('authenticated')}>
                {labels.authenticated}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onVisibilityFilterChange('private')}>
                {labels.private}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {showSearch ? (
            <FormControlInput
              type="text"
              placeholder={labels.searchPlaceholder}
              value={searchQuery}
              onChange={event => onSearchChange(event.target.value)}
              className="h-8 w-full font-mono text-xs sm:w-48"
              autoFocus
              onBlur={onSearchBlur}
            />
          ) : (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onShowSearch}>
              <Search className="h-4 w-4" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                {labels.density}
              </DropdownMenuItem>
              <DropdownMenuItem>{labels.refreshRate}</DropdownMenuItem>
              <DropdownMenuItem>{labels.soundAlerts}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
