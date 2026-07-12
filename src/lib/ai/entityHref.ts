import type { AiAttachmentEntity } from './schemas';

export function buildAiEntityHref(entityType: AiAttachmentEntity, entityId: string): string | null {
  switch (entityType) {
    case 'group':
    case 'user':
    case 'statement':
    case 'event':
    case 'blog':
    case 'amendment':
      return `/${entityType}/${encodeURIComponent(entityId)}`;
    case 'todo':
      return '/todos';
    default:
      return null;
  }
}
