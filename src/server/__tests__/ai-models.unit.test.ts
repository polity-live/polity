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

import { getAiCatalog, resolveLanguageModelForUser } from '../ai-models';

const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;
const originalViteAppUrl = process.env.VITE_APP_URL;
const originalFetch = globalThis.fetch;

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

    expect(mocks.createOpenAI).toHaveBeenCalledWith({ apiKey: 'openai-key' });
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

    expect(mocks.createAnthropic).toHaveBeenCalledWith({ apiKey: 'anthropic-key' });
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
    expect(catalog.models.filter(model => model.id === 'openrouter/free')).toHaveLength(1);
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
      'Failed to load free OpenRouter models:',
      expect.any(Error)
    );
    expect(console.error).toHaveBeenCalledWith(
      'Failed to load user OpenRouter models:',
      expect.any(Error)
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
