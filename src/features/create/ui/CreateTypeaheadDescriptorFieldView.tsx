import { type ReactNode } from 'react';
import { featureThemeClassName } from '@/features/shared/theme';
import { TypeaheadField } from '@/features/shared/ui/form';
import type {
  TypeaheadMultiProps,
  TypeaheadSingleProps,
} from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { cn } from '@/features/shared/utils/utils';
import type { CreateFormFieldDescriptor } from '../types/create-form.types';

type TypeaheadDescriptorField = Extract<CreateFormFieldDescriptor, { kind: 'typeahead' }>;

export interface CreateTypeaheadDescriptorFieldViewProps {
  field: TypeaheadDescriptorField;
  multiple: boolean;
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

export function CreateTypeaheadDescriptorFieldView({
  field,
  multiple,
  invalid,
  isValid,
  hintText,
  onMarkInteracted,
}: CreateTypeaheadDescriptorFieldViewProps) {
  const className = cn(
    isValid && featureThemeClassName('createCreateFieldsSuccessBorderAlpha'),
    field.inputClassName
  );

  if (multiple) {
    const typeaheadProps = field.props as Omit<TypeaheadMultiProps, 'label' | 'className'>;

    return (
      <TypeaheadField
        {...typeaheadProps}
        multiple
        onInteract={() => {
          onMarkInteracted();
          typeaheadProps.onInteract?.();
        }}
        onValuesChange={nextIds => {
          onMarkInteracted();
          typeaheadProps.onValuesChange(nextIds);
        }}
        label={field.label}
        description={invalid ? undefined : hintText}
        error={field.error ?? (invalid ? hintText : undefined)}
        invalid={invalid}
        required={field.required}
        fieldClassName={field.className}
        descriptionClassName={cn('text-xs', getHintToneClass(invalid, isValid))}
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
        onMarkInteracted();
        typeaheadProps.onInteract?.();
      }}
      onChange={item => {
        onMarkInteracted();
        typeaheadProps.onChange(item);
      }}
      label={field.label}
      description={invalid ? undefined : hintText}
      error={field.error ?? (invalid ? hintText : undefined)}
      invalid={invalid}
      required={field.required}
      fieldClassName={field.className}
      descriptionClassName={cn('text-xs', getHintToneClass(invalid, isValid))}
      errorClassName="text-xs"
      className={className}
    />
  );
}
