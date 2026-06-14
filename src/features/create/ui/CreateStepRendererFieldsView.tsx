import { featureThemeClassName } from '@/features/shared/theme';
import type { FocusEvent, ReactNode } from 'react';
import { TextField, TypeaheadField } from '@/features/shared/ui/form';
import type {
  TypeaheadMultiProps,
  TypeaheadSingleProps,
} from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { cn } from '@/features/shared/utils/utils';
import type { CreateFormFieldDescriptor } from '../types/create-form.types';

function getHintToneClass(isInvalid: boolean, isValid: boolean): string {
  if (isInvalid) {
    return 'text-destructive';
  }

  if (isValid) {
    return featureThemeClassName('authNameStepSuccessText');
  }

  return 'text-muted-foreground';
}

interface DescriptorValidationState {
  hintText: ReactNode;
  isInvalid: boolean;
  isValid: boolean;
  markInteracted: () => void;
}

interface CreateTextDescriptorFieldViewProps {
  field: Extract<CreateFormFieldDescriptor, { kind: 'text' }>;
  validationState: DescriptorValidationState;
  invalid: boolean;
}

export function CreateTextDescriptorFieldView({
  field,
  validationState,
  invalid,
}: CreateTextDescriptorFieldViewProps) {
  return (
    <TextField
      label={field.label}
      description={invalid ? undefined : validationState.hintText}
      error={field.error ?? (invalid ? validationState.hintText : undefined)}
      invalid={invalid}
      required={field.required}
      value={field.value}
      onValueChange={value => {
        validationState.markInteracted();
        field.onValueChange(value);
      }}
      onBlur={(event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        validationState.markInteracted();
        field.onBlur?.(event);
      }}
      placeholder={field.placeholder}
      type={field.type}
      autoComplete={field.autoComplete}
      disabled={field.disabled}
      min={field.min}
      max={field.max}
      maxLength={field.maxLength}
      rows={field.rows}
      multiline={field.multiline}
      fieldClassName={field.className}
      descriptionClassName={cn('text-xs', getHintToneClass(invalid, validationState.isValid))}
      errorClassName="text-xs"
      className={cn(
        validationState.isValid && featureThemeClassName('createCreateFieldsSuccessRing'),
        field.inputClassName
      )}
    />
  );
}

interface CreateTypeaheadDescriptorFieldViewProps {
  field: Extract<CreateFormFieldDescriptor, { kind: 'typeahead' }>;
  validationState: DescriptorValidationState;
  invalid: boolean;
  multiple: boolean;
}

export function CreateTypeaheadDescriptorFieldView({
  field,
  validationState,
  invalid,
  multiple,
}: CreateTypeaheadDescriptorFieldViewProps) {
  const className = cn(
    validationState.isValid && featureThemeClassName('createCreateFieldsSuccessBorderAlpha'),
    field.inputClassName
  );

  if (multiple) {
    const typeaheadProps = field.props as Omit<TypeaheadMultiProps, 'label' | 'className'>;

    return (
      <TypeaheadField
        {...typeaheadProps}
        multiple
        onInteract={() => {
          validationState.markInteracted();
          typeaheadProps.onInteract?.();
        }}
        onValuesChange={nextIds => {
          validationState.markInteracted();
          typeaheadProps.onValuesChange(nextIds);
        }}
        label={field.label}
        description={invalid ? undefined : validationState.hintText}
        error={field.error ?? (invalid ? validationState.hintText : undefined)}
        invalid={invalid}
        required={field.required}
        fieldClassName={field.className}
        descriptionClassName={cn('text-xs', getHintToneClass(invalid, validationState.isValid))}
        errorClassName="text-xs"
        className={className}
      />
    );
  }

  const typeaheadProps = field.props as Omit<TypeaheadSingleProps, 'label' | 'className'>;

  return (
    <TypeaheadField
      {...typeaheadProps}
      onInteract={() => {
        validationState.markInteracted();
        typeaheadProps.onInteract?.();
      }}
      onChange={item => {
        validationState.markInteracted();
        typeaheadProps.onChange(item);
      }}
      label={field.label}
      description={invalid ? undefined : validationState.hintText}
      error={field.error ?? (invalid ? validationState.hintText : undefined)}
      invalid={invalid}
      required={field.required}
      fieldClassName={field.className}
      descriptionClassName={cn('text-xs', getHintToneClass(invalid, validationState.isValid))}
      errorClassName="text-xs"
      className={className}
    />
  );
}
