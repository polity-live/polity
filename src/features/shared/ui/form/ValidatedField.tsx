import { useState, type ComponentProps, type ReactNode } from 'react';

import { Input } from '@/features/shared/ui/ui/input';
import { Textarea } from '@/features/shared/ui/ui/textarea';
import { FormFieldShell } from '@/features/shared/ui/form/FormFieldShell';
import { cn } from '@/features/shared/utils/utils';

type FieldValidator = (value: string) => string | null;

interface ValidatedFieldBaseProps {
  label?: ReactNode;
  description?: ReactNode;
  required?: boolean;
  validator?: FieldValidator;
  value: string | number | null | undefined;
  onValueChange: (value: string) => void;
  className?: string;
  fieldClassName?: string;
}

type ValidatedInputFieldProps = ValidatedFieldBaseProps &
  Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
    multiline?: false;
  };

type ValidatedTextareaFieldProps = ValidatedFieldBaseProps &
  Omit<ComponentProps<typeof Textarea>, 'value' | 'onChange'> & {
    multiline: true;
  };

export type ValidatedFieldProps = ValidatedInputFieldProps | ValidatedTextareaFieldProps;

function normalizeValue(value: string | number | null | undefined): string {
  return value == null ? '' : String(value);
}

export function ValidatedField({
  label,
  description,
  required,
  validator,
  value,
  onValueChange,
  className,
  fieldClassName,
  onBlur,
  multiline,
  ...props
}: ValidatedFieldProps) {
  const [touched, setTouched] = useState(false);
  const normalizedValue = normalizeValue(value);
  const trimmedValue = normalizedValue.trim();
  const validationError = validator?.(normalizedValue) ?? null;
  const error =
    touched && required && trimmedValue.length === 0
      ? description
      : touched && trimmedValue.length > 0
        ? validationError
        : null;
  const isValid =
    (touched || trimmedValue.length > 0) && trimmedValue.length > 0 && !validationError;

  return (
    <FormFieldShell
      label={label}
      description={description}
      error={error}
      required={required}
      className={fieldClassName}
    >
      {({ id, describedBy, invalid }) =>
        multiline ? (
          <Textarea
            {...(props as Omit<ComponentProps<typeof Textarea>, 'value' | 'onChange'>)}
            id={id}
            value={normalizedValue}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            data-valid={isValid ? 'true' : undefined}
            onChange={event => {
              setTouched(true);
              onValueChange(event.target.value);
            }}
            onBlur={event => {
              setTouched(true);
              (onBlur as ComponentProps<typeof Textarea>['onBlur'])?.(event);
            }}
            className={cn(
              isValid &&
                'border-emerald-500 focus-visible:ring-emerald-500/20 dark:border-emerald-400 dark:focus-visible:ring-emerald-500/30',
              className
            )}
          />
        ) : (
          <Input
            {...(props as Omit<ComponentProps<typeof Input>, 'value' | 'onChange'>)}
            id={id}
            value={normalizedValue}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            data-valid={isValid ? 'true' : undefined}
            onChange={event => {
              setTouched(true);
              onValueChange(event.target.value);
            }}
            onBlur={event => {
              setTouched(true);
              (onBlur as ComponentProps<typeof Input>['onBlur'])?.(event);
            }}
            className={className}
          />
        )
      }
    </FormFieldShell>
  );
}
