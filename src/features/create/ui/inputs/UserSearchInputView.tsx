import { CreateTypeaheadField } from '@/features/shared/ui/form';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';

interface UserSearchInputViewProps {
  items: TypeaheadItem[];
  value: string[];
  onChange: (userIds: string[]) => void;
  label?: string;
  hint?: string;
  placeholder?: string;
  multi?: boolean;
  required?: boolean;
  disablePortal?: boolean;
  showAllResults?: boolean;
  disabled?: boolean;
}

export function UserSearchInputView({
  items,
  value,
  onChange,
  label,
  hint,
  placeholder,
  multi = true,
  required,
  disablePortal = false,
  showAllResults = false,
  disabled = false,
}: UserSearchInputViewProps) {
  if (multi) {
    return (
      <CreateTypeaheadField
        items={items}
        multiple
        values={value}
        onValuesChange={onChange}
        label={label}
        hint={hint}
        required={required}
        placeholder={placeholder}
        disablePortal={disablePortal}
        showAllResults={showAllResults}
        disabled={disabled}
      />
    );
  }

  return (
    <CreateTypeaheadField
      items={items}
      value={value[0] || undefined}
      onChange={item => onChange(item ? [item.id] : [])}
      label={label}
      hint={hint}
      required={required}
      placeholder={placeholder}
      disablePortal={disablePortal}
      showAllResults={showAllResults}
      disabled={disabled}
    />
  );
}
