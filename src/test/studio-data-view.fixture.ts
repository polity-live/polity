import type { ChartDataViewProjection, TDataViewElement } from '@/features/charts/types';
export function configuration(kind: 'bar' | 'line' | 'area' | 'pie' = 'bar'): TDataViewElement {
  return {
    type: 'data_view',
    view: 'chart',
    chartType: kind,
    source: {
      kind: 'dataset',
      provider: 'EUROSTAT',
      datasetId: 'dataset',
      snapshotId: 'snapshot',
      title: 'Population',
      publisher: 'Eurostat',
      sourceUrl: 'https://example.org/data',
      snapshotTakenAt: '2026-10-11T00:00:00Z',
    },
    query: { filters: {}, aggregation: 'sum' },
    presentation: {
      title: 'Population by year',
      description: 'Selected regions',
      showLegend: true,
      showGrid: true,
      xAxisLabel: 'Year',
      yAxisLabel: 'People',
      donut: true,
    },
    children: [{ text: '' }],
  };
}
export const projection: ChartDataViewProjection = {
  view: 'chart',
  snapshotId: 'snapshot',
  rowCount: 3,
  points: [
    { x: '2024', series: 'North', value: 10 },
    { x: '2025', series: 'South', value: 20 },
    { x: '2026', series: 'North', value: 30 },
  ],
};
