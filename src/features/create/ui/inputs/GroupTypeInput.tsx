import {
  FormControlLabel,
  FormControlRadioGroup,
  FormControlRadioGroupItem,
} from '@/features/shared/ui/form';

type GroupType = 'base' | 'hierarchical' | 'sibling';

interface GroupTypeInputProps {
  value: GroupType;
  label: string;
  options: {
    base: { label: string; description: string };
    hierarchical: { label: string; description: string };
  };
  onChange: (value: GroupType) => void;
}

export function GroupTypeInput({ value, label, options, onChange }: GroupTypeInputProps) {
  return (
    <div className="space-y-2">
      <FormControlLabel>{label}</FormControlLabel>
      <FormControlRadioGroup
        value={value}
        onValueChange={nextValue => onChange(nextValue as GroupType)}
      >
        <div className="space-y-2">
          {(['base', 'hierarchical'] as const).map(optionValue => (
            <FormControlLabel
              key={optionValue}
              htmlFor={`group-type-${optionValue}`}
              data-create-option={optionValue}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                value === optionValue ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              }`}
            >
              <FormControlRadioGroupItem
                data-action-id="create.group-type.select"
                value={optionValue}
                id={`group-type-${optionValue}`}
                data-create-option={optionValue}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium">{options[optionValue].label}</div>
                <div className="text-muted-foreground text-xs">
                  {options[optionValue].description}
                </div>
              </div>
            </FormControlLabel>
          ))}
        </div>
      </FormControlRadioGroup>
    </div>
  );
}
