import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { usePreferenceActions } from '@/zero/preferences/usePreferenceActions';
import { usePreferenceState } from '@/zero/preferences/usePreferenceState';
import type { CreateFormStyle } from '@/zero/preferences/schema';
import { useFormStyle } from './useFormStyle';
import type {
  CreateFormConfig,
  CreateSubmitProgressStep,
  CreateSubmitProgressUpdate,
  CreateSubmitTarget,
} from '../types/create-form.types';
import type { CreateSubmissionOverlayStatus } from '../ui/CreateSubmissionOverlay';
import {
  activateCreateSubmitProgressStep,
  applyCreateSubmitProgressUpdate,
  completeCreateSubmitProgressSteps,
  failActiveCreateSubmitProgressStep,
  normalizeCreateSubmitProgressSteps,
} from '../logic/createSubmitProgress';

interface UseCreateFormShellControllerOptions {
  config: CreateFormConfig;
}

interface CreateSubmissionState {
  status: CreateSubmissionOverlayStatus;
  target: CreateSubmitTarget | null;
  error: unknown;
  progressSteps: CreateSubmitProgressStep[];
}

export function useCreateFormShellController({ config }: UseCreateFormShellControllerOptions) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createFormStyle } = usePreferenceState();
  const { updateFormStyle } = usePreferenceActions();
  const [optimisticFormStyle, setOptimisticFormStyle] = useState<CreateFormStyle | null>(null);
  const selectedFormStyle = optimisticFormStyle ?? createFormStyle;
  const { formMode } = useFormStyle(selectedFormStyle);
  const [currentStep, setCurrentStep] = useState(0);
  const [submissionState, setSubmissionState] = useState<CreateSubmissionState>({
    status: 'idle',
    target: null,
    error: null,
    progressSteps: normalizeCreateSubmitProgressSteps(config.entityType, config.submissionSteps),
  });
  const submitInFlightRef = useRef(false);
  const recoveryTargetRef = useRef<CreateSubmitTarget | null>(null);
  const progressStepsRef = useRef<CreateSubmitProgressStep[]>(
    normalizeCreateSubmitProgressSteps(config.entityType, config.submissionSteps)
  );
  const isCarouselLayout = formMode === 'carousel';

  const handleStepChange = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  const handleFormStyleChange = useCallback(
    (style: CreateFormStyle) => {
      setOptimisticFormStyle(style);
      updateFormStyle(style);
    },
    [updateFormStyle]
  );

  useEffect(() => {
    if (optimisticFormStyle === createFormStyle) {
      setOptimisticFormStyle(null);
    }
  }, [createFormStyle, optimisticFormStyle]);

  const handleSubmit = useCallback(async () => {
    if (submitInFlightRef.current || submissionState.status === 'submitting') {
      return;
    }

    submitInFlightRef.current = true;
    recoveryTargetRef.current = null;
    progressStepsRef.current = activateCreateSubmitProgressStep(
      normalizeCreateSubmitProgressSteps(config.entityType, config.submissionSteps),
      'create'
    );

    const reportProgress = (update: CreateSubmitProgressUpdate) => {
      progressStepsRef.current = applyCreateSubmitProgressUpdate(progressStepsRef.current, update);
      setSubmissionState(previous =>
        previous.status === 'idle'
          ? previous
          : {
              ...previous,
              progressSteps: progressStepsRef.current,
            }
      );
    };

    const setRecoveryTarget = (target: CreateSubmitTarget | null) => {
      recoveryTargetRef.current = target;
      setSubmissionState(previous =>
        previous.status === 'idle'
          ? previous
          : {
              ...previous,
              target,
            }
      );
    };

    let overlayTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      setSubmissionState({
        status: 'submitting',
        target: recoveryTargetRef.current,
        error: null,
        progressSteps: progressStepsRef.current,
      });
      overlayTimer = null;
    }, 120);

    try {
      const outcome = await config.onSubmit({ reportProgress, setRecoveryTarget });

      if (overlayTimer) {
        clearTimeout(overlayTimer);
      }

      if (outcome.status === 'blocked') {
        submitInFlightRef.current = false;
        recoveryTargetRef.current = null;
        setSubmissionState({
          status: 'idle',
          target: null,
          error: null,
          progressSteps: normalizeCreateSubmitProgressSteps(
            config.entityType,
            config.submissionSteps
          ),
        });
        return;
      }

      progressStepsRef.current = completeCreateSubmitProgressSteps(progressStepsRef.current);
      setSubmissionState({
        status: 'ready',
        target: outcome.target,
        error: null,
        progressSteps: progressStepsRef.current,
      });
    } catch (error) {
      if (overlayTimer) {
        clearTimeout(overlayTimer);
      }

      submitInFlightRef.current = false;
      progressStepsRef.current = failActiveCreateSubmitProgressStep(progressStepsRef.current);
      const recoveryTarget = recoveryTargetRef.current;
      setSubmissionState({
        status: 'error',
        target: recoveryTarget,
        error,
        progressSteps: progressStepsRef.current,
      });
    }
  }, [config, submissionState.status]);

  const handleBackToForm = useCallback(() => {
    submitInFlightRef.current = false;
    recoveryTargetRef.current = null;
    setSubmissionState({
      status: 'idle',
      target: null,
      error: null,
      progressSteps: normalizeCreateSubmitProgressSteps(config.entityType, config.submissionSteps),
    });
  }, [config.entityType, config.submissionSteps]);

  const handleNavigateToTarget = useCallback(() => {
    const target = submissionState.target;
    if (!target) {
      return;
    }

    if (target.kind === 'external') {
      window.location.assign(target.href);
      return;
    }

    navigate({
      to: target.to,
      params: target.params,
      search: target.search,
      hash: target.hash,
    } as never);
  }, [navigate, submissionState.target]);

  return {
    title: t(config.title),
    entityType: config.entityType,
    isCarouselLayout,
    selectedFormStyle,
    steps: config.steps,
    currentStep,
    onFormStyleChange: handleFormStyleChange,
    onStepChange: handleStepChange,
    onSubmit: handleSubmit,
    isSubmitting: config.isSubmitting || submissionState.status === 'submitting',
    submission: {
      status: submissionState.status,
      target: submissionState.target,
      error: submissionState.error,
      progressSteps: submissionState.progressSteps,
      onNavigate: handleNavigateToTarget,
      onBack: handleBackToForm,
      onRetry: handleSubmit,
    },
  };
}
