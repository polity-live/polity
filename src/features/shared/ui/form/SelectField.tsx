import type { ComponentProps, ReactNode } from 'react';

import { FormFieldShell } from '@/features/shared/ui/form/FormFieldShell';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/features/shared/ui/ui/select';

interface SelectFieldOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

interface SelectFieldProps extends Omit<ComponentProps<typeof Select>, 'value' | 'onValueChange'> {
  'data-action-id'?: string;
  label?: ReactNode;
  labelAction?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  invalid?: boolean;
  required?: boolean;
  placeholder?: ReactNode;
  value?: string;
  onValueChange: (value: string) => void;
  options: SelectFieldOption[];
  fieldClassName?: string;
  labelClassName?: string;
  descriptionClassName?: string;
  errorClassName?: string;
  inputClassName?: string;
  triggerClassName?: string;
}

export function SelectField({
  'data-action-id': actionId,
  label,
  labelAction,
  description,
  error,
  invalid,
  required,
  placeholder,
  value,
  onValueChange,
  options,
  fieldClassName,
  labelClassName,
  descriptionClassName,
  errorClassName,
  inputClassName,
  triggerClassName,
  ...props
}: SelectFieldProps) {
  return (
    <FormFieldShell
      label={label}
      labelAction={labelAction}
      description={description}
      error={error}
      invalid={invalid}
      required={required}
      className={fieldClassName}
      labelClassName={labelClassName}
      descriptionClassName={descriptionClassName}
      errorClassName={errorClassName}
    >
      {({ id, describedBy, invalid }) => (
        <Select value={value} onValueChange={onValueChange} {...props}>
          <SelectTrigger
            data-action-id={actionId}
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            aria-required={required || undefined}
            className={triggerClassName ?? inputClassName}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map(option => (
              <SelectItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                data-create-option={option.value}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormFieldShell>
  );
}
