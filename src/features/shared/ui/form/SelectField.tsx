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
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  placeholder?: ReactNode;
  value?: string;
  onValueChange: (value: string) => void;
  options: SelectFieldOption[];
  fieldClassName?: string;
  triggerClassName?: string;
}

export function SelectField({
  label,
  description,
  error,
  placeholder,
  value,
  onValueChange,
  options,
  fieldClassName,
  triggerClassName,
  ...props
}: SelectFieldProps) {
  return (
    <FormFieldShell
      label={label}
      description={description}
      error={error}
      className={fieldClassName}
    >
      {({ id, describedBy, invalid }) => (
        <Select value={value} onValueChange={onValueChange} {...props}>
          <SelectTrigger
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={triggerClassName}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map(option => (
              <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormFieldShell>
  );
}
