import { usePqlComboboxController } from '../hooks/usePqlComboboxController';
import { PqlComboboxView } from './PqlComboboxView';

export interface PqlComboboxOption {
  value: string;
  label: string;
  keywords?: readonly string[];
}

interface PqlComboboxProps {
  value?: string;
  onValueChange: (value: string | undefined) => void;
  options: readonly PqlComboboxOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
  allowClear?: boolean;
}

export function PqlCombobox({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled = false,
  allowClear = false,
}: PqlComboboxProps) {
  return (
    <PqlComboboxView
      value={value}
      options={options}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      disabled={disabled}
      allowClear={allowClear}
      {...usePqlComboboxController({ value, onValueChange, options })}
    />
  );
}
