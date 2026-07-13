import { useGroupData } from '@/features/groups/hooks/useGroupData';
import { useAmendmentFilters } from '@/features/groups/hooks/useAmendmentFilters';

const EMPTY_GROUPED_AMENDMENTS = {
  accepted: [],
  pending: [],
  rejected: [],
  withdrawn: [],
};

interface UseGroupAmendmentsPageOptions {
  groupId: string;
}

export function useGroupAmendmentsPage({ groupId }: UseGroupAmendmentsPageOptions) {
  const { group } = useGroupData(groupId);
  const { filters, showFilters, hasActiveFilters, updateFilter, clearFilter, setShowFilters } =
    useAmendmentFilters();

  return {
    groupedAmendments: EMPTY_GROUPED_AMENDMENTS,
    groupName: group?.name ?? undefined,
    filters,
    showFilters,
    hasActiveFilters,
    updateFilter,
    clearFilter,
    setShowFilters,
  };
}
