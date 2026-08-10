import { FormControlLabel } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';
import type { CreateAmendmentEvaluationMode } from '../../logic/createAmendmentSearch';

export function AmendmentEvaluationModeInput({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: CreateAmendmentEvaluationMode; label: string }[];
  value: CreateAmendmentEvaluationMode;
  onChange: (value: CreateAmendmentEvaluationMode) => void;
}) {
  return (
    <div className="space-y-2">
      <FormControlLabel>{label}</FormControlLabel>
      <div className="flex flex-wrap gap-2">
        {options.map(option => (
          <Button
            data-action-id="create.amendment-evaluation.select"
            key={option.value}
            type="button"
            variant={value === option.value ? 'default' : 'outline'}
            onClick={() => onChange(option.value)}
            data-create-option={option.value}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
