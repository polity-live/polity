vi.mock('@/server/ai-trace-store', () => ({
  insertAiTrace: vi.fn(),
  insertAiOperation: vi.fn(),
  finishAiOperation: vi.fn(),
}));
import { aiProviderFetch } from '../ai-provider-fetch';
import { withAiTrace, type AiTraceContext } from '../ai-trace';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAnthropic: vi.fn(),
  createOpenAI: vi.fn(),
  getDecryptedAiCredential: vi.fn(),
  listAiCredentialSummaries: vi.fn(),
  translateText: vi.fn((key: string, fallback?: string) => fallback ?? key),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: mocks.createAnthropic,
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: mocks.createOpenAI,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: mocks.translateText,
}));

vi.mock('../ai-db', () => ({
  getDecryptedAiCredential: mocks.getDecryptedAiCredential,
  listAiCredentialSummaries: mocks.listAiCredentialSummaries,
}));

import {
  getAiCatalog,
  resolveLanguageModelForUser,
  resolveStudioFreeModel,
  resolveStudioGenerationModelForUser,
} from '../ai-models';

const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;
const originalViteAppUrl = process.env.VITE_APP_URL;
const originalFetch = globalThis.fetch;

describe('model catalog and Studio fallback boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listAiCredentialSummaries.mockResolvedValue([]);
    mocks.getDecryptedAiCredential.mockResolvedValue(null);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    globalThis.fetch = originalFetch;
  });

  it('deduplicates repeated provider model identities while preserving distinct descriptors', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'duplicate-catalog-fixture');
    const entry = { id: 'duplicate:free', name: 'Repeated', pricing: { prompt: 0, completion: 0 } };
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(openRouterResponse([entry, entry, { ...entry, id: 'distinct:free' }]));
    const catalog = await getAiCatalog('actor');
    expect(catalog.models.map(model => model.id).sort()).toEqual([
      'distinct:free',
      'duplicate:free',
    ]);
  });

  it('rejects implicit Studio inference without configured application access', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    await expect(resolveStudioFreeModel()).rejects.toThrow('Free Studio AI is not configured');
    await expect(resolveStudioGenerationModelForUser('actor')).rejects.toThrow(
      'Free Studio AI is not configured'
    );
  });

  it('resolves an omitted Studio descriptor using the verified free application catalog', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'implicit-studio-fixture');
    vi.stubEnv('STUDIO_AI_MODEL_ID', 'implicit:free');
    const { provider, chatModel } = createOpenAiProviderMock();
    mocks.createOpenAI.mockReturnValue(provider);
    globalThis.fetch = vi.fn().mockResolvedValue(
      openRouterResponse([
        {
          id: 'implicit:free',
          pricing: { prompt: 0, completion: 0 },
          supported_parameters: ['response_format'],
        },
      ])
    );
    expect(await resolveStudioGenerationModelForUser('actor')).toMatchObject({
      model: chatModel,
      supportsStructuredOutput: true,
    });
    expect(provider.chat).toHaveBeenCalledWith('implicit:free');
    expect(mocks.getDecryptedAiCredential).not.toHaveBeenCalled();
  });

  it('binds the selected credential descriptor to the current diagnostic trace', async () => {
    const descriptor = { provider: 'openai', id: 'gpt-4.1', source: 'byok' } as const;
    mocks.getDecryptedAiCredential.mockResolvedValue('personal-credential-fixture');
    const { provider, responseModel } = createOpenAiProviderMock();
    mocks.createOpenAI.mockReturnValue(provider);
    const context: AiTraceContext = {
      traceId: crypto.randomUUID(),
      actorId: 'actor',
      surface: 'studio',
      invocation: 'test',
    };
    const resolved = await withAiTrace(context, () =>
      resolveLanguageModelForUser('actor', descriptor, 'medium')
    );
    expect(context.model).toEqual(descriptor);
    expect(resolved.model).toBe(responseModel);
  });
});

