import type {
  CreateExternalSubmitTarget,
  CreateRouteSubmitTarget,
  CreateSubmitTarget,
} from '../types/create-form.types';
import type { ContentType } from '@/features/timeline/constants/content-type-config';

const CREATE_TARGET_LABELS: Partial<Record<ContentType, string>> = {
  group: 'pages.create.targets.group',
  event: 'pages.create.targets.event',
  amendment: 'pages.create.targets.amendment',
  blog: 'pages.create.targets.blog',
  agenda_item: 'pages.create.targets.agendaItem',
  todo: 'pages.create.targets.todo',
  statement: 'pages.create.targets.statement',
  payment: 'pages.create.targets.payment',
  election: 'pages.create.targets.creation',
};

export function getCreateSubmitTargetLabelKey(entityType: ContentType): string {
  return CREATE_TARGET_LABELS[entityType] ?? 'pages.create.targets.creation';
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
    label: target.label,
    labelKey: target.label ? undefined : getCreateSubmitTargetLabelKey(entityType),
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
    label: target.label,
    labelKey: target.label ? undefined : getCreateSubmitTargetLabelKey(entityType),
    href: target.href,
  };
}

export function createBlockedSubmitOutcome() {
  return { status: 'blocked' } as const;
}

export function createSuccessSubmitOutcome(target: CreateSubmitTarget) {
  return { status: 'success', target } as const;
}
