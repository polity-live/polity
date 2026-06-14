import { Eye, EyeOff } from 'lucide-react';
import { useState, type ComponentProps, type ReactNode } from 'react';

import { FormFieldShell } from '@/features/shared/ui/form/FormFieldShell';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { cn } from '@/features/shared/utils/utils';

interface PasswordFieldProps extends Omit<ComponentProps<typeof Input>, 'type'> {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  fieldClassName?: string;
  showPasswordLabel?: string;
  hidePasswordLabel?: string;
}

export function PasswordField({
  label,
  description,
  error,
  fieldClassName,
  showPasswordLabel = 'Show password',
  hidePasswordLabel = 'Hide password',
  className,
  ...props
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <FormFieldShell
      label={label}
      description={description}
      error={error}
      className={fieldClassName}
    >
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <Input
            {...props}
            id={id}
            type={isVisible ? 'text' : 'password'}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cn('pr-10', className)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
            onClick={() => setIsVisible(value => !value)}
          >
            {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            <span className="sr-only">{isVisible ? hidePasswordLabel : showPasswordLabel}</span>
          </Button>
        </div>
      )}
    </FormFieldShell>
  );
}
