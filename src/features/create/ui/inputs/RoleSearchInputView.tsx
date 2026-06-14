import { CreateTypeaheadField } from '@/features/shared/ui/form';
export interface RoleSearchInputViewProps {
  value: any;
  onChange: any;
  label: any;
  hint: any;
  placeholder: any;
  groupIds: any;
  required: any;
  roles: any;
  filteredRoles: any;
  items: any;
  handleChange: any;
}

export function RoleSearchInputView({
  value,
  label,
  hint,
  placeholder,
  required,
  items,
  handleChange,
}: RoleSearchInputViewProps) {
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
