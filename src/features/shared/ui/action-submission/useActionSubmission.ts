'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  ActionSubmissionKind,
  ActionSubmissionProgressStatus,
  ActionSubmissionStatus,
  ActionSubmissionStep,
  ActionSubmissionStepKey,
} from './ActionSubmissionOverlay';

export interface ActionSubmissionProgressUpdate {
  key: ActionSubmissionStepKey;
  status: ActionSubmissionProgressStatus;
  label?: string;
}

export interface ActionSubmissionContext {
  reportProgress: (update: ActionSubmissionProgressUpdate) => void;
}

export interface ActionSubmissionRunConfig {
  steps?: ActionSubmissionStep[];
  onSuccess?: () => void;
  successDelayMs?: number;
}

interface ActionResultLike {
  success?: boolean;
  error?: unknown;
}

const DEFAULT_STEPS: Record<ActionSubmissionKind, ActionSubmissionStep[]> = {
  workflow: [
    { key: 'prepare', label: 'Pfad prüfen', status: 'pending' },
    { key: 'commit', label: 'Workflow speichern', status: 'pending' },
    { key: 'sync', label: 'Freigaben synchronisieren', status: 'pending' },
  ],
  process: [
    { key: 'prepare', label: 'Ziel prüfen', status: 'pending' },
    { key: 'commit', label: 'Prozesslauf starten', status: 'pending' },
    { key: 'sync', label: 'Ansicht synchronisieren', status: 'pending' },
  ],
  link: [
    { key: 'prepare', label: 'Verbindung prüfen', status: 'pending' },
    { key: 'commit', label: 'Link aktivieren', status: 'pending' },
    { key: 'sync', label: 'Netzwerk aktualisieren', status: 'pending' },
  ],
  invite: [
    { key: 'prepare', label: 'Empfänger prüfen', status: 'pending' },
    { key: 'commit', label: 'Einladungen senden', status: 'pending' },
    { key: 'sync', label: 'Listen synchronisieren', status: 'pending' },
  ],
  accept: [
    { key: 'prepare', label: 'Einladung prüfen', status: 'pending' },
    { key: 'commit', label: 'Rolle aktivieren', status: 'pending' },
    { key: 'sync', label: 'Ansicht aktualisieren', status: 'pending' },
  ],
};

function cloneSteps(steps: ActionSubmissionStep[]) {
  return steps.map(step => ({ ...step }));
}

function getInitialSteps(kind: ActionSubmissionKind, steps?: ActionSubmissionStep[]) {
  return cloneSteps(steps?.length ? steps : DEFAULT_STEPS[kind]);
}

function isResultLike(value: unknown): value is ActionResultLike {
  return Boolean(value && typeof value === 'object' && 'success' in value);
}

function toError(error: unknown) {
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);
  return new Error('Die Aktion konnte nicht abgeschlossen werden.');
}

function statusForActiveStep(stepKey: ActionSubmissionStepKey): ActionSubmissionStatus {
  void stepKey;
  return 'submitting';
}

function applyProgressUpdate(
  steps: ActionSubmissionStep[],
  update: ActionSubmissionProgressUpdate
) {
  return steps.map(step =>
    step.key === update.key
      ? { ...step, status: update.status, label: update.label ?? step.label }
      : step
  );
}

function activateStep(steps: ActionSubmissionStep[], stepKey: ActionSubmissionStepKey) {
  return steps.map(step =>
    step.key === stepKey ? { ...step, status: 'active' as ActionSubmissionProgressStatus } : step
  );
}

function completeStep(steps: ActionSubmissionStep[], stepKey: ActionSubmissionStepKey) {
  return steps.map(step =>
    step.key === stepKey ? { ...step, status: 'complete' as ActionSubmissionProgressStatus } : step
  );
}

function completeAll(steps: ActionSubmissionStep[]) {
  return steps.map(step => ({
    ...step,
    status: 'complete' as ActionSubmissionProgressStatus,
  }));
}

function failActive(steps: ActionSubmissionStep[]) {
  let marked = false;

  const next = steps.map(step => {
    if (!marked && step.status === 'active') {
      marked = true;
      return { ...step, status: 'error' as ActionSubmissionProgressStatus };
    }

    return step;
  });

  if (marked) return next;

  return next.map((step, index) =>
    index === next.length - 1
      ? { ...step, status: 'error' as ActionSubmissionProgressStatus }
      : step
  );
}

export function useActionSubmission(kind: ActionSubmissionKind, steps?: ActionSubmissionStep[]) {
  const [status, setStatus] = useState<ActionSubmissionStatus>('idle');
  const [progressSteps, setProgressSteps] = useState<ActionSubmissionStep[]>(() =>
    getInitialSteps(kind, steps)
  );
  const [error, setError] = useState<unknown>(null);
  const retryRef = useRef<(() => Promise<void>) | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setStatus('idle');
    setError(null);
    setProgressSteps(getInitialSteps(kind, steps));
    retryRef.current = null;
  }, [kind, steps]);

  const reportProgress = useCallback((update: ActionSubmissionProgressUpdate) => {
    setProgressSteps(prev => applyProgressUpdate(prev, update));
    if (update.status === 'active') {
      setStatus(statusForActiveStep(update.key));
    }
    if (update.status === 'error') {
      setStatus('error');
    }
  }, []);

  const context = useMemo<ActionSubmissionContext>(() => ({ reportProgress }), [reportProgress]);

  const runActionWithSubmission = useCallback(
    async <T>(
      action: (context: ActionSubmissionContext) => Promise<T> | T,
      config: ActionSubmissionRunConfig = {}
    ) => {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      const sourceSteps = getInitialSteps(kind, config.steps ?? steps);
      setProgressSteps(activateStep(sourceSteps, 'prepare'));
      setStatus('submitting');
      setError(null);

      const retry = async () => {
        await runActionWithSubmission(action, config);
      };
      retryRef.current = retry;

      try {
        setProgressSteps(prev => completeStep(activateStep(prev, 'prepare'), 'prepare'));
        setProgressSteps(prev => activateStep(prev, 'commit'));

        const result = await action(context);

        if (isResultLike(result) && result.success === false) {
          throw toError(result.error);
        }

        setProgressSteps(prev => completeStep(prev, 'commit'));
        setProgressSteps(prev => activateStep(prev, 'sync'));
        setProgressSteps(prev => completeStep(prev, 'sync'));
        setProgressSteps(prev => completeAll(prev));
        setStatus('success');

        timeoutRef.current = window.setTimeout(() => {
          config.onSuccess?.();
        }, config.successDelayMs ?? 720);

        return result;
      } catch (caughtError) {
        setError(caughtError);
        setProgressSteps(prev => failActive(prev));
        setStatus('error');
        throw caughtError;
      }
    },
    [context, kind, steps]
  );

  const retry = useCallback(async () => {
    await retryRef.current?.();
  }, []);

  useEffect(
    () => () => {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    []
  );

  return {
    status,
    progressSteps,
    error,
    isActive: status !== 'idle',
    context,
    reportProgress,
    runActionWithSubmission,
    reset,
    retry,
  };
}

export type ActionSubmissionController = ReturnType<typeof useActionSubmission>;

export { DEFAULT_STEPS as ACTION_SUBMISSION_DEFAULT_STEPS };
