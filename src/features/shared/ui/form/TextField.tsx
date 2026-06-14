import { type ComponentProps, type ReactNode } from 'react';

import { FormFieldShell } from '@/features/shared/ui/form/FormFieldShell';
import { Input } from '@/features/shared/ui/ui/input';
import { Textarea } from '@/features/shared/ui/ui/textarea';
import { cn } from '@/features/shared/utils/utils';

interface TextFieldBaseProps {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  invalid?: boolean;
  fieldClassName?: string;
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
  fieldClassName,
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
      description={description}
      error={error}
      invalid={invalid}
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
            onChange={event => onValueChange(event.target.value)}
            onBlur={event => (onBlur as ComponentProps<typeof Textarea>['onBlur'])?.(event)}
            className={cn(className)}
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
            className={cn(className)}
          />
        )
      }
    </FormFieldShell>
  );
}
