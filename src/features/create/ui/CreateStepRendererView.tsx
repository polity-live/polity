import { FieldGrid, FieldList } from '@/features/shared/ui/form';
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
    return <div className={field.className}>{field.node}</div>;
  }

  if (field.kind === 'customComponent') {
    const Component = field.component;
    return (
      <div className={field.className}>
        <Component {...(field.props ?? {})} />
      </div>
    );
  }

  if (field.kind === 'typeahead') {
    return <CreateTypeaheadDescriptorField field={field} />;
  }

  return <CreateTextDescriptorField field={field} />;
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
        {section.fields.map((field: any) => (
          <CreateFieldRenderer key={field.key} field={field} />
        ))}
      </Fields>
    </section>
  );
}

export interface CreateStepRendererViewProps {
  step: CreateFormStep;
}

export function CreateStepRendererView({ step }: CreateStepRendererViewProps) {
  if (step.sections?.length) {
    return (
      <FieldList>
        {step.sections.map((section: any) => (
          <CreateSectionRenderer key={section.key} section={section} />
        ))}
      </FieldList>
    );
  }

  if (step.fields?.length) {
    return (
      <FieldList>
        {step.fields.map((field: any) => (
          <CreateFieldRenderer key={field.key} field={field} />
        ))}
      </FieldList>
    );
  }

  return <>{step.content}</>;
}
