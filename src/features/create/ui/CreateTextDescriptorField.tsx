import { type ReactNode } from 'react';
import { useCreateDescriptorFieldState } from '@/features/create/hooks/useCreateDescriptorFieldState';
import type { CreateFormFieldDescriptor } from '../types/create-form.types';
import { CreateTextDescriptorFieldView } from './CreateTextDescriptorFieldView';

type TextDescriptorField = Extract<CreateFormFieldDescriptor, { kind: 'text' }>;

interface CreateTextDescriptorFieldProps {
  field: TextDescriptorField;
}

function getDescription(field: { description?: ReactNode; hint?: ReactNode }) {
  return field.description ?? field.hint;
}

export function CreateTextDescriptorField({ field }: CreateTextDescriptorFieldProps) {
  const validationState = useCreateDescriptorFieldState({
    value: field.value,
    hint: getDescription(field),
    required: field.required,
    validator: field.validator,
  });
  const invalid = field.invalid ?? validationState.isInvalid;

  return (
    <CreateTextDescriptorFieldView
      field={field}
      invalid={invalid}
      isValid={validationState.isValid}
      hintText={validationState.hintText}
      onMarkInteracted={validationState.markInteracted}
    />
  );
}
