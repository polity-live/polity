import { type ReactNode, useId } from 'react';

import { Field, FieldDescription, FieldError, FieldLabel } from '@/features/shared/ui/ui/field';
import { cn } from '@/features/shared/utils/utils';

interface FormFieldShellProps {
  id?: string;
  label?: ReactNode;
  labelAction?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  invalid?: boolean;
  required?: boolean;
  children: (fieldProps: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => ReactNode;
  className?: string;
  labelClassName?: string;
  descriptionClassName?: string;
  errorClassName?: string;
}

export function FormFieldShell({
  id,
  label,
  labelAction,
  description,
  error,
  invalid: invalidProp,
  required,
  children,
  className,
  labelClassName,
  descriptionClassName,
  errorClassName,
}: FormFieldShellProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const descriptionId = description ? `${fieldId}-description` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;
  const invalid = invalidProp ?? Boolean(error);

  return (
    <Field className={className} data-invalid={invalid ? 'true' : undefined}>
      {label || labelAction ? (
        <div className="flex items-center justify-between gap-3">
          {label ? (
            <FieldLabel htmlFor={fieldId} className={labelClassName}>
              {label}
              {required ? <span className="text-destructive">*</span> : null}
            </FieldLabel>
          ) : null}
          {labelAction ? <div className="shrink-0">{labelAction}</div> : null}
        </div>
      ) : null}
      {children({ id: fieldId, describedBy, invalid })}
      {description ? (
        <FieldDescription id={descriptionId} className={descriptionClassName}>
          {description}
        </FieldDescription>
      ) : null}
      <FieldError id={errorId} className={cn(errorClassName)}>
        {error}
      </FieldError>
    </Field>
  );
}
