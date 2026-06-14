import { type ReactNode } from 'react';
import { useCreateDescriptorFieldState } from '@/features/create/hooks/useCreateDescriptorFieldState';
import type {
  TypeaheadMultiProps,
  TypeaheadSingleProps,
} from '@/features/shared/ui/typeahead/TypeaheadSearch';
import type { CreateFormFieldDescriptor } from '../types/create-form.types';
import { CreateTypeaheadDescriptorFieldView } from './CreateTypeaheadDescriptorFieldView';

type TypeaheadDescriptorField = Extract<CreateFormFieldDescriptor, { kind: 'typeahead' }>;

interface CreateTypeaheadDescriptorFieldProps {
  field: TypeaheadDescriptorField;
}

function getDescription(field: { description?: ReactNode; hint?: ReactNode }) {
  return field.description ?? field.hint;
}

export function CreateTypeaheadDescriptorField({ field }: CreateTypeaheadDescriptorFieldProps) {
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
      multiple={multiple}
      invalid={invalid}
      isValid={validationState.isValid}
      hintText={validationState.hintText}
      onMarkInteracted={validationState.markInteracted}
    />
  );
}
