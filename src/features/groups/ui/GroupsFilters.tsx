import { FormControlInput } from '@/features/shared/ui/form';
import React from 'react';
import { EntityBadge, StatusBadge } from '@/features/shared/ui/status';
import { Search, X } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { FilterButton } from '@/features/shared/ui/filter-controls';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface GroupsFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  toggleTag: (tag: string) => void;
  allTags: string[];
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
}

export const GroupsFilters: React.FC<GroupsFiltersProps> = ({
  searchTerm,
  setSearchTerm,
  selectedTags,
  toggleTag,
  allTags,
  hasActiveFilters,
  clearAllFilters,
}) => {
  const { t } = useTranslation();

  return (
    <div className="mb-6 space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <FormControlInput
          placeholder={t('features.groups.list.searchPlaceholder')}
          className="pl-10"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Tag Filters */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-foreground text-sm font-medium">
            {t('features.groups.list.filters.filterByTags')}
          </h3>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-muted-foreground hover:text-foreground h-8 px-3"
            >
              <X className="mr-1 h-3 w-3" />
              {t('features.groups.list.filters.clearFilters')}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {allTags.map(tag => {
            const isSelected = selectedTags.includes(tag);
            return (
              <FilterButton key={tag} active={isSelected} onClick={() => toggleTag(tag)}>
                #{tag}
              </FilterButton>
            );
          })}
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span>{t('features.groups.list.filters.activeFilters')}</span>
          {searchTerm && (
            <StatusBadge status="search" tone="neutral" className="text-xs">
              {t('features.groups.list.filters.searchLabel', { query: searchTerm })}
            </StatusBadge>
          )}
          {selectedTags.map(tag => (
            <EntityBadge key={tag} tone="neutral" className="text-xs">
              #{tag}
            </EntityBadge>
          ))}
        </div>
      )}
    </div>
  );
};
