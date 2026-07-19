import { type FocusEvent, type ReactNode } from 'react';
import { featureThemeClassName } from '@/features/shared/theme';
import { TextField } from '@/features/shared/ui/form';
import { cn } from '@/features/shared/utils/utils';
import type { CreateFormFieldDescriptor } from '../types/create-form.types';

type TextDescriptorField = Extract<CreateFormFieldDescriptor, { kind: 'text' }>;

export interface CreateTextDescriptorFieldViewProps {
  field: TextDescriptorField;
  invalid: boolean;
  isValid: boolean;
  hintText?: ReactNode;
  onMarkInteracted: () => void;
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

export function CreateTextDescriptorFieldView({
  field,
  invalid,
  isValid,
  hintText,
  onMarkInteracted,
}: CreateTextDescriptorFieldViewProps) {
  return (
    <TextField
      label={field.label}
      description={invalid ? undefined : hintText}
      error={field.error ?? (invalid ? hintText : undefined)}
      invalid={invalid}
      required={field.required}
      value={field.value}
      onValueChange={value => {
        onMarkInteracted();
        field.onValueChange(value);
      }}
      onBlur={(event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onMarkInteracted();
        field.onBlur?.(event);
      }}
      placeholder={field.placeholder}
      type={field.type}
      autoComplete={field.autoComplete}
      disabled={field.disabled}
      min={field.min}
      max={field.max}
      step={field.step}
      maxLength={field.maxLength}
      rows={field.rows}
      multiline={field.multiline}
      fieldClassName={field.className}
      descriptionClassName={cn('text-xs', getHintToneClass(invalid, isValid))}
      errorClassName="text-xs"
      className={cn(
        isValid && featureThemeClassName('createCreateFieldsSuccessRing'),
        field.inputClassName
      )}
    />
  );
}
