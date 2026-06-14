import { featureThemeClassName } from '@/features/shared/theme';
import { useState, type FocusEvent, type ReactNode } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { FieldGrid, FieldList, TextField, TypeaheadField } from '@/features/shared/ui/form';
import type {
  TypeaheadMultiProps,
  TypeaheadSingleProps,
} from '@/features/shared/ui/typeahead/TypeaheadSearch';
import { cn } from '@/features/shared/utils/utils';
import type {
  CreateFormFieldDescriptor,
  CreateFormSectionDescriptor,
  CreateFormStep,
} from '../types/create-form.types';

interface CreateStepRendererProps {
  step: CreateFormStep;
}

function getDescription(field: { description?: ReactNode; hint?: ReactNode }) {
  return field.description ?? field.hint;
}

function normalizeValue(value: string | number | null | undefined): string {
  return value == null ? '' : String(value);
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

function useCreateDescriptorFieldState({
  value,
  hint,
  required,
  validator,
}: {
  value: string | number | null | undefined;
  hint?: ReactNode;
  required?: boolean;
  validator?: (value: string) => string | null;
}) {
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

function CreateFieldRenderer({ field }: { field: CreateFormFieldDescriptor }) {
  if (field.kind === 'custom') {
    return <div className={field.className}>{field.node}</div>;
  }

  if (field.kind === 'typeahead') {
    return <CreateTypeaheadDescriptorField field={field} />;
  }

  return <CreateTextDescriptorField field={field} />;
}

function CreateTextDescriptorField({
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

function CreateTypeaheadDescriptorField({
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

function CreateSectionRenderer({ section }: { section: CreateFormSectionDescriptor }) {
  const Fields = section.layout === 'grid' ? FieldGrid : FieldList;

  return (
    <section className={cn('space-y-4', section.className)}>
      {section.title || section.description ? (
        <div className="space-y-1">
          {section.title ? <h3 className="text-sm font-medium">{section.title}</h3> : null}
          {section.description ? (
            <p className="text-muted-foreground text-sm">{section.description}</p>
          ) : null}
        </div>
      ) : null}
      <Fields>
        {section.fields.map(field => (
          <CreateFieldRenderer key={field.key} field={field} />
        ))}
      </Fields>
    </section>
  );
}

export function CreateStepRenderer({ step }: CreateStepRendererProps) {
  if (step.sections?.length) {
    return (
      <FieldList>
        {step.sections.map(section => (
          <CreateSectionRenderer key={section.key} section={section} />
        ))}
      </FieldList>
    );
  }

  if (step.fields?.length) {
    return (
      <FieldList>
        {step.fields.map(field => (
          <CreateFieldRenderer key={field.key} field={field} />
        ))}
      </FieldList>
    );
  }

  return <>{step.content}</>;
}
