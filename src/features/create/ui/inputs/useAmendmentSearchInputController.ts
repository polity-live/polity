import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import { useAllAmendments } from '@/zero/events/useEventState';
import { useMemo } from 'react';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface AmendmentSearchInputProps {
  value: string;
  onChange: (amendmentId: string) => void;
  label?: string;
  placeholder?: string;
}
export function useAmendmentSearchInputController({
  value,
  onChange,
  label,
  placeholder = translateText('generated.inline.0040_search_for_an_amendment_5231be40'),
}: AmendmentSearchInputProps) {
  const { amendments } = useAllAmendments();

  const items = useMemo(
    () =>
      toTypeaheadItems(
        amendments ?? [],
        'amendment',
        a => a.title || 'Amendment',
        undefined,
        undefined,
        a => `/amendment/${a.id}`
      ),
    [amendments]
  );

  const handleChange = (item: TypeaheadItem | null) => {
    onChange(item?.id ?? '');
  };

  return {
    value,
    onChange,
    label,
    placeholder,
    amendments,
    items,
    handleChange,
  };
}
