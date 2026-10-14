import type {
  DataViewQuery,
  DatasetSearchIntent,
  DatasetSnapshotImportResult,
  EurostatDimension,
} from '../types';
import { normalizeDatasetArea } from './datasetSearch';

export function snapshotDimensions(snapshot: DatasetSnapshotImportResult): EurostatDimension[] {
  const values = snapshot.provenance?.providerDimensions;
  return Array.isArray(values) ? (values as EurostatDimension[]) : [];
}

const areaMatches = (value: string, requested: string) =>
  normalizeDatasetArea(value) === normalizeDatasetArea(requested);

export function applyDatasetSearchIntent(
  query: DataViewQuery,
  snapshot: DatasetSnapshotImportResult,
  intent?: DatasetSearchIntent | null
): DataViewQuery {
  if (!intent) return query;
  const profiles = snapshot.columnProfiles ?? [];
  const geo = profiles.find(profile => profile.role === 'geo');
  const time = profiles.find(profile => profile.role === 'time');
  const filters = { ...query.filters };
  if (intent.area && geo) {
    const requestedArea = intent.area;
    const dimension = snapshotDimensions(snapshot).find(item => item.id === geo.name);
    const value = dimension?.values.find(
      item => areaMatches(item.id, requestedArea) || areaMatches(item.label ?? '', requestedArea)
    );
    const rawValue = snapshot.rows.find(row => areaMatches(row[geo.name] ?? '', requestedArea))?.[
      geo.name
    ];
    // An unavailable area must produce an explicit empty selection, never unfiltered data.
    filters[geo.name] = value?.id ?? rawValue ?? intent.area;
  }
  return {
    ...query,
    filters,
    ...(intent.period && time
      ? {
          timeRange: {
            column: time.name,
            startYear: intent.period.start,
            endYear: intent.period.end,
          },
        }
      : {}),
  };
}

export function requiredProviderDimensions(
  snapshot: DatasetSnapshotImportResult,
  query: DataViewQuery
) {
  return snapshotDimensions(snapshot).filter(dimension => {
    const profile = snapshot.columnProfiles?.find(item => item.name === dimension.id);
    if (
      !profile ||
      profile.role === 'time' ||
      profile.role === 'measure' ||
      profile.distinctCount <= 1
    )
      return false;
    const fixed = /^(unit|freq|value_unit|value_variable_code)$/i.test(dimension.id);
    if (!fixed && [query.dimensionColumn, query.seriesColumn].includes(dimension.id)) return false;
    return !query.filters[dimension.id];
  });
}
