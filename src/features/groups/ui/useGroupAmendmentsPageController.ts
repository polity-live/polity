import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useGroupAmendmentsPage } from '@/features/groups/hooks/useGroupAmendmentsPage';
import { usePermissions } from '@/zero/rbac';

interface GroupAmendmentsPageProps {
  groupId: string;
}
export function useGroupAmendmentsPageController({ groupId }: GroupAmendmentsPageProps) {
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

  return {
    groupId,
    t,
    canCreate,
    groupedAmendments,
    groupName,
    filters,
    showFilters,
    hasActiveFilters,
    updateFilter,
    clearFilter,
    setShowFilters,
  };
}
