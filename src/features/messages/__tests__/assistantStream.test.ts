import { describe, expect, it } from 'vitest';
import {
  AssistantChatStreamDecoder,
  buildToolCallPreview,
  parseAssistantChatStreamEvent,
} from '../logic/assistantStream';

describe('assistant stream decoding', () => {
  it('parses discriminated stream events and ignores invalid input', () => {
    expect(parseAssistantChatStreamEvent('{"type":"text-delta","text":"Hallo"}')).toEqual({
      type: 'text-delta',
      text: 'Hallo',
    });
    expect(parseAssistantChatStreamEvent('{"type":"unknown"}')).toBeNull();
    expect(parseAssistantChatStreamEvent('not-json')).toBeNull();
  });

  it('handles split chunks, multiple lines, blank lines, and a trailing event', () => {
    const decoder = new AssistantChatStreamDecoder();

    expect(decoder.push('{"type":"text-delta","text":"Hel')).toEqual([]);
    expect(
      decoder.push(
        'lo"}\n\n{"type":"tool-call","toolName":"find_event","args":{"id":"1"}}\n{"type":"error"'
      )
    ).toEqual([
      { type: 'text-delta', text: 'Hello' },
      { type: 'tool-call', toolName: 'find_event', args: { id: '1' } },
    ]);
    expect(decoder.push(',"error":{"version":1,"code":"ai_operation_failed"}}')).toEqual([]);
    expect(decoder.finish()).toEqual([
      {
        type: 'error',
        error: { version: 1, code: 'ai_operation_failed' },
      },
    ]);
  });

  it('builds a compact and bounded tool argument preview', () => {
    expect(
      buildToolCallPreview('find_event', {
        query: 'Budget',
        limit: 3,
        includePast: false,
        filters: ['group', 'public', 'open', 'extra'],
        ignored: 'value',
      })
    ).toBe(
      'find_event(query: "Budget", limit: 3, includePast: false, filters: ["group", "public", "open", ...], ...)'
    );
  });
});
