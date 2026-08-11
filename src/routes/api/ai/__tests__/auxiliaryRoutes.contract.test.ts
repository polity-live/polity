import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  credentialDeleteParse: vi.fn(),
  credentialSaveParse: vi.fn(),
  deleteCredential: vi.fn(),
  getCatalog: vi.fn(),
  getPreferred: vi.fn(),
  getSession: vi.fn(),
  resolveModel: vi.fn(),
  streamText: vi.fn(),
  toDescriptor: vi.fn(),
  touchCredential: vi.fn(),
  upsertCredential: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
}));
vi.mock('ai', () => ({ streamText: mocks.streamText }));
vi.mock('@/lib/ai/models', () => ({
  getPreferredDefaultAiModel: mocks.getPreferred,
  toAiModelDescriptor: mocks.toDescriptor,
}));
vi.mock('@/lib/supabase/server', () => ({ getSession: mocks.getSession }));
vi.mock('@/server/ai-db', () => ({
  deleteAiCredential: mocks.deleteCredential,
  touchAiCredential: mocks.touchCredential,
  upsertAiCredential: mocks.upsertCredential,
}));
vi.mock('@/server/ai-models', () => ({
  getAiCatalog: mocks.getCatalog,
  resolveLanguageModelForUser: mocks.resolveModel,
}));
vi.mock('@/server/ai-types', () => ({
  aiCredentialDeleteSchema: { parse: mocks.credentialDeleteParse },
  aiCredentialSaveSchema: { parse: mocks.credentialSaveParse },
}));

import { Route as CatalogRoute } from '../catalog';
import { Route as CommandRoute } from '../command';
import { Route as CredentialsRoute } from '../credentials';

type Handler = (input: { request: Request }) => Promise<Response>;

function handlers(route: unknown) {
  return (route as { server: { handlers: Record<string, Handler> } }).server.handlers;
}

const catalog = handlers(CatalogRoute).GET;
const command = handlers(CommandRoute).POST;
const credentials = handlers(CredentialsRoute);

function request(body?: unknown) {
  return new Request('http://localhost/api/ai', {
    method: 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const validCommand = { messages: [{ role: 'user', content: 'Continue this' }] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
  mocks.getCatalog.mockResolvedValue({ models: [{ id: 'model-1' }], credentials: [] });
  mocks.getPreferred.mockReturnValue({ id: 'model-1' });
  mocks.toDescriptor.mockReturnValue({ provider: 'openrouter', id: 'model-1' });
  mocks.resolveModel.mockResolvedValue({
    model: { modelId: 'model-1' },
    providerOptions: { openrouter: {} },
    credentialProvider: 'openrouter',
  });
  mocks.credentialSaveParse.mockReturnValue({ provider: 'openrouter', apiKey: 'secret' });
  mocks.credentialDeleteParse.mockReturnValue({ provider: 'openrouter' });
  mocks.upsertCredential.mockResolvedValue(undefined);
  mocks.deleteCredential.mockResolvedValue(undefined);
  mocks.touchCredential.mockResolvedValue(undefined);
  mocks.streamText.mockReturnValue({
    toUIMessageStreamResponse: vi.fn(() => new Response('stream')),
  });
});

describe('AI catalogue and credential routes', () => {
  it('guards and loads the catalogue', async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    let response = await catalog({ request: request() });
    expect(response.status).toBe(401);
    response = await catalog({ request: request() });
    expect(response.status).toBe(200);
    expect(mocks.getCatalog).toHaveBeenCalledWith('user-1');
  });

  it.each(['POST', 'DELETE'] as const)('guards credential %s', async method => {
    mocks.getSession.mockResolvedValue(null);
    const response = await credentials[method]({ request: request({}) });
    expect(response.status).toBe(401);
  });

  it('saves and deletes credentials before returning the refreshed catalogue', async () => {
    let response = await credentials.POST({ request: request({ apiKey: 'secret' }) });
    expect(response.status).toBe(200);
    expect(mocks.upsertCredential).toHaveBeenCalledWith('user-1', 'openrouter', 'secret');

    response = await credentials.DELETE({ request: request({ provider: 'openrouter' }) });
    expect(response.status).toBe(200);
    expect(mocks.deleteCredential).toHaveBeenCalledWith('user-1', 'openrouter');
    expect(mocks.getCatalog).toHaveBeenCalledTimes(2);
  });
});

describe('AI editor command route', () => {
  it('rejects anonymous and malformed requests', async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    let response = await command({ request: request(validCommand) });
    expect(response.status).toBe(401);

    response = await command({ request: request({ messages: [] }) });
    expect(response.status).toBe(400);

    response = await command({
      request: new Request('http://localhost/api/ai/command', {
        method: 'POST',
        body: '{invalid',
      }),
    });
    expect(response.status).toBe(400);
  });

  it('returns a stable response when no model is available', async () => {
    mocks.getPreferred.mockReturnValue(null);
    const response = await command({ request: request(validCommand) });
    expect(response.status).toBe(400);
  });

  it('streams a command and tracks successful credential use', async () => {
    let options: Record<string, any> = {};
    const toResponse = vi.fn((streamOptions: { onError: (error: unknown) => string }) => {
      expect(streamOptions.onError(new Error('stream failed'))).toContain('ai_operation_failed');
      return new Response('stream');
    });
    mocks.streamText.mockImplementation(input => {
      options = input;
      return { toUIMessageStreamResponse: toResponse };
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await command({ request: request(validCommand) });
    expect(await response.text()).toBe('stream');
    expect(mocks.resolveModel).toHaveBeenCalledWith(
      'user-1',
      { provider: 'openrouter', id: 'model-1' },
      'medium'
    );
    expect(options.allowSystemInMessages).toBe(true);

    await options.onFinish({ text: '   ' });
    expect(mocks.touchCredential).not.toHaveBeenCalled();

    mocks.resolveModel.mockResolvedValue({
      model: { modelId: 'model-1' },
      providerOptions: undefined,
      credentialProvider: null,
    });
    await command({ request: request(validCommand) });
    await options.onFinish({ text: 'Useful completion' });
    expect(mocks.touchCredential).not.toHaveBeenCalled();

    mocks.resolveModel.mockResolvedValue({
      model: { modelId: 'model-1' },
      credentialProvider: 'openrouter',
    });
    await command({ request: request(validCommand) });
    await options.onFinish({ text: 'Useful completion' });
    expect(mocks.touchCredential).toHaveBeenCalledWith('user-1', 'openrouter');

    mocks.touchCredential.mockRejectedValueOnce(new Error('database failed'));
    await options.onFinish({ text: 'Another completion' });
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to update AI credential usage after editor command:',
      expect.any(Error)
    );
    errorSpy.mockRestore();
  });
});
