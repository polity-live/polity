import type {
  DatasetSelectionIdentity,
  DatasetSnapshotImportResult,
  DatasetMeasureOption,
  DataViewQuery,
} from '../types';

export function sameDatasetSelection(
  expected: DatasetSelectionIdentity,
  actual: DatasetSelectionIdentity
) {
  return (
    expected.provider === actual.provider &&
    (!expected.providerDatasetId ||
      expected.providerDatasetId.toUpperCase() === actual.providerDatasetId?.toUpperCase()) &&
    (!expected.providerResourceId || expected.providerResourceId === actual.providerResourceId) &&
    (!expected.snapshotId || expected.snapshotId === actual.snapshotId) &&
    (!expected.datasetId || expected.datasetId === actual.datasetId)
  );
}

export function datasetMeasureOptions(
  snapshot: DatasetSnapshotImportResult | null
): DatasetMeasureOption[] {
  const options = snapshot?.provenance?.measureOptions;
  return Array.isArray(options) ? (options as DatasetMeasureOption[]) : [];
}

export function selectedDatasetMeasure(options: DatasetMeasureOption[], query: DataViewQuery) {
  const conditions = query.rowConditions ?? [];
  const relevant = conditions.filter(condition =>
    ['value_variable_code', 'value_variable_label', 'value_unit'].includes(condition.column)
  );
  const constrained =
    relevant.length > 0 ||
    Object.entries(query.filters).some(
      ([column, value]) =>
        Boolean(value) &&
        (column === 'value_variable_label' || options.some(option => column in option.filters))
    );
  if (!constrained) return options.length === 1 ? options[0] : undefined;
  const candidates = options.filter(option => {
    const values: Record<string, string> = {
      ...option.filters,
      value_variable_label: option.label,
    };
    return (
      Object.entries(query.filters).every(
        ([column, value]) => !value || !(column in values) || values[column] === value
      ) &&
      relevant.every(condition => {
        const raw = values[condition.column] ?? '';
        if (condition.operator === 'in') return condition.values.includes(raw);
        if (condition.operator === 'contains')
          return raw.toLocaleLowerCase().includes(condition.value.toLocaleLowerCase());
        if (condition.operator === 'empty') return !raw.trim();
        return (!condition.min || raw >= condition.min) && (!condition.max || raw <= condition.max);
      })
    );
  });
  return candidates.length === 1 ? candidates[0] : undefined;
}
