import type { ComponentProps, ReactNode } from 'react';

import { Input } from '@/features/shared/ui/ui/input';
import { Textarea } from '@/features/shared/ui/ui/textarea';
import { useValidatedFieldController } from '@/features/shared/hooks/useValidatedFieldController';
import { ValidatedFieldView } from './ValidatedFieldView';

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
  const controller = useValidatedFieldController({ description, required, validator, value });

  if (multiline) {
    return (
      <ValidatedFieldView
        label={label}
        description={description}
        required={required}
        validator={validator}
        value={value}
        onValueChange={onValueChange}
        className={className}
        fieldClassName={fieldClassName}
        onBlur={onBlur as ComponentProps<typeof Textarea>['onBlur']}
        multiline
        {...(props as Omit<ComponentProps<typeof Textarea>, 'value' | 'onChange'>)}
        {...controller}
      />
    );
  }

  return (
    <ValidatedFieldView
      label={label}
      description={description}
      required={required}
      validator={validator}
      value={value}
      onValueChange={onValueChange}
      className={className}
      fieldClassName={fieldClassName}
      onBlur={onBlur as ComponentProps<typeof Input>['onBlur']}
      multiline={false}
      {...(props as Omit<ComponentProps<typeof Input>, 'value' | 'onChange'>)}
      {...controller}
    />
  );
}
