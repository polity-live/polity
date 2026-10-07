import { z } from 'zod';
import { executeZeroRead } from './zero-mutate';
import { zql } from '@/zero/schema';
import { applyDocumentQueryAccess } from '@/zero/rbac/query-access';
import { startAiTrace } from './ai-trace';
import { AiAccessError } from '@/lib/ai/errors';

export async function startEditorAiTrace(
  request: Request,
  actorId: string,
  invocation: 'editor_command' | 'copilot',
  prompt:
    { prompt: string } | { messages: { role: 'user' | 'assistant' | 'system'; content: string }[] }
) {
  const header = request.headers.get('X-AI-Document-Id');
  let documentId: string | undefined;
  let amendmentId: string | undefined;
  if (header) {
    if (!z.string().uuid().safeParse(header).success)
      throw new AiAccessError('ai_invalid_identifier', 'Invalid editor document');
    const document = await executeZeroRead(tx =>
      tx.run(applyDocumentQueryAccess(zql.document.where('id', header), actorId).one())
    );
    if (!document) throw new AiAccessError('permission_denied', 'Document is unavailable');
    documentId = document.id;
    amendmentId = document.amendment_id ?? undefined;
  }
  return startAiTrace(
    {
      traceId: crypto.randomUUID(),
      actorId,
      documentId,
      amendmentId,
      surface: amendmentId ? 'amendment_text' : 'editor',
      invocation,
      retryProvider: false,
    },
    prompt,
    'prompt' in prompt
      ? prompt.prompt
      : [...prompt.messages].reverse().find(message => message.role === 'user')?.content
  );
}
