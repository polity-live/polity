import type { DatasetColumnProfile } from '../types';

export function orderDatasetPreviewColumns(columns: readonly DatasetColumnProfile[]) {
  const priority = { time: 0, geo: 1, label: 2, dimension: 3, measure: 4 };
  return [...columns].sort(
    (a, b) =>
      Number(Boolean(a.technical)) - Number(Boolean(b.technical)) ||
      priority[a.role] - priority[b.role]
  );
}
