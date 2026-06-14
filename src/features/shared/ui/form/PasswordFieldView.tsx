import { Eye, EyeOff } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { FormFieldShell } from '@/features/shared/ui/form/FormFieldShell';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { cn } from '@/features/shared/utils/utils';

interface PasswordFieldViewProps extends Omit<ComponentProps<typeof Input>, 'type'> {
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
  showPasswordLabel: string;
  hidePasswordLabel: string;
  isVisible: boolean;
  onVisibilityToggle: () => void;
}

export function PasswordFieldView({
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
  showPasswordLabel,
  hidePasswordLabel,
  isVisible,
  onVisibilityToggle,
  className,
  id,
  onChange,
  ...props
}: PasswordFieldViewProps) {
  return (
    <FormFieldShell
      id={id}
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
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <Input
            {...props}
            id={id}
            type={isVisible ? 'text' : 'password'}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            required={required}
            onChange={event => {
              onValueChange?.(event.target.value);
              onChange?.(event);
            }}
            className={cn('pr-10', className, inputClassName)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
            onClick={onVisibilityToggle}
          >
            {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            <span className="sr-only">{isVisible ? hidePasswordLabel : showPasswordLabel}</span>
          </Button>
        </div>
      )}
    </FormFieldShell>
  );
}
