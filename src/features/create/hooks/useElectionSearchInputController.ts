import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { useElectionState } from '@/zero/elections/useElectionState';
import { useMemo } from 'react';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';

interface UseElectionSearchInputControllerProps {
  onChange: (electionId: string) => void;
  allowedElectionIds?: readonly string[];
}

export function useElectionSearchInputController({
  onChange,
  allowedElectionIds,
}: UseElectionSearchInputControllerProps) {
  const { electionsForSearch } = useElectionState({ includeElectionsForSearch: true });
  const allowedElectionIdSet = useMemo(
    () => (allowedElectionIds ? new Set(allowedElectionIds) : null),
    [allowedElectionIds]
  );

  const items = useMemo(
    () =>
      toTypeaheadItems(
        allowedElectionIdSet
          ? (electionsForSearch ?? []).filter(election => allowedElectionIdSet.has(election.id))
          : (electionsForSearch ?? []),
        'election',
        e => e.title || 'Election',
        e => (typeof e.description === 'string' ? e.description.substring(0, 60) : undefined)
      ),
    [allowedElectionIdSet, electionsForSearch]
  );

  const handleChange = (item: TypeaheadItem | null) => {
    onChange(item?.id ?? '');
  };

  return { items, handleChange };
}
