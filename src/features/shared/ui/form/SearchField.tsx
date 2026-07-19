import { Search, X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { FormFieldShell } from '@/features/shared/ui/form/FormFieldShell';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { cn } from '@/features/shared/utils/utils';

interface SearchFieldProps extends Omit<
  ComponentProps<typeof Input>,
  'type' | 'value' | 'onChange'
> {
  value: string;
  onValueChange: (value: string) => void;
  label?: ReactNode;
  labelAction?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  invalid?: boolean;
  required?: boolean;
  clearLabel?: string;
  emptyEndAdornment?: ReactNode;
  fieldClassName?: string;
  labelClassName?: string;
  descriptionClassName?: string;
  errorClassName?: string;
  inputClassName?: string;
}

export function SearchField({
  value,
  onValueChange,
  label,
  labelAction,
  description,
  error,
  invalid,
  required,
  clearLabel = 'Clear search',
  emptyEndAdornment,
  fieldClassName,
  labelClassName,
  descriptionClassName,
  errorClassName,
  inputClassName,
  className,
  ...props
}: SearchFieldProps) {
  const showEmptyEndAdornment = !value && Boolean(emptyEndAdornment);

  return (
    <FormFieldShell
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
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            {...props}
            id={id}
            type="search"
            value={value}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            onChange={event => onValueChange(event.target.value)}
            required={required}
            className={cn(
              'pl-9',
              showEmptyEndAdornment ? 'pr-20' : 'pr-9',
              className,
              inputClassName
            )}
          />
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
              onClick={() => onValueChange('')}
            >
              <X className="size-4" />
              <span className="sr-only">{clearLabel}</span>
            </Button>
          ) : showEmptyEndAdornment ? (
            <div className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
              {emptyEndAdornment}
            </div>
          ) : null}
        </div>
      )}
    </FormFieldShell>
  );
}
