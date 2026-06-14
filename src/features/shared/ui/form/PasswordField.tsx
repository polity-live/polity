import type { ComponentProps, ReactNode } from 'react';

import { Input } from '@/features/shared/ui/ui/input';
import { usePasswordFieldController } from '@/features/shared/hooks/usePasswordFieldController';
import { PasswordFieldView } from './PasswordFieldView';

interface PasswordFieldProps extends Omit<ComponentProps<typeof Input>, 'type'> {
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
  onValueChange?: (value: string) => void;
  showPasswordLabel?: string;
  hidePasswordLabel?: string;
}

export function PasswordField({
  label,
  labelAction,
  description,
  error,
  invalid,
  required,
  fieldClassName,
  labelClassName,
  descriptionClassName,
  errorClassName,
  inputClassName,
  onValueChange,
  showPasswordLabel = 'Show password',
  hidePasswordLabel = 'Hide password',
  className,
  id,
  onChange,
  ...props
}: PasswordFieldProps) {
  return (
    <PasswordFieldView
      label={label}
      labelAction={labelAction}
      description={description}
      error={error}
      invalid={invalid}
      required={required}
      fieldClassName={fieldClassName}
      labelClassName={labelClassName}
      descriptionClassName={descriptionClassName}
      errorClassName={errorClassName}
      inputClassName={inputClassName}
      onValueChange={onValueChange}
      showPasswordLabel={showPasswordLabel}
      hidePasswordLabel={hidePasswordLabel}
      className={className}
      id={id}
      onChange={onChange}
      {...props}
      {...usePasswordFieldController()}
    />
  );
}
