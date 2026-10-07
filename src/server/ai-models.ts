import { traceAiOperation, logAiEvent, normalizeAiError, currentAiTrace } from './ai-trace';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { aiProviderFetch } from './ai-provider-fetch';
import type { SharedV4ProviderOptions } from '@ai-sdk/provider';
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import { AiAccessError } from '@/lib/ai/errors';
import { buildAiModelKey, matchesAiModel, OPENROUTER_FREE_MODEL_ID } from '@/lib/ai/models';
import type {
  AiCredentialSource,
  AiModelDescriptor,
  AiProvider,
  AiReasoningEffort,
} from '@/lib/ai/schemas';
import { getDecryptedAiCredential, listAiCredentialSummaries } from './ai-db';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

const OPENROUTER_FREE_MODEL_CACHE_TTL_MS = 5 * 60 * 1000;

const openRouterModelSchema = z.object({
  supported_parameters: z.array(z.string()).optional(),
  id: z.string(),
  name: z.string().nullable().optional(),
  context_length: z.union([z.number(), z.string()]).nullable().optional(),
  pricing: z
    .object({
      prompt: z.union([z.number(), z.string()]).nullable().optional(),
      completion: z.union([z.number(), z.string()]).nullable().optional(),
    })
    .nullable()
    .optional(),
});

const openRouterResponseSchema = z.object({
  data: z.array(openRouterModelSchema),
});

export interface AiModelOption {
  provider: AiProvider;
  id: string;
  label: string;
  source: AiCredentialSource;
  free: boolean;
  supports_reasoning_effort: boolean;
  supports_tools?: boolean;
  verified_free?: boolean;
  supports_structured_output?: boolean;
  context_window: number | null;
}

interface ResolveModelResult {
  model: LanguageModel;
  providerOptions?: SharedV4ProviderOptions;
  credentialProvider: AiProvider | null;
}

let appOpenRouterFreeModelsCache: {
  apiKey: string;
  expiresAtMs: number;
  models: AiModelOption[];
} | null = null;
let appOpenRouterFreeModelsPromise: {
  apiKey: string;
  promise: Promise<AiModelOption[]>;
} | null = null;

const OPENAI_MODELS: readonly AiModelOption[] = [
  {
    provider: 'openai',
    id: 'gpt-4.1-mini',
    label: translateText('generated.inline.0625_openai_gpt_4_1_mini_11c5f625'),
    source: 'byok',
    free: false,
    supports_reasoning_effort: true,
    context_window: 1047576,
  },
  {
    provider: 'openai',
    id: 'gpt-4.1',
    label: translateText('generated.inline.0626_openai_gpt_4_1_4d2716d2'),
    source: 'byok',
    free: false,
    supports_reasoning_effort: true,
    context_window: 1047576,
  },
  {
    provider: 'openai',
    id: 'o4-mini',
    label: translateText('generated.inline.0627_openai_o4_mini_1428ccf2'),
    source: 'byok',
    free: false,
    supports_reasoning_effort: true,
    context_window: 200000,
  },
  {
    provider: 'openai',
    id: 'o3',
    label: translateText('generated.inline.0628_openai_o3_1edeb091'),
    source: 'byok',
    free: false,
    supports_reasoning_effort: true,
    context_window: 200000,
  },
] as const;

const ANTHROPIC_MODELS: readonly AiModelOption[] = [
  {
    provider: 'anthropic',
    id: 'claude-haiku-4-5',
    label: translateText('generated.inline.0629_anthropic_claude_haiku_4_5_109ddf7f'),
    source: 'byok',
    free: false,
    supports_reasoning_effort: true,
    context_window: 200000,
  },
  {
    provider: 'anthropic',
    id: 'claude-sonnet-4-5',
    label: translateText('generated.inline.0630_anthropic_claude_sonnet_4_5_474a5073'),
    source: 'byok',
    free: false,
    supports_reasoning_effort: true,
    context_window: 200000,
  },
  {
    provider: 'anthropic',
    id: 'claude-opus-4-1',
    label: translateText('generated.inline.0631_anthropic_claude_opus_4_1_c638eb74'),
    source: 'byok',
    free: false,
    supports_reasoning_effort: true,
    context_window: 200000,
  },
] as const;

