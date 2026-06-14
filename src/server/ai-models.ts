import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV1ProviderMetadata } from '@ai-sdk/provider';
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import type { AiModelDescriptor, AiProvider, AiReasoningEffort } from '@/lib/ai/schemas';
import { getDecryptedAiCredential, listAiCredentialSummaries } from './ai-db';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

const openRouterModelSchema = z.object({
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
  source: 'app' | 'byok';
  free: boolean;
  supports_reasoning_effort: boolean;
  context_window: number | null;
}

interface ResolveModelResult {
  model: LanguageModel;
  providerOptions?: LanguageModelV1ProviderMetadata;
  credentialProvider: AiProvider | null;
}

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
      supports_reasoning_effort: true,
      context_window: parseContextWindow(model.context_length),
    }));
}

function dedupeModels(models: readonly AiModelOption[]): AiModelOption[] {
  const seen = new Set<string>();
  return models.filter(model => {
    const key = `${model.provider}:${model.id}`;
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
      models.push(...(await fetchOpenRouterModels(appOpenRouterKey, 'app', true)));
    } catch (error) {
      console.error('Failed to load free OpenRouter models:', error);
    }
  }

  const userOpenRouterKey = await getDecryptedAiCredential(userId, 'openrouter');
  if (userOpenRouterKey) {
    try {
      models.push(...(await fetchOpenRouterModels(userOpenRouterKey, 'byok', false)));
    } catch (error) {
      console.error('Failed to load user OpenRouter models:', error);
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
  const defaultFreeModelIndex = sortedModels.findIndex(
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

  const freeModels = await fetchOpenRouterModels(appOpenRouterKey, 'app', true);
  const isAllowed = freeModels.some(model => model.id === modelId);

  if (!isAllowed) {
    throw new Error('Selected OpenRouter model requires a personal API key.');
  }
}

export async function resolveLanguageModelForUser(
  userId: string,
  modelDescriptor: AiModelDescriptor,
  reasoningEffort: AiReasoningEffort
): Promise<ResolveModelResult> {
  if (modelDescriptor.provider === 'openrouter') {
    const userKey = await getDecryptedAiCredential(userId, 'openrouter');

    if (!userKey) {
      await assertAppOpenRouterFreeModel(modelDescriptor.id);

      const appKey = process.env.OPENROUTER_API_KEY;
      if (!appKey) {
        throw new Error('OPENROUTER_API_KEY is not configured');
      }

      const provider = createOpenAI({
        apiKey: appKey,
        baseURL: 'https://openrouter.ai/api/v1',
        headers: {
          'HTTP-Referer': process.env.VITE_APP_URL ?? 'http://localhost:3000',
          'X-Title': 'Polity',
        },
      });

      return {
        model: provider(modelDescriptor.id, { reasoningEffort }),
        credentialProvider: null,
      };
    }

    const provider = createOpenAI({
      apiKey: userKey,
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        'HTTP-Referer': process.env.VITE_APP_URL ?? 'http://localhost:3000',
        'X-Title': 'Polity',
      },
    });

    return {
      model: provider(modelDescriptor.id, { reasoningEffort }),
      credentialProvider: 'openrouter',
    };
  }

  if (modelDescriptor.provider === 'openai') {
    const apiKey = await getDecryptedAiCredential(userId, 'openai');
    if (!apiKey) {
      throw new Error('No personal OpenAI API key is configured.');
    }

    const provider = createOpenAI({ apiKey });

    return {
      model: provider(modelDescriptor.id, { reasoningEffort }),
      credentialProvider: 'openai',
    };
  }

  const apiKey = await getDecryptedAiCredential(userId, 'anthropic');
  if (!apiKey) {
    throw new Error('No personal Anthropic API key is configured.');
  }

  const provider = createAnthropic({ apiKey });

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
