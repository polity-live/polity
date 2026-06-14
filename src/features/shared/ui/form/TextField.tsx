import { type ComponentProps, type ReactNode } from 'react';

import { FormFieldShell } from '@/features/shared/ui/form/FormFieldShell';
import { Input } from '@/features/shared/ui/ui/input';
import { Textarea } from '@/features/shared/ui/ui/textarea';
import { cn } from '@/features/shared/utils/utils';

interface TextFieldBaseProps {
  label?: ReactNode;
  labelAction?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  invalid?: boolean;
  required?: boolean;
  fieldClassName?: string;
  labelClassName?: string;
  descriptionClassName?: string;
  errorClassName?: string;
  inputClassName?: string;
  value: string | number | null | undefined;
  onValueChange: (value: string) => void;
}

type TextInputFieldProps = TextFieldBaseProps &
  Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
    multiline?: false;
  };

type TextareaFieldProps = TextFieldBaseProps &
  Omit<ComponentProps<typeof Textarea>, 'value' | 'onChange'> & {
    multiline: true;
  };

export type TextFieldProps = TextInputFieldProps | TextareaFieldProps;

function normalizeValue(value: string | number | null | undefined): string {
  return value == null ? '' : String(value);
}

export function TextField({
  label,
  description,
  error,
  invalid,
  required,
  fieldClassName,
  labelAction,
  labelClassName,
  descriptionClassName,
  errorClassName,
  inputClassName,
  value,
  onValueChange,
  onBlur,
  multiline,
  className,
  ...props
}: TextFieldProps) {
  const normalizedValue = normalizeValue(value);

  return (
    <FormFieldShell
      id={props.id}
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
      {({ id, describedBy, invalid }) =>
        multiline ? (
          <Textarea
            {...(props as Omit<ComponentProps<typeof Textarea>, 'value' | 'onChange'>)}
            id={id}
            value={normalizedValue}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            onChange={event => onValueChange(event.target.value)}
            onBlur={event => (onBlur as ComponentProps<typeof Textarea>['onBlur'])?.(event)}
            required={required}
            className={cn(className, inputClassName)}
          />
        ) : (
          <Input
            {...(props as Omit<ComponentProps<typeof Input>, 'value' | 'onChange'>)}
            id={id}
            value={normalizedValue}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            onChange={event => onValueChange(event.target.value)}
            onBlur={event => (onBlur as ComponentProps<typeof Input>['onBlur'])?.(event)}
            required={required}
            className={cn(className, inputClassName)}
          />
        )
      }
    </FormFieldShell>
  );
}
