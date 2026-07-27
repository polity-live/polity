import { describe, expect, it } from 'vitest';

import { parseAiMessageContext } from '@/lib/ai/messageContext';
import {
  hasAppTutorialAssistantTodoAttachment,
  hasAppTutorialAssistantTodoOutput,
  mergeAppTutorialAssistantTodoOutput,
} from '../assistant-todo-context';

const TODO_ID = '00000000-0000-4000-8000-000000000123';

describe('assistant tutorial todo context', () => {
  it('recognizes an existing AI output so the fallback does not duplicate it', () => {
    const contextJson = mergeAppTutorialAssistantTodoOutput(null, TODO_ID);

    expect(hasAppTutorialAssistantTodoAttachment(contextJson, TODO_ID)).toBe(true);
    expect(hasAppTutorialAssistantTodoOutput(contextJson, TODO_ID)).toBe(true);
    expect(
      parseAiMessageContext(contextJson).attachments.filter(
        attachment => attachment.entityType === 'todo' && attachment.entityId === TODO_ID
      )
    ).toHaveLength(1);
  });

  it('replaces an update attachment with output while preserving other context', () => {
    const contextJson = JSON.stringify({
      version: 1,
      attachments: [
        {
          entityType: 'todo',
          entityId: TODO_ID,
          title: 'Updated todo',
          context_type: 'update',
          href: '/todos',
        },
        {
          entityType: 'group',
          entityId: 'group-1',
          title: 'Created group',
          context_type: 'output',
          href: '/group/group-1',
        },
      ],
      presentations: [
        {
          type: 'findings',
          id: 'finding-1',
          title: 'Findings',
          items: [
            {
              id: 'item-1',
              title: 'One',
              description: 'First finding',
              tone: 'neutral',
            },
            {
              id: 'item-2',
              title: 'Two',
              description: 'Second finding',
              tone: 'info',
            },
          ],
        },
      ],
    });

    expect(hasAppTutorialAssistantTodoAttachment(contextJson, TODO_ID)).toBe(true);
    expect(hasAppTutorialAssistantTodoOutput(contextJson, TODO_ID)).toBe(false);

    const merged = parseAiMessageContext(mergeAppTutorialAssistantTodoOutput(contextJson, TODO_ID));

    expect(merged.attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityType: 'group',
          entityId: 'group-1',
        }),
        expect.objectContaining({
          entityType: 'todo',
          entityId: TODO_ID,
          context_type: 'output',
          href: '/todos',
        }),
      ])
    );
    expect(merged.attachments).toHaveLength(2);
    expect(merged.presentations).toHaveLength(1);
  });
});
