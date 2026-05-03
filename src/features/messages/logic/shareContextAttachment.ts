import { buildAssistantAttachmentOption } from '@/features/messages/logic/assistantComposer';
import type { SearchContentItem } from '@/features/search/types/search.types';
import type { AiAttachmentEntity, AiChatAttachment } from '@/lib/ai/schemas';

type ShareableEntityType = Extract<
  AiAttachmentEntity,
  'user' | 'group' | 'statement' | 'blog' | 'amendment' | 'event' | 'todo' | 'vote' | 'election'
>;

interface ParsedShareTarget {
  entityType: ShareableEntityType;
  entityId: string;
}

const SHARE_TARGET_PATTERNS: readonly {
  entityType: ShareableEntityType;
  pattern: RegExp;
  idGroupIndex: number;
}[] = [
  { entityType: 'blog', pattern: /^\/group\/[^/]+\/blog\/([^/?#]+)/i, idGroupIndex: 1 },
  { entityType: 'blog', pattern: /^\/user\/[^/]+\/blog\/([^/?#]+)/i, idGroupIndex: 1 },
  { entityType: 'user', pattern: /^\/user\/([^/?#]+)/i, idGroupIndex: 1 },
  { entityType: 'group', pattern: /^\/group\/([^/?#]+)/i, idGroupIndex: 1 },
  { entityType: 'event', pattern: /^\/event\/([^/?#]+)/i, idGroupIndex: 1 },
  { entityType: 'amendment', pattern: /^\/amendment\/([^/?#]+)/i, idGroupIndex: 1 },
  { entityType: 'blog', pattern: /^\/blog\/([^/?#]+)/i, idGroupIndex: 1 },
  { entityType: 'statement', pattern: /^\/statement\/([^/?#]+)/i, idGroupIndex: 1 },
  { entityType: 'todo', pattern: /^\/todos?\/([^/?#]+)/i, idGroupIndex: 1 },
  { entityType: 'vote', pattern: /^\/vote\/([^/?#]+)/i, idGroupIndex: 1 },
  { entityType: 'election', pattern: /^\/election\/([^/?#]+)/i, idGroupIndex: 1 },
] as const;

function parseShareTarget(shareUrl: string): ParsedShareTarget | null {
  const pathname = new URL(shareUrl, 'https://polity.local').pathname;

  for (const candidate of SHARE_TARGET_PATTERNS) {
    const match = pathname.match(candidate.pattern);
    const entityId = match?.[candidate.idGroupIndex]?.trim();

    if (entityId) {
      return {
        entityType: candidate.entityType,
        entityId,
      };
    }
  }

  return null;
}

export function buildShareContextAttachment(input: {
  shareUrl: string;
  shareTitle: string;
  shareDescription?: string;
  shareContextItem?: SearchContentItem;
}): AiChatAttachment | null {
  const attachmentFromContextItem = input.shareContextItem
    ? (buildAssistantAttachmentOption(input.shareContextItem)?.attachment ?? null)
    : null;

  if (attachmentFromContextItem) {
    return attachmentFromContextItem;
  }

  const shareTarget = parseShareTarget(input.shareUrl);

  if (!shareTarget) {
    return null;
  }

  const normalizedDescription = input.shareDescription?.trim();

  return {
    entityType: shareTarget.entityType,
    entityId: shareTarget.entityId,
    title: input.shareTitle.trim() || shareTarget.entityId,
    subtitle: null,
    prompt_context:
      normalizedDescription && normalizedDescription.length > 0 ? normalizedDescription : null,
    card_data_json: null,
  };
}
