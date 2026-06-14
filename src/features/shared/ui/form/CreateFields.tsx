import { featureThemeClassName } from '@/features/shared/theme';
import { useId, useState, type ComponentProps } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { FormControlInput, FormControlTextarea } from '@/features/shared/ui/form/FormControls';
import { FormFieldShell } from '@/features/shared/ui/form/FormFieldShell';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead';
import type {
  TypeaheadMultiProps,
  TypeaheadSingleProps,
} from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { cn } from '@/features/shared/utils/utils';

export type CreateFieldValidator = (value: string) => string | null;

interface CreateFieldBaseProps {
  label?: string;
  hint?: string;
  required?: boolean;
  validator?: CreateFieldValidator;
  containerClassName?: string;
  labelClassName?: string;
  hintClassName?: string;
}

export interface CreateInputFieldProps
  extends
    Omit<ComponentProps<typeof FormControlInput>, 'value' | 'onChange'>,
    CreateFieldBaseProps {
  value: string | number | null | undefined;
  onValueChange: (value: string) => void;
}

export interface CreateTextareaFieldProps
  extends
    Omit<ComponentProps<typeof FormControlTextarea>, 'value' | 'onChange'>,
    CreateFieldBaseProps {
  value: string | number | null | undefined;
  onValueChange: (value: string) => void;
}

export type CreateTypeaheadFieldProps =
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
    return featureThemeClassName('authNameStepSuccessText');
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
        <FormControlInput
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
            isValid && featureThemeClassName('createCreateFieldsSuccessRing'),
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
        <FormControlTextarea
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
            isInvalid && featureThemeClassName('createCreateFieldsThemedBorder'),
            isValid && featureThemeClassName('createCreateFieldsSuccessBorder'),
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
                    isInvalid && featureThemeClassName('createCreateFieldsThemedBorderAlpha'),
                    isValid && featureThemeClassName('createCreateFieldsSuccessBorderAlpha'),
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
                    isInvalid && featureThemeClassName('createCreateFieldsThemedBorderBeta'),
                    isValid && featureThemeClassName('createCreateFieldsSuccessBorderAlpha'),
                    className
                  )}
                />
              );
            })()
      }
    </FormFieldShell>
  );
}
