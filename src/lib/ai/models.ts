import type { AiModelDescriptor, AiProvider } from '@/lib/ai/schemas';

export interface AiCatalogModelLike {
  provider: AiProvider;
  id: string;
  label: string;
  source: 'app' | 'byok';
  free: boolean;
}

const FREE_ROUTER_MODEL_LABEL = 'free models router';

export function buildAiModelKey(model: Pick<AiCatalogModelLike, 'provider' | 'id'>): string {
  return `${model.provider}:${model.id}`;
}

export function getPreferredDefaultAiModel<T extends AiCatalogModelLike>(
  models: readonly T[]
): T | null {
  const labeledFreeRouterModel = models.find(
    model => model.label.trim().toLowerCase() === FREE_ROUTER_MODEL_LABEL
  );

  if (labeledFreeRouterModel) {
    return labeledFreeRouterModel;
  }

  const fallbackFreeRouterModel = models.find(
    model => model.provider === 'openrouter' && model.source === 'app' && model.free
  );

  if (fallbackFreeRouterModel) {
    return fallbackFreeRouterModel;
  }

  return models[0] ?? null;
}

export function getPreferredDefaultAiModelKey(
  models: readonly AiCatalogModelLike[]
): string | null {
  const model = getPreferredDefaultAiModel(models);

  return model ? buildAiModelKey(model) : null;
}

export function toAiModelDescriptor<T extends Pick<AiCatalogModelLike, 'provider' | 'id'>>(
  model: T
): AiModelDescriptor {
  return {
    provider: model.provider,
    id: model.id,
  };
}
