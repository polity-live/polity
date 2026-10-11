import { z } from 'zod';
import type { DatasetImportFilters, DatasetPreparation } from '@/features/charts/types';
import { createStableHash } from '@/server/eurostat/hash';
import { DatasetProviderFailure } from './providerError';
import { normalizeDatasetArea } from '@/features/charts/logic/datasetSearch';

export const importFiltersSchema = z.object({
  area: z.string().trim().min(1).max(200).nullable().optional(),
  period: z
    .object({
      start: z.number().int().min(1800).max(2199),
      end: z.number().int().min(1800).max(2199),
    })
    .refine(value => value.start <= value.end)
    .nullable()
    .optional(),
  dimensions: z.record(z.string().min(1).max(100), z.string().min(1).max(200)).optional(),
});

export function datasetYear(value: string): number | null {
  const match = value.match(/(?:^|[^\d])((?:18|19|20|21)\d{2})(?:[^\d]|$)/);
  return match ? Number(match[1]) : null;
}

export function resolveImportFilters(
  preparation: DatasetPreparation,
  filters: DatasetImportFilters = {}
) {
  const resolved: Record<string, string[]> = {};
  for (const [id, value] of Object.entries(filters.dimensions ?? {})) {
    const dimension = preparation.dimensions.find(item => item.id === id);
    if (!dimension?.values.some(item => item.id === value))
      throw new DatasetProviderFailure(`Unknown dimension value: ${id}`, 'invalid_scope', 422);
    resolved[id] = [value];
  }
  if (filters.area) {
    const geo = preparation.dimensions.find(item => item.id === preparation.geoDimension);
    const requested = normalizeDatasetArea(filters.area);
    const values = geo?.values.filter(
      value =>
        normalizeDatasetArea(value.id) === requested ||
        normalizeDatasetArea(value.label ?? '') === requested
    );
    if (!geo || values?.length !== 1)
      throw new DatasetProviderFailure(
        'The selected area is unavailable or ambiguous',
        'invalid_scope',
        422
      );
    if (resolved[geo.id] && resolved[geo.id][0] !== values[0].id)
      throw new DatasetProviderFailure('Conflicting area filters', 'invalid_scope', 422);
    resolved[geo.id] = [values[0].id];
  }
  if (filters.period) {
    const period = filters.period;
    const time = preparation.dimensions.find(item => item.id === preparation.timeDimension);
    const values = time?.values.filter(value => {
      const year = datasetYear(value.id);
      return year !== null && year >= period.start && year <= period.end;
    });
    const years = new Set(values?.map(value => datasetYear(value.id)));
    for (let year = filters.period.start; year <= filters.period.end; year++) {
      if (!years.has(year))
        throw new DatasetProviderFailure(
          'The selected period is not fully available',
          'invalid_scope',
          422
        );
    }
    if (!time || !values?.length)
      throw new DatasetProviderFailure('The selected period is unavailable', 'invalid_scope', 422);
    if (resolved[time.id] && !values.some(value => value.id === resolved[time.id][0]))
      throw new DatasetProviderFailure('Conflicting time filters', 'invalid_scope', 422);
    resolved[time.id] ??= values.map(value => value.id);
  }
  if (preparation.coverageRegions?.length) {
    const timeId = preparation.timeDimension ?? 'TIME_PERIOD';
    for (const time of resolved[timeId] ?? ['']) {
      const selected = { ...resolved, ...(time ? { [timeId]: [time] } : {}) };
      const compatible = preparation.coverageRegions.some(
        region =>
          region.included &&
          Object.entries(selected).every(
            ([id, values]) =>
              !region.values[id] || values.every(value => region.values[id].includes(value))
          )
      );
      const excluded = preparation.coverageRegions.some(
        region =>
          !region.included &&
          Object.entries(region.values).every(([id, values]) =>
            selected[id]?.some(value => values.includes(value))
          )
      );
      if (!compatible || excluded)
        throw new DatasetProviderFailure(
          'The selected combination is not available',
          'invalid_scope',
          422
        );
    }
  }
  return resolved;
}

export function importScopeResourceId(resolved: Record<string, readonly string[]>) {
  const entries = Object.entries(resolved)
    .filter(([, values]) => values.length)
    .sort(([a], [b]) => a.localeCompare(b));
  return entries.length
    ? `scope:${createStableHash(Object.fromEntries(entries.map(([id, values]) => [id, [...values].sort()])))}`
    : undefined;
}
