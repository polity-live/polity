import { useId, useState, type ComponentProps } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Input } from '@/features/shared/ui/ui/input';
import { Textarea } from '@/features/shared/ui/ui/textarea';
import { FormFieldShell } from '@/features/shared/ui/form';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead';
import type {
  TypeaheadMultiProps,
  TypeaheadSingleProps,
} from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { cn } from '@/features/shared/utils/utils';

type CreateFieldValidator = (value: string) => string | null;

interface CreateFieldBaseProps {
  label?: string;
  hint?: string;
  required?: boolean;
  validator?: CreateFieldValidator;
  containerClassName?: string;
  labelClassName?: string;
  hintClassName?: string;
}

interface CreateInputFieldProps
  extends Omit<ComponentProps<typeof Input>, 'value' | 'onChange'>, CreateFieldBaseProps {
  value: string | number | null | undefined;
  onValueChange: (value: string) => void;
}

interface CreateTextareaFieldProps
  extends Omit<ComponentProps<typeof Textarea>, 'value' | 'onChange'>, CreateFieldBaseProps {
  value: string | number | null | undefined;
  onValueChange: (value: string) => void;
}

type CreateTypeaheadFieldProps =
  | ((Omit<TypeaheadSingleProps, 'label' | 'className' | 'onInteract'> & CreateFieldBaseProps) & {
      className?: string;
    })
  | ((Omit<TypeaheadMultiProps, 'label' | 'className' | 'onInteract'> & CreateFieldBaseProps) & {
      className?: string;
    });

function normalizeValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

function getHintToneClass(isInvalid: boolean, isValid: boolean): string {
  if (isInvalid) {
    return 'text-destructive';
  }

  if (isValid) {
    return 'text-emerald-600 dark:text-emerald-400';
  }

  return 'text-muted-foreground';
}

function useCreateFieldState(
  value: string | number | null | undefined,
  hint: string | undefined,
  required: boolean | undefined,
  validator: CreateFieldValidator | undefined
) {
  const { t } = useTranslation();
  const [hasInteracted, setHasInteracted] = useState(false);
  const normalizedValue = normalizeValue(value);
  const trimmedValue = normalizedValue.trim();
  const hasValue = trimmedValue.length > 0;
  const validationError = validator?.(normalizedValue) ?? null;
  const isInvalid =
    hasInteracted && ((Boolean(required) && !hasValue) || (hasValue && Boolean(validationError)));
  const isValid = (hasInteracted || hasValue) && hasValue && !validationError;
  const fallbackHint =
    hint ??
    (required ? t('pages.create.common.requiredHint') : t('pages.create.common.optionalHint'));
  const hintText = isInvalid
    ? Boolean(required) && !hasValue
      ? t('pages.create.common.requiredHint')
      : (validationError ?? fallbackHint)
    : isValid && !hint
      ? t('pages.create.common.validHint')
      : fallbackHint;

  return {
    hintText,
    isInvalid,
    isValid,
    markInteracted: () => setHasInteracted(true),
  };
}

export function CreateInputField({
  id,
  label,
  hint,
  required,
  validator,
  value,
  onValueChange,
  containerClassName,
  labelClassName,
  hintClassName,
  className,
  onBlur,
  ...inputProps
}: CreateInputFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const { hintText, isInvalid, isValid, markInteracted } = useCreateFieldState(
    value,
    hint,
    required,
    validator
  );

  return (
    <FormFieldShell
      id={inputId}
      label={label}
      required={required}
      description={isInvalid ? undefined : hintText}
      error={isInvalid ? hintText : undefined}
      className={containerClassName}
      labelClassName={labelClassName}
      descriptionClassName={cn('text-xs', hintClassName ?? getHintToneClass(isInvalid, isValid))}
      errorClassName={cn('text-xs', hintClassName)}
    >
      {({ id, describedBy }) => (
        <Input
          {...inputProps}
          id={id}
          value={normalizeValue(value)}
          aria-describedby={describedBy}
          onChange={event => {
            markInteracted();
            onValueChange(event.target.value);
          }}
          onBlur={event => {
            markInteracted();
            onBlur?.(event);
          }}
          aria-invalid={isInvalid || undefined}
          data-valid={isValid ? 'true' : undefined}
          className={cn(
            isValid && 'focus-visible:ring-emerald-500/20 dark:focus-visible:ring-emerald-500/30',
            className
          )}
        />
      )}
    </FormFieldShell>
  );
}

