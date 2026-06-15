import { getEntityToneClasses, getSemanticToneClasses } from '@/features/shared/theme';

export function getAmendmentProcessStatusBadgeClassName(status?: string | null) {
  switch (status) {
    case 'approved':
    case 'accepted':
    case 'completed':
    case 'merged':
      return getSemanticToneClasses('success').badge;
    case 'rejected':
    case 'withdrawn':
      return getSemanticToneClasses('danger').badge;
    case 'pending_event':
    case 'scheduled':
      return getSemanticToneClasses('warning').badge;
    case 'in_vote':
    case 'supported':
      return getSemanticToneClasses('info').badge;
    case 'previous_decision_outstanding':
      return getSemanticToneClasses('warning').badge;
    case 'forward_confirmed':
      return getSemanticToneClasses('accent').badge;
    default:
      return getSemanticToneClasses('neutral').badge;
  }
}

export function getAmendmentProcessInfoBadgeClassName(
  tone: 'group' | 'workflow' | 'count' | 'step' | 'current' | 'task'
) {
  switch (tone) {
    case 'group':
      return getEntityToneClasses('group').badge;
    case 'workflow':
      return getSemanticToneClasses('accent').badge;
    case 'count':
      return getSemanticToneClasses('info').badge;
    case 'step':
      return getSemanticToneClasses('neutral').badge;
    case 'current':
      return getSemanticToneClasses('success').badge;
    case 'task':
      return getSemanticToneClasses('accent').badge;
  }
}

export function getRelationshipBadgeClassName(type: 'parent' | 'child' | 'sibling' | string) {
  switch (type) {
    case 'sibling':
      return getSemanticToneClasses('accent').badge;
    case 'parent':
      return getSemanticToneClasses('success').badge;
    case 'child':
      return getSemanticToneClasses('info').badge;
    default:
      return getSemanticToneClasses('neutral').badge;
  }
}
