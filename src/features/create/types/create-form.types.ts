import type { ComponentProps, ComponentType, FocusEvent, ReactNode } from 'react';
import type { ContentType } from '@/features/timeline/constants/content-type-config';
import type {
  TypeaheadMultiProps,
  TypeaheadSingleProps,
} from '@/features/shared/ui/typeahead/TypeaheadSearch';

interface CreateDescriptorBase {
  key: string;
  className?: string;
}

interface CreateTextFieldDescriptor extends CreateDescriptorBase {
  kind: 'text';
  label?: ReactNode;
  hint?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  invalid?: boolean;
  required?: boolean;
  validator?: (value: string) => string | null;
  value: string | number | null | undefined;
  onValueChange: (value: string) => void;
  placeholder?: string;
  type?: ComponentProps<'input'>['type'];
  autoComplete?: string;
  disabled?: boolean;
  min?: string | number;
  max?: string | number;
  maxLength?: number;
  rows?: number;
  multiline?: boolean;
  inputClassName?: string;
  onBlur?: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

interface CreateTypeaheadFieldDescriptor extends CreateDescriptorBase {
  kind: 'typeahead';
  label?: ReactNode;
  hint?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  invalid?: boolean;
  required?: boolean;
  inputClassName?: string;
  props:
    | Omit<TypeaheadSingleProps, 'label' | 'className'>
    | Omit<TypeaheadMultiProps, 'label' | 'className'>;
}

interface CreateCustomFieldDescriptor extends CreateDescriptorBase {
  kind: 'custom';
  node: ReactNode;
}

interface CreateCustomComponentFieldDescriptor extends CreateDescriptorBase {
  kind: 'customComponent';
  component: ComponentType<any>;
  props?: Record<string, unknown>;
}

export type CreateFormFieldDescriptor =
  | CreateTextFieldDescriptor
  | CreateTypeaheadFieldDescriptor
  | CreateCustomFieldDescriptor
  | CreateCustomComponentFieldDescriptor;

export interface CreateFormSectionDescriptor {
  key: string;
  title?: ReactNode;
  description?: ReactNode;
  fields: CreateFormFieldDescriptor[];
  className?: string;
  layout?: 'list' | 'grid';
}

/** A single step in a create form */
export interface CreateFormStep {
  /** i18n key for the step label shown in the progress indicator */
  label: string;
  /** Neutral field descriptors rendered by CreateStepRenderer. */
  fields?: CreateFormFieldDescriptor[];
  /** Optional grouped descriptors rendered by CreateStepRenderer. */
  sections?: CreateFormSectionDescriptor[];
  /** Legacy escape hatch while hooks migrate away from inline JSX. */
  content?: ReactNode;
  /** Returns true if all required fields in this step are valid */
  isValid: () => boolean;
  /** Whether this step is optional (skippable) */
  optional?: boolean;
}

/** Configuration for a create form */
export interface CreateFormConfig {
  /** Entity type for color coding and review card gradient */
  entityType: ContentType;
  /** Array of form steps (last one is typically the review step) */
  steps: CreateFormStep[];
  /** Handler called when the user clicks "Create" on the review step */
  onSubmit: () => Promise<void>;
  /** Whether the form is currently submitting */
  isSubmitting: boolean;
  /** i18n key for the form title */
  title: string;
}

/** The three form display styles */
export type FormStyle = 'one_page' | 'carousel' | 'auto';

/** The resolved display mode (after resolving 'auto') */
export type ResolvedFormMode = 'one_page' | 'carousel';
