import { type ReactNode } from 'react';

import { FormFieldShell } from '@/features/shared/ui/form/FormFieldShell';
import {
  TypeaheadSearch,
  type TypeaheadMultiProps,
  type TypeaheadSingleProps,
} from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { cn } from '@/features/shared/utils/utils';

type TypeaheadFieldProps =
  | (Omit<TypeaheadSingleProps, 'label' | 'className'> & {
      label?: ReactNode;
      description?: ReactNode;
      required?: boolean;
      error?: ReactNode;
      className?: string;
      fieldClassName?: string;
    })
  | (Omit<TypeaheadMultiProps, 'label' | 'className'> & {
      label?: ReactNode;
      description?: ReactNode;
      required?: boolean;
      error?: ReactNode;
      className?: string;
      fieldClassName?: string;
    });

export function TypeaheadField({
  label,
  description,
  required,
  error,
  className,
  fieldClassName,
  ...typeaheadProps
}: TypeaheadFieldProps) {
  return (
    <FormFieldShell
      label={label}
      description={description}
      error={error}
      required={required}
      className={fieldClassName}
    >
      {({ invalid }) => (
        <TypeaheadSearch
          {...(typeaheadProps as TypeaheadSingleProps | TypeaheadMultiProps)}
          className={cn(
            invalid &&
              '[&_[data-slot=input]]:border-destructive [&_[data-slot=input]]:focus-visible:ring-destructive/20 dark:[&_[data-slot=input]]:focus-visible:ring-destructive/40 [&_[data-slot=typeahead-selected]]:border-destructive',
            className
          )}
        />
      )}
    </FormFieldShell>
  );
}
