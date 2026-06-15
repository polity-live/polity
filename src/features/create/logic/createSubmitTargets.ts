import type {
  CreateExternalSubmitTarget,
  CreateRouteSubmitTarget,
  CreateSubmitTarget,
} from '../types/create-form.types';
import type { ContentType } from '@/features/timeline/constants/content-type-config';

const CREATE_TARGET_LABELS: Partial<Record<ContentType, string>> = {
  group: 'Zur Gruppe',
  event: 'Zum Event',
  amendment: 'Zum Antrag',
  blog: 'Zum Blog',
  agenda_item: 'Zur Agenda',
  todo: 'Zu Aufgaben',
  statement: 'Zur Aussage',
  payment: 'Zur Gruppe',
  election: 'Zur Erstellung',
};

export function getCreateSubmitTargetLabel(entityType: ContentType): string {
  return CREATE_TARGET_LABELS[entityType] ?? 'Zur Erstellung';
}

export function createRouteSubmitTarget(
  entityType: ContentType,
  target: Omit<CreateRouteSubmitTarget, 'kind' | 'entityType' | 'label'> & {
    label?: string;
  }
): CreateRouteSubmitTarget {
  return {
    kind: 'route',
    entityType,
    label: target.label ?? getCreateSubmitTargetLabel(entityType),
    to: target.to,
    params: target.params,
    search: target.search,
    hash: target.hash,
  };
}

export function createExternalSubmitTarget(
  entityType: ContentType,
  target: Omit<CreateExternalSubmitTarget, 'kind' | 'entityType' | 'label'> & {
    label?: string;
  }
): CreateExternalSubmitTarget {
  return {
    kind: 'external',
    entityType,
    label: target.label ?? getCreateSubmitTargetLabel(entityType),
    href: target.href,
  };
}

export function createBlockedSubmitOutcome() {
  return { status: 'blocked' } as const;
}

export function createSuccessSubmitOutcome(target: CreateSubmitTarget) {
  return { status: 'success', target } as const;
}
