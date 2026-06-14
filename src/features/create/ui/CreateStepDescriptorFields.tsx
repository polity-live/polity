import type { ReactNode } from 'react';
import { useCreateDescriptorFieldState } from '@/features/create/hooks/useCreateDescriptorFieldState';
import type {
  TypeaheadMultiProps,
  TypeaheadSingleProps,
} from '@/features/shared/ui/typeahead/TypeaheadSearch';
import type { CreateFormFieldDescriptor } from '../types/create-form.types';
import {
  CreateTextDescriptorFieldView,
  CreateTypeaheadDescriptorFieldView,
} from './CreateStepRendererFieldsView';

function getDescription(field: { description?: ReactNode; hint?: ReactNode }) {
  return field.description ?? field.hint;
}

export function CreateTextDescriptorField({
  field,
}: {
  field: Extract<CreateFormFieldDescriptor, { kind: 'text' }>;
}) {
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
      validationState={validationState}
      invalid={invalid}
    />
  );
}

export function CreateTypeaheadDescriptorField({
  field,
}: {
  field: Extract<CreateFormFieldDescriptor, { kind: 'typeahead' }>;
}) {
  const multiple = field.props.multiple === true;
  const fieldValue = multiple
    ? (field.props as Omit<TypeaheadMultiProps, 'label' | 'className'>).values.join(' ')
    : ((field.props as Omit<TypeaheadSingleProps, 'label' | 'className'>).value ?? '');
  const validationState = useCreateDescriptorFieldState({
    value: fieldValue,
    hint: getDescription(field),
    required: field.required,
  });
  const invalid = field.invalid ?? validationState.isInvalid;

  return (
    <CreateTypeaheadDescriptorFieldView
      field={field}
      validationState={validationState}
      invalid={invalid}
      multiple={multiple}
    />
  );
}
