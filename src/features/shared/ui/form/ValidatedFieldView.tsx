import type { ComponentProps, ReactNode } from 'react';

import { getValidationToneClasses } from '@/features/shared/theme';
import { FormFieldShell } from '@/features/shared/ui/form/FormFieldShell';
import { Input } from '@/features/shared/ui/ui/input';
import { Textarea } from '@/features/shared/ui/ui/textarea';
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

export type ValidatedFieldViewProps = (ValidatedInputFieldProps | ValidatedTextareaFieldProps) & {
  normalizedValue: string;
  error: ReactNode;
  isValid: boolean;
  markTouched: () => void;
};

export function ValidatedFieldView({
  label,
  description,
  required,
  value,
  onValueChange,
  className,
  fieldClassName,
  onBlur,
  multiline,
  normalizedValue,
  error,
  isValid,
  markTouched,
  ...props
}: ValidatedFieldViewProps) {
  void value;

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
              markTouched();
              onValueChange(event.target.value);
            }}
            onBlur={event => {
              markTouched();
              (onBlur as ComponentProps<typeof Textarea>['onBlur'])?.(event);
            }}
            className={cn(isValid && getValidationToneClasses('valid'), className)}
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
              markTouched();
              onValueChange(event.target.value);
            }}
            onBlur={event => {
              markTouched();
              (onBlur as ComponentProps<typeof Input>['onBlur'])?.(event);
            }}
            className={className}
          />
        )
      }
    </FormFieldShell>
  );
}
