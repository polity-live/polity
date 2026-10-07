import type { AiChatAttachment } from '@/lib/ai/schemas';
import type { ProjectScope } from '@/features/project-chat/logic/contracts';
import { resolveProjectSources } from '@/server/studio/ai-sources';

/** Only server-loaded public/group sources can cross a personal-chat boundary.
 * Client titles, prompt_context and card payloads are intentionally discarded. */
export async function sharedAttachments(
  actor: string,
  scope: ProjectScope | null,
  input: readonly AiChatAttachment[]
) {
  const attachments: AiChatAttachment[] = [];
  for (const attachment of input.slice(0, 20)) {
    try {
      if (attachment.entityId.startsWith('editor-uploads/')) continue;
      attachments.push(
        ...(await resolveProjectSources(actor, scope, [
          {
            type: attachment.entityType,
            id: attachment.entityId,
          },
        ]))
      );
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
