import { buildAiEntityHref } from '@/lib/ai/entityHref';
import {
  createAiMessageContext,
  parseAiMessageContext,
  serializeAiMessageContext,
} from '@/lib/ai/messageContext';
import type { AiChatAttachment } from '@/lib/ai/schemas';

export const APP_TUTORIAL_ASSISTANT_TODO_TITLE = 'Die Welt zu einem besseren Ort machen';

function isMatchingTodoAttachment(attachment: AiChatAttachment, todoId: string) {
  return attachment.entityType === 'todo' && attachment.entityId === todoId;
}

export function hasAppTutorialAssistantTodoAttachment(contextJson: string | null, todoId: string) {
  return parseAiMessageContext(contextJson).attachments.some(attachment =>
    isMatchingTodoAttachment(attachment, todoId)
  );
}

export function hasAppTutorialAssistantTodoOutput(contextJson: string | null, todoId: string) {
  return parseAiMessageContext(contextJson).attachments.some(
    attachment =>
      isMatchingTodoAttachment(attachment, todoId) && attachment.context_type !== 'update'
  );
}

export function mergeAppTutorialAssistantTodoOutput(
  contextJson: string | null,
  todoId: string
): string {
  const context = parseAiMessageContext(contextJson);
  const attachment: AiChatAttachment = {
    entityType: 'todo',
    entityId: todoId,
    title: APP_TUTORIAL_ASSISTANT_TODO_TITLE,
    subtitle: 'pending · medium',
    prompt_context: 'Die Aufgabe wurde erstellt.',
    context_type: 'output',
    href: buildAiEntityHref('todo', todoId),
  };

  return serializeAiMessageContext(
    createAiMessageContext(
      [
        ...context.attachments.filter(existing => !isMatchingTodoAttachment(existing, todoId)),
        attachment,
      ],
      context.presentations
    )
  );
}
