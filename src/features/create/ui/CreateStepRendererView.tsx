import { FieldGrid, FieldList } from '@/features/shared/ui/form';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { ReactNode } from 'react';
import { cn } from '@/features/shared/utils/utils';
import type {
  CreateFormFieldDescriptor,
  CreateFormSectionDescriptor,
  CreateFormStep,
} from '../types/create-form.types';
import { CreateTextDescriptorField } from './CreateTextDescriptorField';
import { CreateTypeaheadDescriptorField } from './CreateTypeaheadDescriptorField';
function CreateFieldRenderer({ field }: { field: CreateFormFieldDescriptor }) {
  if (field.kind === 'custom') {
    return (
      <div
        className={field.className}
        data-create-field={field.key}
        data-create-field-kind={field.kind}
      >
        {field.node}
      </div>
    );
  }

  if (field.kind === 'customComponent') {
    const Component = field.component;
    return (
      <div
        className={field.className}
        data-create-field={field.key}
        data-create-field-kind={field.kind}
      >
        <Component {...(field.props ?? {})} />
      </div>
    );
  }

  if (field.kind === 'typeahead') {
    return (
      <div data-create-field={field.key} data-create-field-kind={field.kind}>
        <CreateTypeaheadDescriptorField field={field} />
      </div>
    );
  }

  return (
    <div data-create-field={field.key} data-create-field-kind={field.kind}>
      <CreateTextDescriptorField field={field} />
    </div>
  );
}

function OptionalDetails({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <details className="group border-border/60 rounded-md border px-3 py-2">
      <summary className="marker:text-muted-foreground cursor-pointer py-1 text-sm font-medium">
        {label}
      </summary>
      <div className="pt-4 pb-2">{children}</div>
    </details>
  );
}

function CreateSectionRenderer({ section }: { section: CreateFormSectionDescriptor }) {
  const { t } = useTranslation();
  const Fields = section.layout === 'grid' ? FieldGrid : FieldList;

  const content = (
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
  if (
    section.collapsible &&
    !section.fields.some(field => field.alwaysVisible || ('required' in field && field.required))
  ) {
    return (
      <OptionalDetails label={section.title || t('common.workspace.optionalDetails')}>
        {content}
      </OptionalDetails>
    );
  }
  return content;
}

export interface CreateStepRendererViewProps {
  step: CreateFormStep;
  compactOptional?: boolean;
}

export function CreateStepRendererView({
  step,
  compactOptional = false,
}: CreateStepRendererViewProps) {
  const { t } = useTranslation();
  if (step.sections?.length) {
    return (
      <FieldList>
        {step.sections.map((section: any) => (
          <CreateSectionRenderer
            key={section.key}
            section={{
              ...section,
              collapsible:
                section.collapsible ??
                (compactOptional && step.optional && step.collapsible !== false),
            }}
          />
        ))}
      </FieldList>
    );
  }

  if (step.fields?.length) {
    if (
      (compactOptional && step.optional && step.collapsible !== false) ||
      step.fields.some(field => field.supplementary)
    ) {
      const essential = step.fields.filter(
        field =>
          field.alwaysVisible ||
          ('required' in field && field.required) ||
          (!step.optional && !field.supplementary)
      );
      const additional = step.fields.filter(field => !essential.includes(field));
      return (
        <FieldList>
          {essential.map(field => (
            <CreateFieldRenderer key={field.key} field={field} />
          ))}
          {additional.length ? (
            <OptionalDetails label={t('common.workspace.optionalDetails')}>
              <FieldList>
                {additional.map(field => (
                  <CreateFieldRenderer key={field.key} field={field} />
                ))}
              </FieldList>
            </OptionalDetails>
          ) : null}
        </FieldList>
      );
    }
    return (
      <FieldList>
        {step.fields.map((field: any) => (
          <CreateFieldRenderer key={field.key} field={field} />
        ))}
      </FieldList>
    );
  }

  return null;
}