function parsePrice(value: number | string | null | undefined): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  return Number.NaN;
}

function parseContextWindow(value: number | string | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return null;
}

function isOpenRouterFreeModel(model: z.infer<typeof openRouterModelSchema>): boolean {
  const promptPrice = parsePrice(model.pricing?.prompt);
  const completionPrice = parsePrice(model.pricing?.completion);

  if (Number.isFinite(promptPrice) && Number.isFinite(completionPrice)) {
    return promptPrice === 0 && completionPrice === 0;
  }

  return model.id.toLowerCase().includes(':free');
}

async function fetchOpenRouterModels(
  apiKey: string,
  source: 'app' | 'byok',
  freeOnly: boolean
): Promise<AiModelOption[]> {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'HTTP-Referer': process.env.VITE_APP_URL ?? 'http://localhost:3000',
      'X-Title': 'Polity',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`OpenRouter model catalog request failed with status ${response.status}`);
  }

  const payload = openRouterResponseSchema.parse(await response.json());

  return payload.data
    .filter(model => !freeOnly || isOpenRouterFreeModel(model))
    .map(model => ({
      provider: 'openrouter' as const,
      id: model.id,
      label: model.name?.trim() || model.id,
      source,
      free: isOpenRouterFreeModel(model),
      verified_free:
        parsePrice(model.pricing?.prompt) === 0 && parsePrice(model.pricing?.completion) === 0,
      supports_structured_output: model.supported_parameters?.includes('response_format') ?? false,
      supports_reasoning_effort: model.supported_parameters?.includes('reasoning') ?? false,
      supports_tools:
        model.supported_parameters?.includes('tools') ?? model.id === 'openrouter/free',
      context_window: parseContextWindow(model.context_length),
    }));
}

async function fetchAppOpenRouterFreeModels(apiKey: string): Promise<AiModelOption[]> {
  const now = Date.now();

  if (
    appOpenRouterFreeModelsCache?.apiKey === apiKey &&
    appOpenRouterFreeModelsCache.expiresAtMs > now
  ) {
    return appOpenRouterFreeModelsCache.models;
  }

  if (appOpenRouterFreeModelsPromise?.apiKey === apiKey) {
    return appOpenRouterFreeModelsPromise.promise;
  }

  const promise = fetchOpenRouterModels(apiKey, 'app', true)
    .then(models => {
      appOpenRouterFreeModelsCache = {
        apiKey,
        expiresAtMs: Date.now() + OPENROUTER_FREE_MODEL_CACHE_TTL_MS,
        models,
      };

      return models;
    })
    .finally(() => {
      if (appOpenRouterFreeModelsPromise?.promise === promise) {
        appOpenRouterFreeModelsPromise = null;
      }
    });

  appOpenRouterFreeModelsPromise = { apiKey, promise };

  return promise;
}

