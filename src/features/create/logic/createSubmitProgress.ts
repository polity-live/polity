import type { ContentType } from '@/features/timeline/constants/content-type-config';
import type {
  CreateSubmitProgressStep,
  CreateSubmitProgressUpdate,
} from '../types/create-form.types';

const ENTITY_NOUNS: Partial<Record<ContentType, string>> = {
  agenda_item: 'Agenda',
  amendment: 'Antrag',
  blog: 'Blog',
  event: 'Event',
  group: 'Gruppe',
  payment: 'Zahlung',
  statement: 'Aussage',
  todo: 'Aufgabe',
  user: 'Profil',
};

function getEntityNoun(entityType: ContentType) {
  return ENTITY_NOUNS[entityType] ?? 'Eintrag';
}

export function getDefaultCreateSubmitProgressSteps(
  entityType: ContentType
): CreateSubmitProgressStep[] {
  const noun = getEntityNoun(entityType);

  return [
    {
      key: 'create',
      label: `Erstellt ${noun}`,
      status: 'pending',
    },
    {
      key: 'sync',
      label: 'Synchronisiert Inhalte',
      status: 'pending',
    },
    {
      key: 'ready',
      label: 'Bereitet Zielseite vor',
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
