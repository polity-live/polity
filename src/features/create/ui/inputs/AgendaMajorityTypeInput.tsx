import {
  FormControlLabel,
  FormControlSelect,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
} from '@/features/shared/ui/form';

type MajorityType = 'simple' | 'absolute' | 'two_thirds';

interface AgendaMajorityTypeInputProps {
  value: MajorityType;
  label: string;
  options: {
    simple: string;
    absolute: string;
    twoThirds: string;
  };
  onChange: (value: MajorityType) => void;
}

export function AgendaMajorityTypeInput({
  value,
  label,
  options,
  onChange,
}: AgendaMajorityTypeInputProps) {
  return (
    <div className="space-y-2">
      <FormControlLabel>{label}</FormControlLabel>
      <FormControlSelect
        value={value}
        onValueChange={nextValue => onChange(nextValue as MajorityType)}
      >
        <FormControlSelectTrigger>
          <FormControlSelectValue />
        </FormControlSelectTrigger>
        <FormControlSelectContent>
          <FormControlSelectItem value="simple" data-create-option="simple">
            {options.simple}
          </FormControlSelectItem>
          <FormControlSelectItem value="absolute" data-create-option="absolute">
            {options.absolute}
          </FormControlSelectItem>
          <FormControlSelectItem value="two_thirds" data-create-option="two_thirds">
            {options.twoThirds}
          </FormControlSelectItem>
        </FormControlSelectContent>
      </FormControlSelect>
    </div>
  );
}
