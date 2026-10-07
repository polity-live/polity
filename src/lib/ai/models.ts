import type { AiCredentialSource, AiModelDescriptor, AiProvider } from '@/lib/ai/schemas';

export interface AiCatalogModelLike {
  provider: AiProvider;
  id: string;
  label: string;
  source: AiCredentialSource;
  free: boolean;
}

const FREE_ROUTER_MODEL_LABEL = 'free models router';
export const OPENROUTER_FREE_MODEL_ID = 'openrouter/free';

export function buildAiModelKey(model: AiModelDescriptor): string {
  return model.source
    ? `${model.provider}:${model.source}:${model.id}`
    : `${model.provider}:${model.id}`;
}

/** Legacy requests intentionally match either source; new requests always name one. */
export function matchesAiModel(model: AiCatalogModelLike, descriptor: AiModelDescriptor): boolean {
  return (
    model.provider === descriptor.provider &&
    model.id === descriptor.id &&
    (descriptor.source === undefined || model.source === descriptor.source)
  );
}

export function aiSourceTranslationKey(source: AiCredentialSource): string {
  return `features.messages.ai.sources.${source}`;
}

export function getPreferredDefaultAiModel<T extends AiCatalogModelLike>(
  models: readonly T[]
): T | null {
  const appFreeRouterModel = models.find(
    model =>
      model.provider === 'openrouter' &&
      model.id === OPENROUTER_FREE_MODEL_ID &&
      model.source === 'app' &&
      model.free
  );

  if (appFreeRouterModel) {
    return appFreeRouterModel;
  }

  const labeledFreeRouterModel = models.find(
    model =>
      model.provider === 'openrouter' &&
      model.source === 'app' &&
      model.free &&
      model.label.trim().toLowerCase() === FREE_ROUTER_MODEL_LABEL
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

export function toAiModelDescriptor<T extends AiModelDescriptor>(model: T): AiModelDescriptor {
  return {
    provider: model.provider,
    id: model.id,
    ...(model.source ? { source: model.source } : {}),
  };
}
