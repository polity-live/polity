import {
  EUROSTAT_DEFAULT_VALUE_FIELD,
  EUROSTAT_VALUE_FIELDS,
  type EurostatProjectionRequest,
} from '@/features/charts/types';

export function normalizeEurostatValueField(valueField?: string | null) {
  const normalized = valueField?.trim() || EUROSTAT_DEFAULT_VALUE_FIELD;
  if (!EUROSTAT_VALUE_FIELDS.some(field => field === normalized)) {
    throw new Error('Unsupported Eurostat value field');
  }
  return normalized;
}

export function validateProjectionDimensions(
  dimensionIds: readonly string[],
  request: EurostatProjectionRequest
) {
  const known = new Set(dimensionIds);
  if (!known.has(request.xDimension)) {
    throw new Error('Unknown X dimension');
  }
  if (request.seriesDimension && !known.has(request.seriesDimension)) {
    throw new Error('Unknown series dimension');
  }
  if (request.seriesDimension === request.xDimension) {
    throw new Error('X and series dimensions must differ');
  }

  for (const dimensionId of dimensionIds) {
    if (dimensionId === request.xDimension || dimensionId === request.seriesDimension) {
      continue;
    }
    if (!request.filters[dimensionId]) {
      throw new Error(`Dimension ${dimensionId} must be filtered to one value`);
    }
  }
}
