import { FormControlLabel } from '@/features/shared/ui/form';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead/TypeaheadSearch';
export interface AmendmentSearchInputViewProps {
  value: any;
  onChange: any;
  label: any;
  placeholder: any;
  amendments: any;
  items: any;
  handleChange: any;
}

export function AmendmentSearchInputView({
  value,
  label,
  placeholder,
  items,
  handleChange,
}: AmendmentSearchInputViewProps) {
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
