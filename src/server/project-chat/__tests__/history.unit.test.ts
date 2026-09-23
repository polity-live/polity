import { describe, expect, it } from 'vitest';
import type { ModelMessage } from 'ai';
import { boundedProjectHistory } from '../history';

describe('project model context budget', () => {
  it('drops old turns without breaking tool call/result pairs in the current turn', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'Old context'.repeat(1000) },
      { role: 'assistant', content: 'Previous reply' },
      { role: 'user', content: 'Current instruction' },
      {
        role: 'assistant',
        content: [{ type: 'tool-call', toolCallId: 'read', toolName: 'studio_read', input: {} }],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'read',
            toolName: 'studio_read',
            output: { type: 'json', value: { snapshotId: 'current' } },
          },
        ],
      },
    ];
    const result = boundedProjectHistory(messages, 1000);
    expect(result).toEqual(messages.slice(2));
    expect(messages).toHaveLength(5);
  });

  it('compacts older tool outputs but keeps the latest result and current instruction', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'Keep this instruction' },
      {
        role: 'assistant',
        content: [{ type: 'tool-call', toolCallId: 'old', toolName: 'studio_read', input: {} }],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'old',
            toolName: 'studio_read',
            output: { type: 'json', value: { text: 'x'.repeat(5000) } },
          },
        ],
      },
      {
        role: 'assistant',
        content: [{ type: 'tool-call', toolCallId: 'new', toolName: 'studio_read', input: {} }],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'new',
            toolName: 'studio_read',
            output: { type: 'json', value: { snapshotId: 'current' } },
          },
        ],
      },
    ];
    const result = boundedProjectHistory(messages, 1500);
    expect(result[0]).toEqual(messages[0]);
    expect(result.at(-1)).toEqual(messages.at(-1));
    expect(JSON.stringify(result[2])).toContain('Read the resource again');
    expect(JSON.stringify(messages[2])).toContain('x'.repeat(5000));
  });

  it('rejects an oversized current result instead of silently truncating it', () => {
    expect(() =>
      boundedProjectHistory([{ role: 'user', content: 'x'.repeat(2000) }], 1000)
    ).toThrow('Read a smaller resource page');
  });
});
