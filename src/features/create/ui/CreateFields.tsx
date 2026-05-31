import { useId, useState, type ComponentProps } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Label } from '@/features/shared/ui/ui/label';
import { Input } from '@/features/shared/ui/ui/input';
import { Textarea } from '@/features/shared/ui/ui/textarea';
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
    (required
      ? t('pages.create.common.requiredHint', 'Required.')
      : t('pages.create.common.optionalHint', 'Optional.'));
  const hintText = isInvalid
    ? Boolean(required) && !hasValue
      ? t('pages.create.common.requiredHint', 'Required.')
      : (validationError ?? fallbackHint)
    : isValid && !hint
      ? t('pages.create.common.validHint', 'Looks good.')
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
    <div className={cn('space-y-2', containerClassName)}>
      {label ? (
        <Label htmlFor={inputId} className={labelClassName}>
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </Label>
      ) : null}
      <Input
        {...inputProps}
        id={inputId}
        value={normalizeValue(value)}
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
      <p className={cn('text-xs', hintClassName ?? getHintToneClass(isInvalid, isValid))}>
        {hintText}
      </p>
    </div>
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
    <div className={cn('space-y-2', containerClassName)}>
      {label ? (
        <Label htmlFor={textareaId} className={labelClassName}>
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </Label>
      ) : null}
      <Textarea
        {...textareaProps}
        id={textareaId}
        value={normalizeValue(value)}
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
      <p className={cn('text-xs', hintClassName ?? getHintToneClass(isInvalid, isValid))}>
        {hintText}
      </p>
    </div>
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
    <div className={cn('space-y-2', containerClassName)}>
      {label ? (
        <Label className={labelClassName}>
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </Label>
      ) : null}
      {multiple
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
          })()}
      <p className={cn('text-xs', hintClassName ?? getHintToneClass(isInvalid, isValid))}>
        {hintText}
      </p>
    </div>
  );
}
