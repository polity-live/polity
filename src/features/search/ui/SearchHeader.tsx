import { SearchField } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';
import { Kbd } from '@/features/shared/ui/ui/kbd';
import { FilterButton } from '@/features/shared/ui/filter-controls';
import { Filter, List, MapPinned } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { SearchViewMode } from '../hooks/useSearchURL';
import { commandDialogShortcut } from '@/features/navigation/nav-keyboard/keyboard-navigation';
import { useResolvedKeyboardShortcut } from '@/features/shared/keyboard/keyboard-shortcut';

interface SearchHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  activeTopics: string[];
  personalTopics?: string[];
  onTopicToggle: (topic: string) => void;
  totalResults: number | null;
  queryParam: string;
  view: SearchViewMode;
  onViewChange: (view: SearchViewMode) => void;
}

export function SearchHeader({
  searchQuery,
  setSearchQuery,
  showFilters,
  setShowFilters,
  activeTopics,
  personalTopics = [],
  onTopicToggle,
  totalResults,
  queryParam,
  view,
  onViewChange,
}: SearchHeaderProps) {
  const { t } = useTranslation();
  const commandDialogShortcutResolved = useResolvedKeyboardShortcut(commandDialogShortcut);

  return (
    <>
      <h1 className="sr-only">{t('features.search.title')}</h1>
      {/* Search Bar - Fixed/Sticky */}
      <div className="bg-background sticky top-0 z-10 mb-2 space-y-3 pt-2 pb-2">
        <div className="flex gap-2">
          <SearchField
            data-tutorial-anchor="search-input"
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder={t('features.search.placeholderDetailed')}
            clearLabel={t('common.actions.clear')}
            fieldClassName="flex-1"
            inputClassName="pr-9 md:pr-20"
            emptyEndAdornment={
              commandDialogShortcutResolved ? (
                <Kbd className="hidden md:inline-flex" aria-hidden="true">
                  {commandDialogShortcutResolved.display}
                </Kbd>
              ) : undefined
            }
            aria-keyshortcuts={commandDialogShortcutResolved?.ariaKeyShortcuts}
          />
          <div
            className="border-input bg-background inline-flex shrink-0 overflow-hidden rounded-md border"
            role="group"
            aria-label={t('features.search.viewToggle', { defaultValue: 'Search view' })}
          >
            <Button
              data-action-id="search.header.view.list"
              variant={view === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-none border-0"
              onClick={() => onViewChange('list')}
              aria-label={t('features.search.listView', { defaultValue: 'List view' })}
              aria-pressed={view === 'list'}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              data-action-id="search.header.view.spatial"
              variant={view === 'spatial' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-none border-0"
              onClick={() => onViewChange('spatial')}
              aria-label={t('features.search.spatialView', { defaultValue: 'Spatial view' })}
              aria-pressed={view === 'spatial'}
            >
              <MapPinned className="h-4 w-4" />
            </Button>
          </div>
          <Button
            data-action-id="search.header.filters.toggle"
            variant="outline"
            size="icon"
            className="rounded-md"
            onClick={() => setShowFilters(!showFilters)}
            aria-label={t('features.search.filters.title')}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {personalTopics.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs font-medium">
              {t('features.search.personalTopics')}
            </span>
            {personalTopics.slice(0, 8).map(topic => {
              const isActive = activeTopics.some(
                activeTopic => activeTopic.toLowerCase() === topic.toLowerCase()
              );

              return (
                <FilterButton
                  data-action-id="search.header.topic.toggle"
                  key={topic}
                  active={isActive}
                  className="rounded-md"
                  onClick={() => onTopicToggle(topic)}
                >
                  #{topic}
                </FilterButton>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Results Summary */}
      {queryParam && (
        <div className="mb-4">
          <p className="text-muted-foreground text-sm">
            {totalResults === null
              ? t('features.search.results.searchingFor', { query: queryParam })
              : t('features.search.results.showingFor', { count: totalResults, query: queryParam })}
          </p>
        </div>
      )}
    </>
  );
}
