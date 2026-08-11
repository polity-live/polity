import { describe, expect, it } from 'vitest';

import {
  buildAiModelKey,
  getPreferredDefaultAiModel,
  getPreferredDefaultAiModelKey,
  OPENROUTER_FREE_MODEL_ID,
  toAiModelDescriptor,
} from '../models';

describe('AI model selection', () => {
  it('prefers the app OpenRouter free router over alphabetically earlier free models', () => {
    const cohereFreeModel = {
      provider: 'openrouter' as const,
      id: 'cohere/north-mini-code:free',
      label: 'Cohere: North Mini Code (free)',
      source: 'app' as const,
      free: true,
    };
    const openRouterFreeModel = {
      provider: 'openrouter' as const,
      id: OPENROUTER_FREE_MODEL_ID,
      label: 'Free Models Router',
      source: 'app' as const,
      free: true,
    };

    expect(getPreferredDefaultAiModel([cohereFreeModel, openRouterFreeModel])).toBe(
      openRouterFreeModel
    );
  });

  it('falls back to another app free OpenRouter model before BYOK models', () => {
    const byokModel = {
      provider: 'openai' as const,
      id: 'gpt-4.1-mini',
      label: 'OpenAI GPT-4.1 Mini',
      source: 'byok' as const,
      free: false,
    };
    const appFreeModel = {
      provider: 'openrouter' as const,
      id: 'google/gemma-4-26b-a4b-it:free',
      label: 'Google: Gemma 4 26B A4B (free)',
      source: 'app' as const,
      free: true,
    };

    expect(getPreferredDefaultAiModel([byokModel, appFreeModel])).toBe(appFreeModel);
  });

  it('recognizes a labeled router before generic free models', () => {
    const generic = {
      provider: 'openrouter' as const,
      id: 'generic',
      label: 'Generic',
      source: 'app' as const,
      free: true,
    };
    const labeled = { ...generic, id: 'labeled', label: ' FREE MODELS ROUTER ' };
    expect(getPreferredDefaultAiModel([generic, labeled])).toBe(labeled);
  });

  it('falls back to the first model or null and builds public descriptors', () => {
    const model = {
      provider: 'openai' as const,
      id: 'gpt',
      label: 'GPT',
      source: 'byok' as const,
      free: false,
    };
    expect(getPreferredDefaultAiModel([model])).toBe(model);
    expect(getPreferredDefaultAiModel([])).toBeNull();
    expect(getPreferredDefaultAiModelKey([model])).toBe('openai:gpt');
    expect(getPreferredDefaultAiModelKey([])).toBeNull();
    expect(buildAiModelKey(model)).toBe('openai:gpt');
    expect(toAiModelDescriptor(model)).toEqual({ provider: 'openai', id: 'gpt' });
  });
});