function createOpenAiProviderMock() {
  const responseModel = { transport: 'responses' };
  const chatModel = { transport: 'chat' };
  const provider = Object.assign(
    vi.fn(() => responseModel),
    {
      chat: vi.fn(() => chatModel),
    }
  );

  return { chatModel, provider, responseModel };
}

describe('Studio free model selection', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    globalThis.fetch = originalFetch;
  });

  it('uses the app key and confirms both prices instead of trusting a free suffix or paid preference', async () => {
    vi.clearAllMocks();
    vi.stubEnv('OPENROUTER_API_KEY', 'studio-confirmed-free-key');
    vi.stubEnv('STUDIO_AI_MODEL_ID', 'paid/model');
    const { provider } = createOpenAiProviderMock();
    mocks.createOpenAI.mockReturnValue(provider);
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { id: 'unknown:free', pricing: { prompt: 'unknown', completion: 'unknown' } },
            { id: 'paid/model', pricing: { prompt: '0.1', completion: '0' } },
            {
              id: 'confirmed/free',
              pricing: { prompt: '0', completion: '0' },
              supported_parameters: ['response_format'],
            },
          ],
        }),
        { status: 200 }
      )
    );
    expect(await resolveStudioFreeModel()).toMatchObject({
      id: 'confirmed/free',
      supportsStructuredOutput: true,
    });
    expect(provider.chat).toHaveBeenCalledWith('confirmed/free');
    expect(mocks.getDecryptedAiCredential).not.toHaveBeenCalled();
  });

  it('fails closed when the catalog has no model with confirmed zero prices', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'studio-unconfirmed-free-key');
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: 'unknown:free', pricing: { prompt: 'unknown', completion: 'unknown' } }],
        }),
        { status: 200 }
      )
    );
    await expect(resolveStudioFreeModel()).rejects.toThrow('No verified free Studio AI model');
  });
});

function createAnthropicProviderMock() {
  const model = { transport: 'anthropic' };
  const provider = vi.fn(() => model);

  return { model, provider };
}

