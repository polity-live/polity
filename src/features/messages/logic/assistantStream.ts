import { parseAppError, type AppErrorPayload } from '@/features/shared/errors/app-error';

export type AssistantChatStreamEvent =
  | { type: 'compression-start'; compressedMessageCount?: number }
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call-delta' }
  | { type: 'tool-call'; toolName: string | null; args: Record<string, unknown> | null }
  | { type: 'tool-result'; toolName: string | null }
  | { type: 'error'; error?: AppErrorPayload };

export interface AiChatErrorResponse {
  error?: AppErrorPayload;
}

export function parseAssistantChatStreamEvent(rawLine: string): AssistantChatStreamEvent | null {
  try {
    const parsed = JSON.parse(rawLine) as Record<string, unknown>;

    switch (parsed.type) {
      case 'compression-start':
        return {
          type: 'compression-start',
          compressedMessageCount:
            typeof parsed.compressedMessageCount === 'number'
              ? parsed.compressedMessageCount
              : undefined,
        };
      case 'text-delta':
        return typeof parsed.text === 'string' ? { type: 'text-delta', text: parsed.text } : null;
      case 'tool-call-delta':
        return { type: 'tool-call-delta' };
      case 'tool-call':
        return {
          type: 'tool-call',
          toolName: typeof parsed.toolName === 'string' ? parsed.toolName : null,
          args:
            parsed.args && typeof parsed.args === 'object' && !Array.isArray(parsed.args)
              ? (parsed.args as Record<string, unknown>)
              : null,
        };
      case 'tool-result':
        return {
          type: 'tool-result',
          toolName: typeof parsed.toolName === 'string' ? parsed.toolName : null,
        };
      case 'error':
        return {
          type: 'error',
          error: parseAppError(parsed) ?? undefined,
        };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export class AssistantChatStreamDecoder {
  private buffer = '';

  push(chunk: string): AssistantChatStreamEvent[] {
    this.buffer += chunk;
    const events: AssistantChatStreamEvent[] = [];
    let newlineIndex = this.buffer.indexOf('\n');

    while (newlineIndex !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      const event = line ? parseAssistantChatStreamEvent(line) : null;
      if (event) {
        events.push(event);
      }
      newlineIndex = this.buffer.indexOf('\n');
    }

    return events;
  }

  finish(): AssistantChatStreamEvent[] {
    const line = this.buffer.trim();
    this.buffer = '';
    const event = line ? parseAssistantChatStreamEvent(line) : null;
    return event ? [event] : [];
  }
}

function formatToolCallValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null) return 'null';

  if (Array.isArray(value)) {
    const preview = value
      .slice(0, 3)
      .map(item => formatToolCallValue(item))
      .join(', ');
    return `[${preview}${value.length > 3 ? ', ...' : ''}]`;
  }

  if (typeof value === 'object') return '{...}';
  return 'unknown';
}

export function buildToolCallPreview(
  toolName: string | null,
  args?: Record<string, unknown> | null
): string | null {
  if (!toolName) return null;
  if (!args || Object.keys(args).length === 0) return `${toolName}()`;

  const serializedArgs = Object.entries(args)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${formatToolCallValue(value)}`)
    .join(', ');

  return `${toolName}(${serializedArgs}${Object.keys(args).length > 4 ? ', ...' : ''})`;
}

export async function readAiChatErrorResponse(response: Response): Promise<AiChatErrorResponse> {
  try {
    const payload = (await response.json()) as AiChatErrorResponse;
    return payload && typeof payload === 'object' ? payload : {};
  } catch {
    return {};
  }
}
