import { FormControlLabel } from '@/features/shared/ui/form';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
export interface EventSearchInputViewProps {
  value: any;
  onChange: any;
  label: any;
  placeholder: any;
  filterByGroupId: any;
  events: any;
  items: any;
  handleChange: any;
}

export function EventSearchInputView({
  value,
  label,
  placeholder,
  items,
  handleChange,
}: EventSearchInputViewProps) {
  return (
    <div>
      {label && <FormControlLabel className="mb-2 block">{label}</FormControlLabel>}
      <TypeaheadSearch
        items={items}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
      />
    </div>
  );
}
