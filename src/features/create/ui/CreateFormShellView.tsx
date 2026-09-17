import { FormStyleSelector } from './FormStyleSelector';
import { CarouselFormLayout } from './CarouselFormLayout';
import { OnePageFormLayout } from './OnePageFormLayout';
import type { ContentType } from '@/features/timeline/constants/content-type-config';
import type {
  CreateFormConfig,
  CreateSubmitProgressStep,
  CreateSubmitTarget,
} from '../types/create-form.types';
import type { CreateFormStyle } from '@/zero/preferences/schema';
import {
  CreateSubmissionOverlay,
  type CreateSubmissionOverlayStatus,
} from './CreateSubmissionOverlay';
import { cn } from '@/features/shared/utils/utils';
import { LayoutGroup } from 'motion/react';
import { getCreateReviewPreview } from '../logic/createReviewPreview';
import { CreateFlowFrame } from './CreateFlowFrame';
import { useEffect, useRef, useState } from 'react';
import { CreateValidationContext } from './CreateValidationContext';
import { focusCreateSection } from '../logic/createFormFocus';

interface CreateFormShellViewProps {
  title: string;
  entityType: ContentType;
  isCarouselLayout: boolean;
  selectedFormStyle: CreateFormStyle;
  steps: CreateFormConfig['steps'];
  currentStep: number;
  isSubmitting: boolean;
  onFormStyleChange: (style: CreateFormStyle) => void;
  onStepChange: (step: number) => void;
  onSubmit: () => Promise<void>;
  submission: {
    status: CreateSubmissionOverlayStatus;
    target: CreateSubmitTarget | null;
    error: unknown;
    progressSteps: CreateSubmitProgressStep[];
    onBack: () => void;
    onRetry: () => void;
  };
}

export function CreateFormShellView({
  title,
  entityType,
  isCarouselLayout,
  selectedFormStyle,
  steps,
  currentStep,
  isSubmitting,
  onFormStyleChange,
  onStepChange,
  onSubmit,
  submission,
}: CreateFormShellViewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [validateAll, setValidateAll] = useState(false);
  useEffect(() => {
    const root = rootRef.current;
    const validate = () => setValidateAll(true);
    root?.addEventListener('create:validate', validate);
    return () => root?.removeEventListener('create:validate', validate);
  }, []);
  const submitValidated = async () => {
    const invalidIndex = steps.findIndex(step => !step.isValid());
    if (invalidIndex >= 0) {
      setValidateAll(true);
      onStepChange(invalidIndex);
      focusCreateSection(rootRef.current, invalidIndex);
      return;
    }
    await onSubmit();
  };
  const Layout = isCarouselLayout ? CarouselFormLayout : OnePageFormLayout;
  const overlayOpen = submission.status !== 'idle';
  const reviewPreview = getCreateReviewPreview(steps);
  const settingsAligned =
    entityType === 'group' || entityType === 'amendment' || entityType === 'event';

  return (
    <CreateValidationContext.Provider value={validateAll}>
      <LayoutGroup id={`create-${entityType}`}>
        <div
          ref={rootRef}
          data-create-flow={entityType}
          data-create-layout={isCarouselLayout ? 'carousel' : 'one_page'}
          aria-hidden={overlayOpen || undefined}
          className={cn(
            isCarouselLayout
              ? 'flex h-[calc(100dvh-var(--app-shell-mobile-top-offset,0rem)-var(--app-shell-mobile-bottom-offset,0rem)-3rem)] min-h-0 w-full flex-col overflow-hidden'
              : 'w-full',
            overlayOpen &&
              'pointer-events-none opacity-30 blur-[1px] transition-[filter,opacity] duration-[var(--motion-duration-base)] select-none'
          )}
        >
          {submission.status !== 'ready' ? (
            <CreateFlowFrame
              title={title}
              action={<FormStyleSelector value={selectedFormStyle} onChange={onFormStyleChange} />}
              isCarouselLayout={isCarouselLayout}
              settingsAligned={settingsAligned}
            >
              <Layout
                steps={steps}
                currentStep={currentStep}
                onStepChange={onStepChange}
                onSubmit={submitValidated}
                isSubmitting={isSubmitting}
              />
            </CreateFlowFrame>
          ) : null}
        </div>

        <CreateSubmissionOverlay
          status={submission.status}
          entityType={entityType}
          title={title}
          target={submission.target}
          error={submission.error}
          progressSteps={submission.progressSteps}
          reviewPreview={reviewPreview}
          onBack={submission.onBack}
          onRetry={submission.onRetry}
        />
      </LayoutGroup>
    </CreateValidationContext.Provider>
  );
}
