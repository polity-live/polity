import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import { useGroupAmendmentsPage } from '@/features/groups/hooks/useGroupAmendmentsPage';
import { AmendmentGroups } from '@/features/groups/ui/AmendmentGroups';
import { AmendmentSearchAndFilters } from '@/features/groups/ui/AmendmentSearchAndFilters';
import { usePermissions } from '@/zero/rbac';

interface GroupAmendmentsPageProps {
  groupId: string;
}

export function GroupAmendmentsPage({ groupId }: GroupAmendmentsPageProps) {
  const { t } = useTranslation();
  const { canCreate } = usePermissions({ groupId });
  const {
    groupedAmendments,
    groupName,
    filters,
    showFilters,
    hasActiveFilters,
    updateFilter,
    clearFilter,
    setShowFilters,
  } = useGroupAmendmentsPage({ groupId });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('features.groups.amendments.title')}</h1>
        {canCreate('amendments') ? (
          <Link to="/create/amendment" search={{ groupId }}>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" />
              {t('features.groups.amendments.createAmendment')}
            </Button>
          </Link>
        ) : null}
      </div>

      <AmendmentSearchAndFilters
        filters={filters}
        showFilters={showFilters}
        hasActiveFilters={hasActiveFilters}
        onSearchChange={value => updateFilter('searchQuery', value)}
        onStatusChange={value => updateFilter('statusFilter', value)}
        onHashtagChange={value => updateFilter('hashtagFilter', value)}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onClearStatusFilter={() => clearFilter('statusFilter')}
        onClearHashtagFilter={() => clearFilter('hashtagFilter')}
      />

      <AmendmentGroups
        groupedAmendments={groupedAmendments}
        groupName={groupName}
        groupId={groupId}
      />
    </div>
  );
}
