import type { ContentType } from '@/features/timeline/constants/content-type-config';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import type {
  CreateSubmitProgressStep,
  CreateSubmitProgressUpdate,
} from '../types/create-form.types';

const ENTITY_NOUN_KEYS: Partial<Record<ContentType, string>> = {
  agenda_item: 'pages.create.progress.submission.entityNouns.agenda_item',
  amendment: 'pages.create.progress.submission.entityNouns.amendment',
  blog: 'pages.create.progress.submission.entityNouns.blog',
  event: 'pages.create.progress.submission.entityNouns.event',
  group: 'pages.create.progress.submission.entityNouns.group',
  payment: 'pages.create.progress.submission.entityNouns.payment',
  statement: 'pages.create.progress.submission.entityNouns.statement',
  todo: 'pages.create.progress.submission.entityNouns.todo',
  user: 'pages.create.progress.submission.entityNouns.user',
};

function getEntityNoun(entityType: ContentType) {
  return translateText(
    ENTITY_NOUN_KEYS[entityType] ?? 'pages.create.progress.submission.entityNouns.fallback'
  );
}

export function getDefaultCreateSubmitProgressSteps(
  entityType: ContentType
): CreateSubmitProgressStep[] {
  const noun = getEntityNoun(entityType);

  return [
    {
      key: 'create',
      label: translateText('pages.create.progress.submission.defaultCreate', { noun }),
      status: 'pending',
    },
    {
      key: 'sync',
      label: translateText('pages.create.progress.submission.defaultSync'),
      status: 'pending',
    },
    {
      key: 'ready',
      label: translateText('pages.create.progress.submission.defaultReady'),
      status: 'pending',
    },
  ];
}

export function normalizeCreateSubmitProgressSteps(
  entityType: ContentType,
  steps?: CreateSubmitProgressStep[]
) {
  const source = steps?.length ? steps : getDefaultCreateSubmitProgressSteps(entityType);

  return source.map(step => ({
    ...step,
    status: step.status ?? 'pending',
  }));
}

export function applyCreateSubmitProgressUpdate(
  steps: CreateSubmitProgressStep[],
  update: CreateSubmitProgressUpdate
): CreateSubmitProgressStep[] {
  return steps.map(step =>
    step.key === update.key
      ? {
          ...step,
          label: update.label ?? step.label,
          status: update.status ?? step.status,
          progress: update.progress ?? step.progress,
        }
      : step
  );
}

export function activateCreateSubmitProgressStep(steps: CreateSubmitProgressStep[], key: string) {
  return steps.map(step => {
    if (step.key === key) {
      return { ...step, status: 'active' as const };
    }

    if (step.status === 'active') {
      return { ...step, status: 'complete' as const, progress: 1 };
    }

    return step;
  });
}

export function completeCreateSubmitProgressSteps(steps: CreateSubmitProgressStep[]) {
  return steps.map(step => ({
    ...step,
    status: 'complete' as const,
    progress: 1,
  }));
}

export function failActiveCreateSubmitProgressStep(steps: CreateSubmitProgressStep[]) {
  const activeIndex = steps.findIndex(step => step.status === 'active');
  const fallbackIndex = activeIndex >= 0 ? activeIndex : 0;

  return steps.map((step, index) =>
    index === fallbackIndex
      ? {
          ...step,
          status: 'error' as const,
        }
      : step
  );
}
