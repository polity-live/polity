'use client';

import { FormControlInput, FormControlLabel, SearchField } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { EntityBadge, StatusBadge } from '@/features/shared/ui/status';
import { FilterToggleGroupItem } from '@/features/shared/ui/filter-controls';
import { ToggleGroup } from '@/features/shared/ui/ui/toggle-group';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { Filter, Hash } from 'lucide-react';
import type { AmendmentFilters } from '../hooks/useAmendmentFilters';
import type { ReactNode } from 'react';

interface AmendmentSearchAndFiltersProps {
  filters: AmendmentFilters;
  showFilters: boolean;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onHashtagChange: (value: string) => void;
  onToggleFilters: () => void;
  onClearStatusFilter: () => void;
  onClearHashtagFilter: () => void;
  actions?: ReactNode;
}

function applyStatusFilter(value: string, onStatusChange: (value: string) => void) {
  if (value) {
    onStatusChange(value);
  }
}

export const amendmentSearchAndFiltersInternals = { applyStatusFilter };

export function AmendmentSearchAndFilters({
  filters,
  showFilters,
  hasActiveFilters,
  onSearchChange,
  onStatusChange,
  onHashtagChange,
  onToggleFilters,
  onClearStatusFilter,
  onClearHashtagFilter,
  actions,
}: AmendmentSearchAndFiltersProps) {
  const { t } = useTranslation();
  const statusLabels: Record<string, string> = {
    accepted: t('features.groups.common.status.acceptedApproved'),
    pending: t('features.groups.common.status.pending'),
    rejected: t('features.groups.common.status.rejected'),
    withdrawn: t('features.groups.common.status.withdrawn'),
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <SearchField
          fieldClassName="flex-1"
          placeholder={t('features.groups.amendments.searchPlaceholder')}
          value={filters.searchQuery}
          onValueChange={onSearchChange}
          clearLabel={translateText('generated.inline.1132_clear_search_67300d0f')}
        />
        <Button
          data-action-id="groups.amendments.toggle.filters"
          variant="outline"
          size="icon"
          onClick={onToggleFilters}
        >
          <Filter className="h-4 w-4" />
        </Button>
        {actions ? <div className="flex shrink-0 items-center">{actions}</div> : null}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && !showFilters && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">
            {t('features.groups.common.filters.active')}
          </span>
          {filters.statusFilter !== 'all' && (
            <StatusBadge
              data-action-id="groups.amendments.clear.status-filter"
              status={filters.statusFilter}
              className="cursor-pointer"
              onClick={onClearStatusFilter}
            >
              {translateText('generated.inline.0643_status_11dc9e19')}
              {statusLabels[filters.statusFilter] ?? filters.statusFilter}
              <Button
                data-action-id="groups.amendments.clear.status-filter"
                type="button"
                variant="ghost"
                size="icon"
                className="hover:text-destructive ml-2 h-4 w-4 p-0 text-inherit hover:bg-transparent"
                onClick={e => {
                  e.stopPropagation();
                  onClearStatusFilter();
                }}
              >
                ×
              </Button>
            </StatusBadge>
          )}
          {filters.hashtagFilter && (
            <EntityBadge
              data-action-id="groups.amendments.clear.hashtag-filter"
              tone="neutral"
              className="cursor-pointer"
              onClick={onClearHashtagFilter}
            >
              <Hash className="mr-1 h-3 w-3" />
              {filters.hashtagFilter.replace(/^#/, '')}
              <Button
                data-action-id="groups.amendments.clear.hashtag-filter"
                type="button"
                variant="ghost"
                size="icon"
                className="hover:text-destructive ml-2 h-4 w-4 p-0 text-inherit hover:bg-transparent"
                onClick={e => {
                  e.stopPropagation();
                  onClearHashtagFilter();
                }}
              >
                ×
              </Button>
            </EntityBadge>
          )}
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle>{t('features.groups.common.filters.title')}</CardTitle>
            <CardDescription>{t('features.groups.common.filters.refine')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <FormControlLabel htmlFor="status-filter">
                {t('features.groups.common.filters.status')}
              </FormControlLabel>
              <ToggleGroup
                id="status-filter"
                type="single"
                variant="outline"
                className="flex flex-wrap justify-start"
                value={filters.statusFilter}
                onValueChange={value => applyStatusFilter(value, onStatusChange)}
              >
                <FilterToggleGroupItem
                  data-action-id="groups.amendments.filter.all"
                  value="all"
                  aria-label={t('features.groups.common.filters.allStatuses')}
                >
                  {t('features.groups.common.filters.allStatuses')}
                </FilterToggleGroupItem>
                <FilterToggleGroupItem
                  data-action-id="groups.amendments.filter.accepted"
                  value="accepted"
                  aria-label={t('features.groups.common.status.acceptedApproved')}
                >
                  {t('features.groups.common.status.acceptedApproved')}
                </FilterToggleGroupItem>
                <FilterToggleGroupItem
                  data-action-id="groups.amendments.filter.pending"
                  value="pending"
                  aria-label={t('features.groups.common.status.pending')}
                >
                  {t('features.groups.common.status.pending')}
                </FilterToggleGroupItem>
                <FilterToggleGroupItem
                  data-action-id="groups.amendments.filter.rejected"
                  value="rejected"
                  aria-label={t('features.groups.common.status.rejected')}
                >
                  {t('features.groups.common.status.rejected')}
                </FilterToggleGroupItem>
                <FilterToggleGroupItem
                  data-action-id="groups.amendments.filter.withdrawn"
                  value="withdrawn"
                  aria-label={t('features.groups.common.status.withdrawn')}
                >
                  {t('features.groups.common.status.withdrawn')}
                </FilterToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="space-y-2">
              <FormControlLabel htmlFor="hashtag-filter">
                {t('features.groups.common.filters.hashtag')}
              </FormControlLabel>
              <FormControlInput
                id="hashtag-filter"
                placeholder={t('features.groups.events.hashtagPlaceholder')}
                value={filters.hashtagFilter}
                onChange={e => onHashtagChange(e.target.value)}
              />
              {filters.hashtagFilter && (
                <p className="text-muted-foreground text-xs">
                  {t('features.groups.common.filters.filteringBy')} #{filters.hashtagFilter}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