function mockOpenRouterCatalog(modelId: string) {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        data: [
          {
            id: modelId,
            name: 'Free Models Router',
            pricing: { prompt: '0', completion: '0' },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  );
}

describe('resolveLanguageModelForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.VITE_APP_URL;
    globalThis.fetch = originalFetch;
    mocks.getDecryptedAiCredential.mockResolvedValue(null);
    mocks.listAiCredentialSummaries.mockResolvedValue([]);
  });

  afterEach(() => {
    if (originalOpenRouterApiKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey;
    }

    if (originalViteAppUrl === undefined) {
      delete process.env.VITE_APP_URL;
    } else {
      process.env.VITE_APP_URL = originalViteAppUrl;
    }

    globalThis.fetch = originalFetch;
  });

  it('uses only the requesting actor’s selected OpenAI access for Studio generation', async () => {
    globalThis.fetch = vi.fn();
    mocks.getDecryptedAiCredential.mockImplementation(async (actor, provider) =>
      actor === 'requesting-actor' && provider === 'openai' ? 'actor-key' : null
    );
    const { provider, responseModel } = createOpenAiProviderMock();
    mocks.createOpenAI.mockReturnValue(provider);
    const result = await resolveStudioGenerationModelForUser(
      'requesting-actor',
      {
        provider: 'openai',
        id: 'gpt-4.1-mini',
        source: 'byok',
      },
      'low'
    );
    expect(result).toEqual({
      model: responseModel,
      providerOptions: { openai: { reasoningEffort: 'low' } },
      supportsStructuredOutput: true,
    });
    expect(mocks.createOpenAI).toHaveBeenCalledWith({
      apiKey: 'actor-key',
      fetch: aiProviderFetch,
    });
    expect(
      mocks.getDecryptedAiCredential.mock.calls.every(([actor]) => actor === 'requesting-actor')
    ).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not silently replace an unavailable personal Studio model with a free model', async () => {
    process.env.OPENROUTER_API_KEY = 'studio-no-fallback';
    mockOpenRouterCatalog('openrouter/free');
    await expect(
      resolveStudioGenerationModelForUser('actor', {
        provider: 'openai',
        id: 'gpt-4.1-mini',
        source: 'byok',
      })
    ).rejects.toMatchObject({ code: 'ai_model_unavailable' });
    expect(mocks.createOpenAI).not.toHaveBeenCalled();
  });

  it('rejects an app Studio model whose zero prices cannot be verified', async () => {
    process.env.OPENROUTER_API_KEY = 'studio-unknown-prices';
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: 'unknown:free', pricing: { prompt: 'unknown', completion: 'unknown' } }],
        })
      )
    );
    await expect(
      resolveStudioGenerationModelForUser('actor', {
        provider: 'openrouter',
        id: 'unknown:free',
        source: 'app',
      })
    ).rejects.toMatchObject({ code: 'ai_model_unavailable' });
    expect(mocks.createOpenAI).not.toHaveBeenCalled();
  });

  it('uses OpenAI-compatible chat completions for app-level OpenRouter free models', async () => {
    process.env.OPENROUTER_API_KEY = 'app-openrouter-key';
    mockOpenRouterCatalog('openrouter/free');
    mocks.getDecryptedAiCredential.mockResolvedValue(null);
    const { chatModel, provider } = createOpenAiProviderMock();
    mocks.createOpenAI.mockReturnValue(provider);

    const result = await resolveLanguageModelForUser(
      'user-1',
      { provider: 'openrouter', id: 'openrouter/free' },
      'medium'
    );

    expect(mocks.createOpenAI).toHaveBeenCalledWith({
      apiKey: 'app-openrouter-key',
      fetch: aiProviderFetch,
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Polity',
      },
    });
    expect(provider.chat).toHaveBeenCalledWith('openrouter/free');
    expect(provider).not.toHaveBeenCalled();
    expect(result).toEqual({
      model: chatModel,
      credentialProvider: null,
    });
  });

  it('uses OpenAI-compatible chat completions for BYOK OpenRouter models', async () => {
    mocks.getDecryptedAiCredential.mockResolvedValue('user-openrouter-key');
    globalThis.fetch = vi.fn();
    const { chatModel, provider } = createOpenAiProviderMock();
    mocks.createOpenAI.mockReturnValue(provider);

    const result = await resolveLanguageModelForUser(
      'user-1',
      { provider: 'openrouter', id: 'anthropic/claude-sonnet-4.5' },
      'high'
    );

    expect(mocks.createOpenAI).toHaveBeenCalledWith({
      apiKey: 'user-openrouter-key',
      fetch: aiProviderFetch,
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Polity',
      },
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(provider.chat).toHaveBeenCalledWith('anthropic/claude-sonnet-4.5');
    expect(provider).not.toHaveBeenCalled();
    expect(result).toEqual({
      model: chatModel,
      credentialProvider: 'openrouter',
    });
  });

  it('keeps native OpenAI model resolution on the OpenAI provider', async () => {
    mocks.getDecryptedAiCredential.mockResolvedValue('openai-key');
    const { provider, responseModel } = createOpenAiProviderMock();
    mocks.createOpenAI.mockReturnValue(provider);

    const result = await resolveLanguageModelForUser(
      'user-1',
      { provider: 'openai', id: 'gpt-4.1-mini' },
      'low'
    );

    expect(mocks.createOpenAI).toHaveBeenCalledWith({
      apiKey: 'openai-key',
      fetch: aiProviderFetch,
    });
    expect(provider).toHaveBeenCalledWith('gpt-4.1-mini');
    expect(provider.chat).not.toHaveBeenCalled();
    expect(result).toEqual({
      model: responseModel,
      credentialProvider: 'openai',
      providerOptions: { openai: { reasoningEffort: 'low' } },
    });
  });

  it('keeps Anthropic model resolution and reasoning provider options', async () => {
    mocks.getDecryptedAiCredential.mockResolvedValue('anthropic-key');
    const { model, provider } = createAnthropicProviderMock();
    mocks.createAnthropic.mockReturnValue(provider);

    const result = await resolveLanguageModelForUser(
      'user-1',
      { provider: 'anthropic', id: 'claude-sonnet-4-5' },
      'high'
    );

    expect(mocks.createAnthropic).toHaveBeenCalledWith({
      apiKey: 'anthropic-key',
      fetch: aiProviderFetch,
    });
    expect(provider).toHaveBeenCalledWith('claude-sonnet-4-5');
    expect(result).toEqual({
      model,
      providerOptions: {
        anthropic: {
          effort: 'high',
        },
      },
      credentialProvider: 'anthropic',
    });
  });
});

