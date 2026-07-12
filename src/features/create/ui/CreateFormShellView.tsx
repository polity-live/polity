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
  const Layout = isCarouselLayout ? CarouselFormLayout : OnePageFormLayout;
  const overlayOpen = submission.status !== 'idle';
  const reviewPreview = getCreateReviewPreview(steps);
  const settingsAligned =
    entityType === 'group' || entityType === 'amendment' || entityType === 'event';

  return (
    <LayoutGroup id={`create-${entityType}`}>
      <div
        data-create-flow={entityType}
        data-create-layout={isCarouselLayout ? 'carousel' : 'one_page'}
        aria-hidden={overlayOpen || undefined}
        className={cn(
          isCarouselLayout
            ? 'flex h-[calc(100dvh-3rem)] min-h-0 w-full flex-col overflow-hidden'
            : 'w-full',
          overlayOpen &&
            'pointer-events-none opacity-30 blur-[1px] transition-[filter,opacity] duration-[var(--motion-duration-base)] select-none',
          settingsAligned &&
            '[&_[data-create-section]]:border-border/60 [&_[data-create-section]]:bg-card [&_[data-create-action-bar]]:border-border/70 [&_[data-create-action-bar]]:bg-background/95 [&_[data-create-action-bar]]:sticky [&_[data-create-action-bar]]:bottom-3 [&_[data-create-action-bar]]:z-20 [&_[data-create-action-bar]]:rounded-xl [&_[data-create-action-bar]]:border [&_[data-create-action-bar]]:p-3 [&_[data-create-action-bar]]:shadow-lg [&_[data-create-action-bar]]:backdrop-blur [&_[data-create-section]]:rounded-xl [&_[data-create-section]]:border [&_[data-create-section]]:p-4 [&_[data-create-section]]:shadow-none sm:[&_[data-create-section]]:p-5'
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
              onSubmit={onSubmit}
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
  );
}
