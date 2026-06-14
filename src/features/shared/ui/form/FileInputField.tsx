import { forwardRef, type ComponentProps, type ReactNode } from 'react';

import { FormFieldShell } from '@/features/shared/ui/form/FormFieldShell';
import { Input } from '@/features/shared/ui/ui/input';
import { cn } from '@/features/shared/utils/utils';

interface FileInputFieldProps extends Omit<ComponentProps<typeof Input>, 'type'> {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  fieldClassName?: string;
}

export const FileInputField = forwardRef<HTMLInputElement, FileInputFieldProps>(
  function FileInputField(
    { label, description, error, fieldClassName, className, id: inputId, ...props },
    ref
  ) {
    return (
      <FormFieldShell
        id={inputId}
        label={label}
        description={description}
        error={error}
        className={fieldClassName}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            {...props}
            ref={ref}
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
);
