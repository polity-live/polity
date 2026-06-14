import type { ComponentProps, ReactNode } from 'react';

import { FormFieldShell } from '@/features/shared/ui/form/FormFieldShell';
import { Input } from '@/features/shared/ui/ui/input';
import { cn } from '@/features/shared/utils/utils';

interface FileInputFieldProps extends Omit<ComponentProps<typeof Input>, 'type'> {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  fieldClassName?: string;
}

export function FileInputField({
  label,
  description,
  error,
  fieldClassName,
  className,
  ...props
}: FileInputFieldProps) {
  return (
    <FormFieldShell
      label={label}
      description={description}
      error={error}
      className={fieldClassName}
    >
      {({ id, describedBy, invalid }) => (
        <Input
          {...props}
          id={id}
          type="file"
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn('cursor-pointer', className)}
        />
      )}
    </FormFieldShell>
  );
}
