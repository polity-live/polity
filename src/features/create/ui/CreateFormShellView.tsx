import { FormStyleSelector } from './FormStyleSelector';
import { CarouselFormLayout } from './CarouselFormLayout';
import { OnePageFormLayout } from './OnePageFormLayout';
import { SettingsPanel } from '@/features/shared/ui/form';
import type { CreateFormConfig } from '../types/create-form.types';
import type { CreateFormStyle } from '@/zero/preferences/schema';

interface CreateFormShellViewProps {
  title: string;
  isCarouselLayout: boolean;
  selectedFormStyle: CreateFormStyle;
  steps: CreateFormConfig['steps'];
  currentStep: number;
  isSubmitting: boolean;
  onFormStyleChange: (style: CreateFormStyle) => void;
  onStepChange: (step: number) => void;
  onSubmit: CreateFormConfig['onSubmit'];
}

export function CreateFormShellView({
  title,
  isCarouselLayout,
  selectedFormStyle,
  steps,
  currentStep,
  isSubmitting,
  onFormStyleChange,
  onStepChange,
  onSubmit,
}: CreateFormShellViewProps) {
  const Layout = isCarouselLayout ? CarouselFormLayout : OnePageFormLayout;

  return (
    <div
      className={
        isCarouselLayout
          ? 'mx-auto flex h-[calc(100dvh-3rem)] min-h-0 w-full max-w-2xl flex-col overflow-hidden px-4 py-6'
          : 'mx-auto w-full max-w-2xl px-4 py-6'
      }
    >
      <SettingsPanel
        title={title}
        action={<FormStyleSelector value={selectedFormStyle} onChange={onFormStyleChange} />}
        className={isCarouselLayout ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : undefined}
        contentClassName={isCarouselLayout ? 'flex min-h-0 flex-1 flex-col' : undefined}
      >
        <Layout
          steps={steps}
          currentStep={currentStep}
          onStepChange={onStepChange}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
        />
      </SettingsPanel>
    </div>
  );
}