export function CreateTextareaField({
  id,
  label,
  hint,
  required,
  validator,
  value,
  onValueChange,
  containerClassName,
  labelClassName,
  hintClassName,
  className,
  onBlur,
  ...textareaProps
}: CreateTextareaFieldProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const { hintText, isInvalid, isValid, markInteracted } = useCreateFieldState(
    value,
    hint,
    required,
    validator
  );

  return (
    <FormFieldShell
      id={textareaId}
      label={label}
      required={required}
      description={isInvalid ? undefined : hintText}
      error={isInvalid ? hintText : undefined}
      className={containerClassName}
      labelClassName={labelClassName}
      descriptionClassName={cn('text-xs', hintClassName ?? getHintToneClass(isInvalid, isValid))}
      errorClassName={cn('text-xs', hintClassName)}
    >
      {({ id, describedBy }) => (
        <Textarea
          {...textareaProps}
          id={id}
          value={normalizeValue(value)}
          aria-describedby={describedBy}
          onChange={event => {
            markInteracted();
            onValueChange(event.target.value);
          }}
          onBlur={event => {
            markInteracted();
            onBlur?.(event);
          }}
          aria-invalid={isInvalid || undefined}
          data-valid={isValid ? 'true' : undefined}
          className={cn(
            isInvalid &&
              'border-destructive focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
            isValid &&
              'border-emerald-500 focus-visible:ring-emerald-500/20 dark:border-emerald-400 dark:focus-visible:ring-emerald-500/30',
            className
          )}
        />
      )}
    </FormFieldShell>
  );
}

export function CreateTypeaheadField({
  label,
  hint,
  required,
  containerClassName,
  labelClassName,
  hintClassName,
  className,
  ...typeaheadProps
}: CreateTypeaheadFieldProps) {
  const multiple = typeaheadProps.multiple === true;
  const fieldValue = multiple
    ? (
        typeaheadProps as Omit<TypeaheadMultiProps, 'label' | 'className' | 'onInteract'>
      ).values.join(' ')
    : ((typeaheadProps as Omit<TypeaheadSingleProps, 'label' | 'className' | 'onInteract'>).value ??
      '');
  const { hintText, isInvalid, isValid, markInteracted } = useCreateFieldState(
    fieldValue,
    hint,
    required,
    undefined
  );

  return (
    <FormFieldShell
      label={label}
      required={required}
      description={isInvalid ? undefined : hintText}
      error={isInvalid ? hintText : undefined}
      className={containerClassName}
      labelClassName={labelClassName}
      descriptionClassName={cn('text-xs', hintClassName ?? getHintToneClass(isInvalid, isValid))}
      errorClassName={cn('text-xs', hintClassName)}
    >
      {() =>
        multiple
          ? (() => {
              const multiProps = typeaheadProps as Omit<
                TypeaheadMultiProps,
                'label' | 'className' | 'onInteract'
              >;

              return (
                <TypeaheadSearch
                  {...multiProps}
                  multiple
                  onInteract={markInteracted}
                  onValuesChange={nextIds => {
                    markInteracted();
                    multiProps.onValuesChange(nextIds);
                  }}
                  className={cn(
                    isInvalid &&
                      '[&_[data-slot=input]]:border-destructive [&_[data-slot=input]]:focus-visible:ring-destructive/20 dark:[&_[data-slot=input]]:focus-visible:ring-destructive/40 [&_[data-slot=typeahead-selected]]:border-destructive [&_[data-slot=typeahead-selected-list]]:border-destructive',
                    isValid &&
                      '[&_[data-slot=input]]:border-emerald-500 [&_[data-slot=input]]:focus-visible:ring-emerald-500/20 dark:[&_[data-slot=input]]:border-emerald-400 dark:[&_[data-slot=input]]:focus-visible:ring-emerald-500/30 [&_[data-slot=typeahead-selected]]:border-emerald-500 dark:[&_[data-slot=typeahead-selected]]:border-emerald-400',
                    className
                  )}
                />
              );
            })()
          : (() => {
              const singleProps = typeaheadProps as Omit<
                TypeaheadSingleProps,
                'label' | 'className' | 'onInteract'
              >;

              return (
                <TypeaheadSearch
                  {...singleProps}
                  onInteract={markInteracted}
                  onChange={item => {
                    markInteracted();
                    singleProps.onChange(item);
                  }}
                  className={cn(
                    isInvalid &&
                      '[&_[data-slot=input]]:border-destructive [&_[data-slot=input]]:focus-visible:ring-destructive/20 dark:[&_[data-slot=input]]:focus-visible:ring-destructive/40 [&_[data-slot=typeahead-selected]]:border-destructive',
                    isValid &&
                      '[&_[data-slot=input]]:border-emerald-500 [&_[data-slot=input]]:focus-visible:ring-emerald-500/20 dark:[&_[data-slot=input]]:border-emerald-400 dark:[&_[data-slot=input]]:focus-visible:ring-emerald-500/30 [&_[data-slot=typeahead-selected]]:border-emerald-500 dark:[&_[data-slot=typeahead-selected]]:border-emerald-400',
                    className
                  )}
                />
              );
            })()
      }
    </FormFieldShell>
  );
}
