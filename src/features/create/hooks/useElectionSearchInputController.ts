import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { useElectionState } from '@/zero/elections/useElectionState';
import { useMemo } from 'react';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';

interface UseElectionSearchInputControllerProps {
  onChange: (electionId: string) => void;
}

export function useElectionSearchInputController({
  onChange,
}: UseElectionSearchInputControllerProps) {
  const { electionsForSearch } = useElectionState({ includeElectionsForSearch: true });

  const items = useMemo(
    () =>
      toTypeaheadItems(
        electionsForSearch ?? [],
        'election',
        e => e.title || 'Election',
        e => (typeof e.description === 'string' ? e.description.substring(0, 60) : undefined)
      ),
    [electionsForSearch]
  );

  const handleChange = (item: TypeaheadItem | null) => {
    onChange(item?.id ?? '');
  };

  return { items, handleChange };
}