function openRouterResponse(data: unknown[], ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue({ data }),
  } as unknown as Response;
}

describe('getAiCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.VITE_APP_URL;
    mocks.getDecryptedAiCredential.mockResolvedValue(null);
    mocks.listAiCredentialSummaries.mockResolvedValue([{ provider: 'openai', hint: '...1234' }]);
    globalThis.fetch = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses, filters, deduplicates and orders app and BYOK model catalogs', async () => {
    process.env.OPENROUTER_API_KEY = 'catalog-app-key';
    process.env.VITE_APP_URL = 'https://polity.test';
    mocks.getDecryptedAiCredential.mockImplementation(async (_userId, provider) => {
      if (provider === 'openrouter') return 'catalog-user-key';
      if (provider === 'openai') return 'openai-key';
      if (provider === 'anthropic') return 'anthropic-key';
      return null;
    });
    vi.mocked(globalThis.fetch).mockImplementation(async (_url, init) => {
      const authorization = ((init?.headers ?? {}) as Record<string, string>).Authorization;
      if (authorization === 'Bearer catalog-app-key') {
        return openRouterResponse([
          {
            id: 'openrouter/free',
            name: ' Z Free Router ',
            pricing: { prompt: '0', completion: '0' },
            context_length: '128000',
          },
          {
            id: 'vendor/colon:free',
            name: '',
            pricing: { prompt: 'invalid', completion: null },
            context_length: -5.9,
          },
          {
            id: 'vendor/numeric-free',
            name: null,
            pricing: { prompt: 0, completion: 0 },
            context_length: 'invalid',
          },
          {
            id: 'vendor/paid',
            name: 'Paid',
            pricing: { prompt: 1, completion: 0 },
            context_length: null,
          },
          {
            id: 'vendor/completion-paid',
            name: 'Completion paid',
            pricing: { prompt: 0, completion: 2 },
          },
        ]);
      }
      return openRouterResponse([
        {
          id: 'openrouter/free',
          name: 'Duplicate free',
          pricing: { prompt: 0, completion: 0 },
          context_length: 100.8,
        },
        {
          id: 'vendor/paid',
          name: ' A Paid ',
          pricing: { prompt: '0.1', completion: '0.2' },
          context_length: 50.9,
        },
        {
          id: 'vendor/unpriced',
          pricing: null,
          context_length: undefined,
        },
      ]);
    });

    const catalog = await getAiCatalog('user-1');
    expect(catalog.credentials).toEqual([{ provider: 'openai', hint: '...1234' }]);
    expect(catalog.models[0]).toMatchObject({
      id: 'openrouter/free',
      label: 'Z Free Router',
      source: 'app',
      free: true,
      context_window: 128000,
    });
    expect(
      catalog.models
        .filter(model => model.id === 'openrouter/free')
        .map(model => model.source)
        .sort()
    ).toEqual(['app', 'byok']);
    expect(catalog.models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'vendor/colon:free', free: true, context_window: 0 }),
        expect.objectContaining({
          id: 'vendor/numeric-free',
          free: true,
          context_window: null,
        }),
        expect.objectContaining({ id: 'vendor/paid', free: false, context_window: 50 }),
        expect.objectContaining({ id: 'vendor/unpriced', label: 'vendor/unpriced', free: false }),
        expect.objectContaining({ provider: 'openai', id: 'gpt-4.1-mini' }),
        expect.objectContaining({ provider: 'anthropic', id: 'claude-haiku-4-5' }),
      ])
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({ 'HTTP-Referer': 'https://polity.test' }),
      })
    );
  });

  it('uses the first app-free model when the exact router is absent and leaves an index-zero default', async () => {
    process.env.OPENROUTER_API_KEY = 'fallback-free-key';
    vi.mocked(globalThis.fetch).mockResolvedValue(
      openRouterResponse([
        {
          id: 'a/free:free',
          name: 'A free',
          pricing: { prompt: 'unknown', completion: 'unknown' },
        },
      ])
    );
    const catalog = await getAiCatalog('user-1');
    expect(catalog.models[0]).toMatchObject({ id: 'a/free:free', source: 'app', free: true });
  });

  it('returns credentials without models when no providers are configured', async () => {
    const catalog = await getAiCatalog('user-1');
    expect(catalog).toEqual({
      credentials: [{ provider: 'openai', hint: '...1234' }],
      models: [],
    });
  });

  it('logs app and user OpenRouter failures while retaining native provider models', async () => {
    process.env.OPENROUTER_API_KEY = 'failure-app-key';
    mocks.getDecryptedAiCredential.mockImplementation(async (_userId, provider) =>
      provider === 'openrouter' ? 'failure-user-key' : provider === 'openai' ? 'openai-key' : null
    );
    vi.mocked(globalThis.fetch).mockResolvedValue(openRouterResponse([], false, 503));
    const catalog = await getAiCatalog('user-1');
    expect(catalog.models.some(model => model.provider === 'openai')).toBe(true);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load free OpenRouter models:')
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load user OpenRouter models:')
    );
  });

  it('reuses a valid cache entry and refreshes it after expiry', async () => {
    process.env.OPENROUTER_API_KEY = 'cache-model-key';
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    vi.mocked(globalThis.fetch).mockResolvedValue(
      openRouterResponse([
        { id: 'cache:free', pricing: { prompt: 0, completion: 0 }, context_length: 10 },
      ])
    );
    const first = await getAiCatalog('user-1');
    const cached = await getAiCatalog('user-1');
    expect(cached.models).toEqual(first.models);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    now.mockReturnValue(301_001);
    await getAiCatalog('user-1');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('coalesces an in-flight app catalog request', async () => {
    process.env.OPENROUTER_API_KEY = 'promise-model-key';
    let resolveFetch!: (response: Response) => void;
    vi.mocked(globalThis.fetch).mockReturnValue(
      new Promise(resolve => {
        resolveFetch = resolve;
      })
    );
    const first = getAiCatalog('user-1');
    const second = getAiCatalog('user-1');
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    resolveFetch(
      openRouterResponse([{ id: 'promise:free', pricing: { prompt: 0, completion: 0 } }])
    );
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  });

  it('keeps a newer in-flight key while an older request finishes', async () => {
    const resolvers = new Map<string, (response: Response) => void>();
    vi.mocked(globalThis.fetch).mockImplementation((_url, init) => {
      const key = ((init?.headers ?? {}) as Record<string, string>).Authorization;
      return new Promise(resolve => resolvers.set(key, resolve));
    });
    process.env.OPENROUTER_API_KEY = 'parallel-key-a';
    const first = getAiCatalog('user-1');
    await vi.waitFor(() => expect(resolvers.has('Bearer parallel-key-a')).toBe(true));
    process.env.OPENROUTER_API_KEY = 'parallel-key-b';
    const second = getAiCatalog('user-1');
    await vi.waitFor(() => expect(resolvers.has('Bearer parallel-key-b')).toBe(true));
    resolvers.get('Bearer parallel-key-a')!(
      openRouterResponse([{ id: 'a:free', pricing: { prompt: 0, completion: 0 } }])
    );
    await first;
    resolvers.get('Bearer parallel-key-b')!(
      openRouterResponse([{ id: 'b:free', pricing: { prompt: 0, completion: 0 } }])
    );
    await second;
  });
});

