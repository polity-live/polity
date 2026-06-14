import { BadgeControl } from '@/features/shared/ui/status';
import { SearchField } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';
import { Filter, X } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface SearchHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  activeTopics: string[];
  onTopicRemove: (topic: string) => void;
  totalResults: number;
  queryParam: string;
}

export function SearchHeader({
  searchQuery,
  setSearchQuery,
  showFilters,
  setShowFilters,
  activeTopics,
  onTopicRemove,
  totalResults,
  queryParam,
}: SearchHeaderProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold">{t('features.search.title')}</h1>
        <p className="text-muted-foreground">{t('features.search.description')}</p>
      </div>

      {/* Search Bar - Fixed/Sticky */}
      <div className="bg-background sticky top-0 z-10 mb-6 space-y-4 pt-2 pb-4">
        <div className="flex gap-2">
          <SearchField
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder={t('features.search.placeholderDetailed')}
            clearLabel={t('common.actions.clear')}
            fieldClassName="flex-1"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            aria-label={t('features.search.filters.title')}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* Active Filters Display */}
        {activeTopics.length > 0 && !showFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {t('features.search.filters.title')}:
            </span>
            {activeTopics.map(topic => (
              <BadgeControl
                key={topic}
                variant="secondary"
                className="cursor-pointer"
                onClick={() => onTopicRemove(topic)}
              >
                {topic}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="hover:text-destructive ml-2 h-4 w-4 p-0 text-inherit hover:bg-transparent"
                  aria-label={t('common.actions.remove')}
                  onClick={e => {
                    e.stopPropagation();
                    onTopicRemove(topic);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </BadgeControl>
            ))}
          </div>
        )}
      </div>

      {/* Results Summary */}
      {(queryParam || activeTopics.length > 0) && (
        <div className="mb-4">
          <p className="text-muted-foreground text-sm">
            {queryParam &&
              t('features.search.results.showingFor', { count: totalResults, query: queryParam })}
            {queryParam && activeTopics.length > 0 && ' '}
            {activeTopics.length > 0 &&
              `${t('features.search.filters.title')}: ${activeTopics.join(', ')}`}
          </p>
        </div>
      )}
    </>
  );
}
