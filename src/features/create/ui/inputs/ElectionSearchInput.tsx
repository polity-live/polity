import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { useElectionState } from '@/zero/elections/useElectionState';
import { useMemo } from 'react';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { CreateTypeaheadField } from '../CreateFields';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface ElectionSearchInputProps {
  value: string;
  onChange: (electionId: string) => void;
  label?: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
}

export function ElectionSearchInput({
  value,
  onChange,
  label,
  hint,
  placeholder = translateText('generated.inline.0041_search_for_an_election_fce24966'),
  required,
}: ElectionSearchInputProps) {
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

  return (
    <CreateTypeaheadField
      items={items}
      value={value || undefined}
      onChange={handleChange}
      label={label}
      hint={hint}
      required={required}
      placeholder={placeholder}
    />
  );
}
