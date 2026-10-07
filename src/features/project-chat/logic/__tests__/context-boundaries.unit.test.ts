import { expect, it } from 'vitest';
import type { ModelMessage } from 'ai';
import { conditionalUndo } from '../conditional-undo';
import {
  createFrameNode,
  studioDocumentV3Schema,
  createStudioDocumentV5,
} from '@/features/communication-studio/logic/document-v3';
import { getStudioRootFramesInLayerOrder } from '@/features/communication-studio/logic/frame-order';
import { boundedProjectHistory } from '@/server/project-chat/history';
import { parseAiMessageContext } from '@/lib/ai/messageContext';
import { getConversationDisplay } from '@/features/messages/logic/messageUtils';
import { ARIA_KAI_AVATAR_URL } from '@/features/assistant/constants';

it('restores a prior value when the accepted and current optional values are both absent', () => {
  const before = { optional: 'Original value' };
  const restored = conditionalUndo<unknown>(undefined, before, undefined);
  expect(restored).toEqual(before);
  expect(restored).not.toBe(before);
});
it('orders valid root frames deterministically when their z-indices are equal', () => {
  const document = createStudioDocumentV5('Frame order', 'single');
  const first = createFrameNode('square', {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'First',
    zIndex: 0,
  });
  const second = createFrameNode('square', {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Second',
    zIndex: 0,
  });
  document.nodes = [second, first];
  document.deliverables = [];
  expect(
    getStudioRootFramesInLayerOrder(studioDocumentV3Schema.parse(document)).map(frame => frame.id)
  ).toEqual([first.id, second.id]);
});
it('keeps small tool results while compacting a larger sibling result without altering the original history', () => {
  const small = {
    type: 'tool-result' as const,
    toolCallId: 'small',
    toolName: 'studio_read',
    output: { type: 'json' as const, value: { snapshotId: 'retain' } },
  };
  const messages: ModelMessage[] = [
    { role: 'user', content: 'Current instruction' },
    {
      role: 'assistant',
      content: [
        { type: 'tool-call', toolCallId: 'small', toolName: 'studio_read', input: {} },
        { type: 'tool-call', toolCallId: 'large', toolName: 'studio_read', input: {} },
      ],
    },
    {
      role: 'tool',
      content: [
        small,
        {
          type: 'tool-result',
          toolCallId: 'large',
          toolName: 'studio_read',
          output: { type: 'json', value: { text: 'x'.repeat(6000) } },
        },
      ],
    },
    { role: 'assistant', content: 'Newest response' },
  ];
  const before = structuredClone(messages);
  const result = boundedProjectHistory(messages, 2000);
  const tool = result[2];
  if (tool.role !== 'tool') throw Error('Expected intact tool results');
  expect(tool.content[0]).toEqual(small);
  expect(tool.content[1]).toMatchObject({
    toolCallId: 'large',
    output: { type: 'json', value: { omitted: true } },
  });
  expect(result.at(-1)).toEqual(messages.at(-1));
  expect(messages).toEqual(before);
});
it('retains a valid diagnostic identity when optional presentation context is absent', () => {
  const aiTrace = { traceId: crypto.randomUUID(), originMessageId: crypto.randomUUID() };
  expect(parseAiMessageContext(JSON.stringify({ version: 1, attachments: [], aiTrace }))).toEqual({
    version: 1,
    attachments: [],
    presentations: [],
    aiTrace,
  });
});
it.each([
  ['  Shared city plan  ', 'Shared city plan'],
  ['   ', 'Project chat'],
])(
  'formats project conversation name %s without treating participants as a direct recipient',
  (name, expected) => {
    expect(getConversationDisplay({ type: 'project_ai', name, participants: [] }, 'actor')).toEqual(
      {
        name: expected,
        avatar: ARIA_KAI_AVATAR_URL,
        handle: 'aria-kai',
        isGroup: false,
        isEvent: false,
        isCollective: false,
      }
    );
  }
);