function dedupeModels(models: readonly AiModelOption[]): AiModelOption[] {
  const seen = new Set<string>();
  return models.filter(model => {
    const key = buildAiModelKey(model);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export async function getAiCatalog(userId: string): Promise<{
  credentials: Awaited<ReturnType<typeof listAiCredentialSummaries>>;
  models: AiModelOption[];
}> {
  const credentials = await listAiCredentialSummaries(userId);
  const models: AiModelOption[] = [];

  const appOpenRouterKey = process.env.OPENROUTER_API_KEY;
  if (appOpenRouterKey) {
    try {
      models.push(...(await fetchAppOpenRouterFreeModels(appOpenRouterKey)));
    } catch (error) {
      logAiEvent('ai.configuration.failed', {
        operation: 'Failed to load free OpenRouter models:',
        ...normalizeAiError(error),
      });
    }
  }

  const userOpenRouterKey = await getDecryptedAiCredential(userId, 'openrouter');
  if (userOpenRouterKey) {
    try {
      models.push(...(await fetchOpenRouterModels(userOpenRouterKey, 'byok', false)));
    } catch (error) {
      logAiEvent('ai.configuration.failed', {
        operation: 'Failed to load user OpenRouter models:',
        ...normalizeAiError(error),
      });
    }
  }

  if (await getDecryptedAiCredential(userId, 'openai')) {
    models.push(...OPENAI_MODELS);
  }

  if (await getDecryptedAiCredential(userId, 'anthropic')) {
    models.push(...ANTHROPIC_MODELS);
  }

  const sortedModels = dedupeModels(models).sort((left, right) =>
    left.label.localeCompare(right.label)
  );
  const exactFreeRouterModelIndex = sortedModels.findIndex(
    model =>
      model.provider === 'openrouter' &&
      model.source === 'app' &&
      model.free &&
      model.id === OPENROUTER_FREE_MODEL_ID
  );
  const defaultFreeModelIndex =
    exactFreeRouterModelIndex >= 0
      ? exactFreeRouterModelIndex
      : sortedModels.findIndex(
          model => model.provider === 'openrouter' && model.source === 'app' && model.free
        );

  if (defaultFreeModelIndex > 0) {
    const [defaultModel] = sortedModels.splice(defaultFreeModelIndex, 1);
    sortedModels.unshift(defaultModel);
  }

  return {
    credentials,
    models: sortedModels,
  };
}

async function assertAppOpenRouterFreeModel(modelId: string): Promise<void> {
  const appOpenRouterKey = process.env.OPENROUTER_API_KEY;

  if (!appOpenRouterKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const freeModels = await fetchAppOpenRouterFreeModels(appOpenRouterKey);
  const isAllowed = freeModels.some(model => model.id === modelId);

  if (!isAllowed) {
    throw new Error('Selected OpenRouter model requires a personal API key.');
  }
}

/** Studio generation uses the application key and only models with confirmed zero prices. */
export async function resolveStudioFreeModel(): Promise<{
  model: LanguageModel;
  id: string;
  supportsStructuredOutput: boolean;
}> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Free Studio AI is not configured');
  const models = (await fetchAppOpenRouterFreeModels(apiKey)).filter(
    option => option.verified_free
  );
  const preferred = process.env.STUDIO_AI_MODEL_ID;
  const selected =
    (preferred ? models.find(option => option.id === preferred) : undefined) ?? models[0];
  if (!selected) throw new Error('No verified free Studio AI model is available');
  const provider = createOpenAI({
    fetch: aiProviderFetch,
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    headers: {
      'HTTP-Referer': process.env.VITE_APP_URL ?? 'http://localhost:3000',
      'X-Title': 'Polity',
    },
  });
  return {
    model: provider.chat(selected.id),
    id: selected.id,
    supportsStructuredOutput: !!selected.supports_structured_output,
  };
}

async function resolveLanguageModelForUserImpl(
  userId: string,
  modelDescriptor: AiModelDescriptor,
  reasoningEffort: AiReasoningEffort
): Promise<ResolveModelResult> {
  // Hosted ChatGPT plan usage requires its own approved integration. Identity
  // sign-in must never be treated as an inference grant or an API key.
  if (modelDescriptor.source === 'chatgpt') {
    throw new AiAccessError(
      'ai_access_unavailable',
      'ChatGPT plan usage is not available for this application.'
    );
  }
  if (modelDescriptor.source === 'app' && modelDescriptor.provider !== 'openrouter') {
    throw new AiAccessError(
      'ai_access_unavailable',
      'Application credentials are available only for free OpenRouter models.'
    );
  }
  if (modelDescriptor.provider === 'openrouter') {
    const userKey =
      modelDescriptor.source === 'app'
        ? null
        : await getDecryptedAiCredential(userId, 'openrouter');

    if (modelDescriptor.source === 'byok' && !userKey) {
      throw new AiAccessError(
        'ai_credentials_missing',
        'No personal OpenRouter API key is configured.'
      );
    }

    if (!userKey) {
      await assertAppOpenRouterFreeModel(modelDescriptor.id);

      const appKey = process.env.OPENROUTER_API_KEY;
      if (!appKey) {
        throw new Error('OPENROUTER_API_KEY is not configured');
      }

      const provider = createOpenAI({
        fetch: aiProviderFetch,
        apiKey: appKey,
        baseURL: 'https://openrouter.ai/api/v1',
        headers: {
          'HTTP-Referer': process.env.VITE_APP_URL ?? 'http://localhost:3000',
          'X-Title': 'Polity',
        },
      });

      return {
        model: provider.chat(modelDescriptor.id),
        credentialProvider: null,
      };
    }

    const provider = createOpenAI({
      fetch: aiProviderFetch,
      apiKey: userKey,
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        'HTTP-Referer': process.env.VITE_APP_URL ?? 'http://localhost:3000',
        'X-Title': 'Polity',
      },
    });

    return {
      model: provider.chat(modelDescriptor.id),
      credentialProvider: 'openrouter',
    };
  }

  if (modelDescriptor.provider === 'openai') {
    const apiKey = await getDecryptedAiCredential(userId, 'openai');
    if (!apiKey) {
      throw new AiAccessError(
        'ai_credentials_missing',
        'No personal OpenAI API key is configured.'
      );
    }

    const provider = createOpenAI({
      fetch: aiProviderFetch,
      apiKey,
    });

    return {
      model: provider(modelDescriptor.id),
      providerOptions: {
        openai: { reasoningEffort },
      },
      credentialProvider: 'openai',
    };
  }

  const apiKey = await getDecryptedAiCredential(userId, 'anthropic');
  if (!apiKey) {
    throw new AiAccessError(
      'ai_credentials_missing',
      'No personal Anthropic API key is configured.'
    );
  }

  const provider = createAnthropic({ apiKey, fetch: aiProviderFetch });

  return {
    model: provider(modelDescriptor.id),
    providerOptions: {
      anthropic: {
        effort: reasoningEffort,
      },
    },
    credentialProvider: 'anthropic',
  };
}

/** The chosen actor pays for generation; only legacy callers use Studio's free default. */
export async function resolveStudioGenerationModelForUser(
  userId: string,
  descriptor?: AiModelDescriptor,
  reasoningEffort: AiReasoningEffort = 'medium'
): Promise<{
  model: LanguageModel;
  providerOptions?: SharedV4ProviderOptions;
  supportsStructuredOutput: boolean;
}> {
  if (!descriptor) return resolveStudioFreeModel();
  const catalog = await getAiCatalog(userId);
  const selected = catalog.models.find(option => matchesAiModel(option, descriptor));
  if (!selected)
    throw new AiAccessError('ai_model_unavailable', 'The selected Studio model is unavailable.');
  if (selected.source === 'app' && !selected.verified_free) {
    throw new AiAccessError(
      'ai_model_unavailable',
      'Studio requires confirmed zero prices for application models.'
    );
  }
  const resolved = await resolveLanguageModelForUser(userId, descriptor, reasoningEffort);
  return {
    model: resolved.model,
    providerOptions: resolved.providerOptions,
    supportsStructuredOutput: selected.supports_structured_output ?? selected.provider === 'openai',
  };
}

export async function resolveLanguageModelForUser(
  ...args: Parameters<typeof resolveLanguageModelForUserImpl>
) {
  const context = currentAiTrace();
  if (context) context.model = args[1];
  return traceAiOperation(
    'configuration',
    'resolve_model',
    { model: args[1], reasoningEffort: args[2] },
    () => resolveLanguageModelForUserImpl(...args)
  );
}
