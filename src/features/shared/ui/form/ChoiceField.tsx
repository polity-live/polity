import { type ReactNode } from 'react';

import { Checkbox } from '@/features/shared/ui/ui/checkbox';
import { FormFieldShell } from '@/features/shared/ui/form/FormFieldShell';
import { cn } from '@/features/shared/utils/utils';

interface ChoiceFieldProps {
  id?: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  invalid?: boolean;
  required?: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  fieldClassName?: string;
  labelClassName?: string;
  descriptionClassName?: string;
  errorClassName?: string;
}

export function ChoiceField({
  id,
  label,
  description,
  error,
  invalid,
  required,
  checked,
  onCheckedChange,
  disabled,
  className,
  fieldClassName,
  labelClassName,
  descriptionClassName,
  errorClassName,
}: ChoiceFieldProps) {
  return (
    <FormFieldShell
      id={id}
      error={error}
      invalid={invalid}
      className={fieldClassName}
      errorClassName={errorClassName}
    >
      {({ id: fieldId, describedBy }) => (
        <label
          htmlFor={fieldId}
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
            checked ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
            disabled && 'cursor-not-allowed opacity-60',
            className
          )}
        >
          <Checkbox
            id={fieldId}
            checked={checked}
            disabled={disabled}
            aria-describedby={describedBy}
            aria-required={required || undefined}
            onCheckedChange={value => onCheckedChange(value === true)}
            className="mt-0.5"
          />
          <span className="grid gap-1">
            <span className={cn('text-sm leading-none font-medium', labelClassName)}>
              {label}
              {required ? <span className="text-destructive">*</span> : null}
            </span>
            {description ? (
              <span className={cn('text-muted-foreground text-sm', descriptionClassName)}>
                {description}
              </span>
            ) : null}
          </span>
        </label>
      )}
    </FormFieldShell>
  );
}
