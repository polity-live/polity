import type { ReactNode } from 'react';

import { FormFieldShell } from '@/features/shared/ui/form/FormFieldShell';
import { Switch } from '@/features/shared/ui/ui/switch';
import { cn } from '@/features/shared/utils/utils';

interface SwitchFieldProps {
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

export function SwitchField({
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
}: SwitchFieldProps) {
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
            'flex cursor-pointer items-center justify-between gap-4 rounded-md border p-3 transition-colors',
            checked ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
            disabled && 'cursor-not-allowed opacity-60',
            className
          )}
        >
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
          <Switch
            id={fieldId}
            checked={checked}
            disabled={disabled}
            aria-describedby={describedBy}
            aria-required={required || undefined}
            onCheckedChange={onCheckedChange}
          />
        </label>
      )}
    </FormFieldShell>
  );
}
