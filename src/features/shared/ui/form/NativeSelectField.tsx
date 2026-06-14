import type { ComponentProps, ReactNode } from 'react';

import { FormFieldShell } from '@/features/shared/ui/form/FormFieldShell';
import { NativeSelect } from '@/features/shared/ui/ui/native-select';

interface NativeSelectFieldProps extends ComponentProps<typeof NativeSelect> {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  fieldClassName?: string;
}

export function NativeSelectField({
  label,
  description,
  error,
  fieldClassName,
  children,
  ...props
}: NativeSelectFieldProps) {
  return (
    <FormFieldShell
      label={label}
      description={description}
      error={error}
      className={fieldClassName}
    >
      {({ id, describedBy, invalid }) => (
        <NativeSelect
          {...props}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
        >
          {children}
        </NativeSelect>
      )}
    </FormFieldShell>
  );
}
