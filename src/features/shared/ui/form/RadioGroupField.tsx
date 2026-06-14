import type { ComponentProps, ReactNode } from 'react';

import { FormFieldShell } from '@/features/shared/ui/form/FormFieldShell';
import { RadioGroup, RadioGroupItem } from '@/features/shared/ui/ui/radio-group';
import { cn } from '@/features/shared/utils/utils';

interface RadioGroupFieldOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

interface RadioGroupFieldProps extends Omit<
  ComponentProps<typeof RadioGroup>,
  'value' | 'onValueChange'
> {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  value?: string;
  onValueChange: (value: string) => void;
  options: RadioGroupFieldOption[];
  fieldClassName?: string;
  optionClassName?: string;
}

export function RadioGroupField({
  label,
  description,
  error,
  value,
  onValueChange,
  options,
  fieldClassName,
  optionClassName,
  className,
  ...props
}: RadioGroupFieldProps) {
  return (
    <FormFieldShell
      label={label}
      description={description}
      error={error}
      className={fieldClassName}
    >
      {({ describedBy }) => (
        <RadioGroup
          value={value}
          onValueChange={onValueChange}
          aria-describedby={describedBy}
          className={cn('gap-2', className)}
          {...props}
        >
          {options.map(option => {
            const id = `${props.id ?? 'radio'}-${option.value}`;

            return (
              <label
                key={option.value}
                htmlFor={id}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors',
                  value === option.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                  option.disabled && 'cursor-not-allowed opacity-60',
                  optionClassName
                )}
              >
                <RadioGroupItem id={id} value={option.value} disabled={option.disabled} />
                <span className="grid gap-1">
                  <span className="leading-none font-medium">{option.label}</span>
                  {option.description ? (
                    <span className="text-muted-foreground">{option.description}</span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </RadioGroup>
      )}
    </FormFieldShell>
  );
}
