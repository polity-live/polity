import { useMemo, useState } from 'react';

import type { PqlComboboxOption } from '../ui/PqlCombobox';

interface UsePqlComboboxControllerProps {
  value?: string;
  onValueChange: (value: string | undefined) => void;
  options: readonly PqlComboboxOption[];
}

export function usePqlComboboxController({
  value,
  onValueChange,
  options,
}: UsePqlComboboxControllerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const normalizedQuery = query.replace(/^@+/, '').trim().toLowerCase();
  const selectedOption = options.find(option => option.value === value);

  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) {
      return options;
    }

    return options.filter(option => {
      const haystack = [option.label, ...(option.keywords ?? [])].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, options]);

  const clearSelection = () => {
    onValueChange(undefined);
    setQuery('');
  };

  const selectOption = (optionValue: string) => {
    onValueChange(optionValue);
    setOpen(false);
    setQuery('');
  };

  return {
    filteredOptions,
    open,
    query,
    selectedOption,
    onClearSelection: clearSelection,
    onOpenChange: setOpen,
    onQueryChange: setQuery,
    onSelectOption: selectOption,
  };
}
