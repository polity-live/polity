import { type ReactNode } from 'react';

import { Checkbox } from '@/features/shared/ui/ui/checkbox';
import { FormFieldShell } from '@/features/shared/ui/form/FormFieldShell';
import { cn } from '@/features/shared/utils/utils';

interface ChoiceFieldProps {
  id?: string;
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function ChoiceField({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
}: ChoiceFieldProps) {
  return (
    <FormFieldShell id={id} description={description} className={className}>
      {({ id: fieldId, describedBy }) => (
        <label
          htmlFor={fieldId}
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
            checked ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
            disabled && 'cursor-not-allowed opacity-60'
          )}
        >
          <Checkbox
            id={fieldId}
            checked={checked}
            disabled={disabled}
            aria-describedby={describedBy}
            onCheckedChange={value => onCheckedChange(value === true)}
            className="mt-0.5"
          />
          <span className="grid gap-1">
            <span className="text-sm leading-none font-medium">{label}</span>
            {description ? (
              <span className="text-muted-foreground text-sm">{description}</span>
            ) : null}
          </span>
        </label>
      )}
    </FormFieldShell>
  );
}
