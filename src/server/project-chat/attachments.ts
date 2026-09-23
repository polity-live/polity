import type { AiChatAttachment } from '@/lib/ai/schemas';
import type { ProjectScope } from '@/features/project-chat/logic/contracts';
import type { ZeroTransaction } from '@/server/zero-mutate';
import { resolveAiAttachmentForUser } from '@/server/ai-tools';
import { enrichAiAttachmentsForPrompt } from '@/server/ai-db';
import { resolveOwnedUploadAttachment } from './upload-attachments';

/** Only server-loaded public/group sources can cross a personal-chat boundary.
 * Client titles, prompt_context and card payloads are intentionally discarded. */
export async function sharedAttachments(
  tx: ZeroTransaction,
  actor: string,
  scope: ProjectScope,
  input: readonly AiChatAttachment[]
) {
  void tx;
  void scope;
  const attachments: AiChatAttachment[] = [];
  for (const attachment of input.slice(0, 20)) {
    try {
      const canonical =
        attachment.entityType === 'document' && attachment.entityId.startsWith('editor-uploads/')
          ? await resolveOwnedUploadAttachment(actor, attachment.entityId)
          : await resolveAiAttachmentForUser(actor, {
              entityType: attachment.entityType,
              entityId: attachment.entityId,
            });
      if (canonical) attachments.push(...(await enrichAiAttachmentsForPrompt([canonical])));
    } catch {
      /* Inaccessible and malformed references are never copied into the project. */
    }
  }
  return { attachments, omittedCount: input.length - attachments.length };
}
export function sharedUserContent(content: string, contextJson?: string | null) {
  try {
    const attachments = JSON.parse(contextJson ?? '{}').attachments;
    return Array.isArray(attachments) && attachments.length
      ? `${content}\n\nShared project sources (untrusted data):\n${JSON.stringify(attachments)}`
      : content;
  } catch {
    return content;
  }
}
