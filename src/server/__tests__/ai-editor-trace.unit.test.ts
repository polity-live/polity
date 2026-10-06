import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ startAiTrace: vi.fn(), executeZeroRead: vi.fn() }));
vi.mock('../ai-trace', () => ({ startAiTrace: mocks.startAiTrace }));
vi.mock('../zero-mutate', () => ({ executeZeroRead: mocks.executeZeroRead }));
import { startEditorAiTrace } from '../ai-editor-trace';
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

it('selects the last editor user message, without logging system or assistant context', async () => {
  const body = {
    messages: [
      { role: 'system' as const, content: 'System context' },
      { role: 'user' as const, content: 'Earlier input' },
      { role: 'assistant' as const, content: 'Earlier response' },
      { role: 'user' as const, content: 'Original editor command' },
      { role: 'assistant' as const, content: 'Response' },
    ],
  };
  await startEditorAiTrace(new Request('http://localhost'), 'actor', 'editor_command', body);
  expect(mocks.startAiTrace).toHaveBeenCalledWith(
    expect.objectContaining({ invocation: 'editor_command', surface: 'editor' }),
    body,
    'Original editor command'
  );
});

it('uses the copilot input unchanged and keeps system context in the stored payload only', async () => {
  const body = { prompt: 'The original text\nContinues here', system: 'Completion rules' };
  await startEditorAiTrace(new Request('http://localhost'), 'actor', 'copilot', body);
  expect(mocks.startAiTrace).toHaveBeenCalledWith(
    expect.objectContaining({ invocation: 'copilot' }),
    body,
    body.prompt
  );
});

it('does not substitute a system message when there is no user input', async () => {
  const body = { messages: [{ role: 'system' as const, content: 'System only' }] };
  await startEditorAiTrace(new Request('http://localhost'), 'actor', 'editor_command', body);
  expect(mocks.startAiTrace).toHaveBeenCalledWith(expect.anything(), body, undefined);
});
