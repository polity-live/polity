import { useGroupAmendments } from '@/features/groups/hooks/useGroupAmendments';
import { useGroupData } from '@/features/groups/hooks/useGroupData';
import {
  useAmendmentFilters,
  useFilteredAmendments,
} from '@/features/groups/hooks/useAmendmentFilters';

interface UseGroupAmendmentsPageOptions {
  groupId: string;
}

export function useGroupAmendmentsPage({ groupId }: UseGroupAmendmentsPageOptions) {
  const { group, events } = useGroupData(groupId);
  const eventIds = (events ?? [])
    .map(event => event.id)
    .filter((eventId): eventId is string => Boolean(eventId));
  const { amendments } = useGroupAmendments(groupId, eventIds);
  const { filters, showFilters, hasActiveFilters, updateFilter, clearFilter, setShowFilters } =
    useAmendmentFilters();

  const { groupedAmendments } = useFilteredAmendments(
    amendments as Parameters<typeof useFilteredAmendments>[0],
    filters
  );

  return {
    groupedAmendments,
    groupName: group?.name ?? undefined,
    filters,
    showFilters,
    hasActiveFilters,
    updateFilter,
    clearFilter,
    setShowFilters,
  };
}
