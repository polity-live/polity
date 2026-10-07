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

it('rejects malformed document identities before reading storage or creating a trace', async () => {
  await expect(
    startEditorAiTrace(
      new Request('http://localhost', { headers: { 'X-AI-Document-Id': 'invalid' } }),
      'actor',
      'copilot',
      { prompt: 'Complete' }
    )
  ).rejects.toMatchObject({ code: 'ai_invalid_identifier' });
  expect(mocks.executeZeroRead).not.toHaveBeenCalled();
  expect(mocks.startAiTrace).not.toHaveBeenCalled();
});

it('rejects missing or inaccessible documents without persisting diagnostic context', async () => {
  mocks.executeZeroRead.mockResolvedValueOnce(null);
  await expect(
    startEditorAiTrace(
      new Request('http://localhost', { headers: { 'X-AI-Document-Id': crypto.randomUUID() } }),
      'actor',
      'editor_command',
      { prompt: 'Change' }
    )
  ).rejects.toMatchObject({ code: 'permission_denied' });
  expect(mocks.startAiTrace).not.toHaveBeenCalled();
});

it.each([null, 'amendment'])(
  'binds the accessible document and %s amendment to editor diagnostics under actual query access',
  async amendment => {
    // Keep the real schema query and access predicate; only the database read is substituted.
    const documentId = crypto.randomUUID();
    const amendmentId = amendment ? crypto.randomUUID() : null;
    const run = vi.fn().mockResolvedValue({ id: documentId, amendment_id: amendmentId });
    mocks.executeZeroRead.mockImplementationOnce(work => work({ run }));
    await startEditorAiTrace(
      new Request('http://localhost', { headers: { 'X-AI-Document-Id': documentId } }),
      'actor',
      'copilot',
      { prompt: 'Complete' }
    );
    expect(run).toHaveBeenCalledOnce();
    expect(mocks.startAiTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId,
        amendmentId: amendmentId ?? undefined,
        surface: amendmentId ? 'amendment_text' : 'editor',
        retryProvider: false,
      }),
      { prompt: 'Complete' },
      'Complete'
    );
  }
);
