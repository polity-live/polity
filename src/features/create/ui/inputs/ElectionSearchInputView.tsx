import { CreateTypeaheadField } from '@/features/shared/ui/form';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';

interface ElectionSearchInputViewProps {
  items: TypeaheadItem[];
  value: string;
  onChange: (item: TypeaheadItem | null) => void;
  label?: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
}

export function ElectionSearchInputView({
  items,
  value,
  onChange,
  label,
  hint,
  placeholder,
  required,
}: ElectionSearchInputViewProps) {
  return (
    <CreateTypeaheadField
      items={items}
      value={value || undefined}
      onChange={onChange}
      label={label}
      hint={hint}
      required={required}
      placeholder={placeholder}
    />
  );
}
