import { FormControlLabel, FormControlSwitch } from '@/features/shared/ui/form';

interface ConstitutionalEventToggleInputProps {
  hint: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function ConstitutionalEventToggleInput({
  hint,
  label,
  description,
  checked,
  onCheckedChange,
}: ConstitutionalEventToggleInputProps) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">{hint}</p>
      <div className="flex items-center gap-3">
        <FormControlSwitch checked={checked} onCheckedChange={onCheckedChange} />
        <FormControlLabel>{label}</FormControlLabel>
      </div>
      {checked ? (
        <p className="text-muted-foreground rounded-md border p-4 text-xs">{description}</p>
      ) : null}
    </div>
  );
}