describe('resolveLanguageModelForUser errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.VITE_APP_URL;
    mocks.getDecryptedAiCredential.mockResolvedValue(null);
    globalThis.fetch = vi.fn();
  });

  it('never uses a saved personal key when the caller explicitly selects app access', async () => {
    process.env.OPENROUTER_API_KEY = 'explicit-app-key';
    mockOpenRouterCatalog('openrouter/free');
    mocks.getDecryptedAiCredential.mockResolvedValue('personal-key');
    const { provider } = createOpenAiProviderMock();
    mocks.createOpenAI.mockReturnValue(provider);
    await resolveLanguageModelForUser(
      'actor-1',
      { provider: 'openrouter', id: 'openrouter/free', source: 'app' },
      'low'
    );
    expect(mocks.getDecryptedAiCredential).not.toHaveBeenCalled();
    expect(mocks.createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'explicit-app-key' })
    );
  });

  it('does not fall back to the app key if an explicitly selected personal key is missing', async () => {
    process.env.OPENROUTER_API_KEY = 'available-app-key';
    await expect(
      resolveLanguageModelForUser(
        'actor-2',
        { provider: 'openrouter', id: 'openrouter/free', source: 'byok' },
        'low'
      )
    ).rejects.toMatchObject({ code: 'ai_credentials_missing' });
    expect(mocks.getDecryptedAiCredential).toHaveBeenCalledWith('actor-2', 'openrouter');
    expect(mocks.createOpenAI).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects ChatGPT inference and invalid app sources even with personal credentials present', async () => {
    mocks.getDecryptedAiCredential.mockResolvedValue('personal-key');
    for (const source of ['app', 'chatgpt'] as const) {
      await expect(
        resolveLanguageModelForUser(
          'actor-3',
          { provider: 'openai', id: 'gpt-4.1', source },
          'medium'
        )
      ).rejects.toMatchObject({ code: 'ai_access_unavailable' });
    }
    expect(mocks.getDecryptedAiCredential).not.toHaveBeenCalled();
    expect(mocks.createOpenAI).not.toHaveBeenCalled();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('requires an app OpenRouter key and restricts app models to the free catalog', async () => {
    await expect(
      resolveLanguageModelForUser(
        'user-1',
        { provider: 'openrouter', id: 'openrouter/free' },
        'low'
      )
    ).rejects.toThrow('OPENROUTER_API_KEY is not configured');

    process.env.OPENROUTER_API_KEY = 'restricted-app-key';
    vi.mocked(globalThis.fetch).mockResolvedValue(
      openRouterResponse([{ id: 'other:free', pricing: { prompt: 0, completion: 0 } }])
    );
    await expect(
      resolveLanguageModelForUser('user-1', { provider: 'openrouter', id: 'paid/model' }, 'low')
    ).rejects.toThrow('Selected OpenRouter model requires a personal API key.');
  });

  it('detects an app key removed while its free catalog is loading', async () => {
    process.env.OPENROUTER_API_KEY = 'transient-app-key';
    let resolveFetch!: (response: Response) => void;
    vi.mocked(globalThis.fetch).mockReturnValue(
      new Promise(resolve => {
        resolveFetch = resolve;
      })
    );
    const resolving = resolveLanguageModelForUser(
      'user-1',
      { provider: 'openrouter', id: 'transient:free' },
      'low'
    );
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    delete process.env.OPENROUTER_API_KEY;
    resolveFetch(
      openRouterResponse([{ id: 'transient:free', pricing: { prompt: 0, completion: 0 } }])
    );
    await expect(resolving).rejects.toThrow('OPENROUTER_API_KEY is not configured');
  });

  it('requires personal OpenAI and Anthropic credentials', async () => {
    await expect(
      resolveLanguageModelForUser('user-1', { provider: 'openai', id: 'gpt-4.1' }, 'medium')
    ).rejects.toThrow('No personal OpenAI API key is configured.');
    await expect(
      resolveLanguageModelForUser(
        'user-1',
        { provider: 'anthropic', id: 'claude-sonnet-4-5' },
        'medium'
      )
    ).rejects.toThrow('No personal Anthropic API key is configured.');
  });
});
