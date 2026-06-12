'use client';

import { Input } from '@/features/shared/ui/ui/input';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Label } from '@/features/shared/ui/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/features/shared/ui/ui/toggle-group';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Filter, Hash, Search as SearchIcon } from 'lucide-react';
import type { AmendmentFilters } from '../hooks/useAmendmentFilters';

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
}

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
}: AmendmentSearchAndFiltersProps) {
  const { t } = useTranslation();
  const statusLabels: Record<string, string> = {
    accepted: t('features.groups.common.status.acceptedApproved', 'Accepted / Approved'),
    pending: t('features.groups.common.status.pending', 'Pending'),
    rejected: t('features.groups.common.status.rejected', 'Rejected'),
    withdrawn: t('features.groups.common.status.withdrawn', 'Withdrawn'),
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder={t('features.groups.amendments.searchPlaceholder')}
            value={filters.searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="icon" onClick={onToggleFilters}>
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && !showFilters && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">
            {t('features.groups.common.filters.active', 'Active filters:')}
          </span>
          {filters.statusFilter !== 'all' && (
            <Badge variant="secondary" className="cursor-pointer" onClick={onClearStatusFilter}>
              Status: {statusLabels[filters.statusFilter] ?? filters.statusFilter}
              <button
                className="hover:text-destructive ml-2"
                onClick={e => {
                  e.stopPropagation();
                  onClearStatusFilter();
                }}
              >
                ×
              </button>
            </Badge>
          )}
          {filters.hashtagFilter && (
            <Badge variant="secondary" className="cursor-pointer" onClick={onClearHashtagFilter}>
              <Hash className="mr-1 h-3 w-3" />
              {filters.hashtagFilter.replace(/^#/, '')}
              <button
                className="hover:text-destructive ml-2"
                onClick={e => {
                  e.stopPropagation();
                  onClearHashtagFilter();
                }}
              >
                ×
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle>{t('features.groups.common.filters.title', 'Filters')}</CardTitle>
            <CardDescription>
              {t('features.groups.common.filters.refine', 'Refine your search results')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status-filter">
                {t('features.groups.common.filters.status', 'Filter by Status')}
              </Label>
              <ToggleGroup
                id="status-filter"
                type="single"
                variant="outline"
                className="flex flex-wrap justify-start"
                value={filters.statusFilter}
                onValueChange={value => {
                  if (value) {
                    onStatusChange(value);
                  }
                }}
              >
                <ToggleGroupItem
                  value="all"
                  aria-label={t('features.groups.common.filters.allStatuses', 'All Statuses')}
                >
                  {t('features.groups.common.filters.allStatuses', 'All Statuses')}
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="accepted"
                  aria-label={t(
                    'features.groups.common.status.acceptedApproved',
                    'Accepted / Approved'
                  )}
                >
                  {t('features.groups.common.status.acceptedApproved', 'Accepted / Approved')}
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="pending"
                  aria-label={t('features.groups.common.status.pending', 'Pending')}
                >
                  {t('features.groups.common.status.pending', 'Pending')}
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="rejected"
                  aria-label={t('features.groups.common.status.rejected', 'Rejected')}
                >
                  {t('features.groups.common.status.rejected', 'Rejected')}
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="withdrawn"
                  aria-label={t('features.groups.common.status.withdrawn', 'Withdrawn')}
                >
                  {t('features.groups.common.status.withdrawn', 'Withdrawn')}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hashtag-filter">
                {t('features.groups.common.filters.hashtag', 'Filter by Hashtag')}
              </Label>
              <Input
                id="hashtag-filter"
                placeholder={t('features.groups.events.hashtagPlaceholder')}
                value={filters.hashtagFilter}
                onChange={e => onHashtagChange(e.target.value)}
              />
              {filters.hashtagFilter && (
                <p className="text-muted-foreground text-xs">
                  {t('features.groups.common.filters.filteringBy', 'Filtering by:')} #
                  {filters.hashtagFilter}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
