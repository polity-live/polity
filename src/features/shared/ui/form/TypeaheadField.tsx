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
      labelAction?: ReactNode;
      description?: ReactNode;
      required?: boolean;
      error?: ReactNode;
      invalid?: boolean;
      className?: string;
      fieldClassName?: string;
      labelClassName?: string;
      descriptionClassName?: string;
      errorClassName?: string;
    })
  | (Omit<TypeaheadMultiProps, 'label' | 'className'> & {
      label?: ReactNode;
      labelAction?: ReactNode;
      description?: ReactNode;
      required?: boolean;
      error?: ReactNode;
      invalid?: boolean;
      className?: string;
      fieldClassName?: string;
      labelClassName?: string;
      descriptionClassName?: string;
      errorClassName?: string;
    });

export function TypeaheadField({
  label,
  labelAction,
  description,
  required,
  error,
  invalid,
  className,
  fieldClassName,
  labelClassName,
  descriptionClassName,
  errorClassName,
  ...typeaheadProps
}: TypeaheadFieldProps) {
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
