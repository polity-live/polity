import { describe, expect, it } from 'vitest';
import {
  AssistantChatStreamDecoder,
  buildToolCallPreview,
  parseAssistantChatStreamEvent,
  readAiChatErrorResponse,
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

  it('parses every event variant and validates its payload', () => {
    expect(
      parseAssistantChatStreamEvent('{"type":"compression-start","compressedMessageCount":2}')
    ).toEqual({
      type: 'compression-start',
      compressedMessageCount: 2,
    });
    expect(
      parseAssistantChatStreamEvent('{"type":"compression-start","compressedMessageCount":"2"}')
    ).toEqual({
      type: 'compression-start',
      compressedMessageCount: undefined,
    });
    expect(parseAssistantChatStreamEvent('{"type":"text-delta","text":2}')).toBeNull();
    expect(parseAssistantChatStreamEvent('{"type":"tool-call-delta"}')).toEqual({
      type: 'tool-call-delta',
    });
    expect(parseAssistantChatStreamEvent('{"type":"tool-call","toolName":2,"args":null}')).toEqual({
      type: 'tool-call',
      toolName: null,
      args: null,
    });
    expect(parseAssistantChatStreamEvent('{"type":"tool-call","toolName":"x","args":[]}')).toEqual({
      type: 'tool-call',
      toolName: 'x',
      args: null,
    });
    expect(parseAssistantChatStreamEvent('{"type":"tool-call","toolName":"x","args":1}')).toEqual({
      type: 'tool-call',
      toolName: 'x',
      args: null,
    });
    expect(parseAssistantChatStreamEvent('{"type":"tool-result","toolName":"x"}')).toEqual({
      type: 'tool-result',
      toolName: 'x',
    });
    expect(parseAssistantChatStreamEvent('{"type":"tool-result","toolName":null}')).toEqual({
      type: 'tool-result',
      toolName: null,
    });
    expect(parseAssistantChatStreamEvent('{"type":"error","message":"invalid"}')).toEqual({
      type: 'error',
      error: undefined,
    });
  });

  it('ignores invalid and blank decoder lines in push and finish', () => {
    const decoder = new AssistantChatStreamDecoder();
    expect(decoder.push('\ninvalid\n{"type":"unknown"}\n')).toEqual([]);
    expect(decoder.finish()).toEqual([]);
    expect(new AssistantChatStreamDecoder().push('partial')).toEqual([]);
    expect(new AssistantChatStreamDecoder().finish()).toEqual([]);

    const invalidTrailing = new AssistantChatStreamDecoder();
    invalidTrailing.push('invalid');
    expect(invalidTrailing.finish()).toEqual([]);
  });

  it('formats empty, scalar, null, nested, unknown, and bounded argument previews', () => {
    expect(buildToolCallPreview(null, {})).toBeNull();
    expect(buildToolCallPreview('tool', null)).toBe('tool()');
    expect(buildToolCallPreview('tool', {})).toBe('tool()');
    expect(
      buildToolCallPreview('tool', {
        nullValue: null,
        objectValue: { nested: true },
        shortArray: ['x', 2, true],
        unknownValue: undefined,
      })
    ).toBe(
      'tool(nullValue: null, objectValue: {...}, shortArray: ["x", 2, true], unknownValue: unknown)'
    );
  });

  it('reads object error responses and rejects null, primitive, and invalid JSON payloads', async () => {
    await expect(
      readAiChatErrorResponse(new Response(JSON.stringify({ error: { code: 'x' } })))
    ).resolves.toEqual({ error: { code: 'x' } });
    await expect(readAiChatErrorResponse(new Response('null'))).resolves.toEqual({});
    await expect(readAiChatErrorResponse(new Response('"text"'))).resolves.toEqual({});
    await expect(readAiChatErrorResponse(new Response('invalid'))).resolves.toEqual({});
  });
});
