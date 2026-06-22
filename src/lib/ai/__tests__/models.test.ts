import { describe, expect, it } from 'vitest';

import { getPreferredDefaultAiModel, OPENROUTER_FREE_MODEL_ID } from '../models';

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
});
