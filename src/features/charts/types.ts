import type { TElement } from 'platejs';

export const CHART_NODE_TYPE = 'chart';
export const MAX_MANUAL_CHART_ROWS = 5_000;
export const MAX_MANUAL_CHART_COLUMNS = 50;
export const MAX_MANUAL_CSV_BYTES = 2_000_000;
export const MAX_CHART_POINTS = 5_000;
export const MAX_EUROSTAT_DATASET_BYTES = 100_000_000;
export const EUROSTAT_PARTITION_CELL_LIMIT = 20_000;
export const EUROSTAT_DEFAULT_VALUE_FIELD = 'OBS_VALUE';
export const EUROSTAT_VALUE_FIELDS = [EUROSTAT_DEFAULT_VALUE_FIELD] as const;

export type ChartType = 'line' | 'bar' | 'area' | 'pie';
export type EurostatValueField = (typeof EUROSTAT_VALUE_FIELDS)[number];

export interface ChartPoint {
  x: string;
  value: number;
  series?: string | null;
}

export interface ChartMapping {
  xColumn: string;
  valueColumn: string;
  seriesColumn?: string | null;
}

export interface ChartPresentation {
  title?: string;
  description?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  donut?: boolean;
}

export interface ManualChartSource {
  kind: 'manual';
  columns: string[];
  rows: Record<string, string>[];
}

export interface EurostatChartSource {
  kind: 'eurostat';
  datasetId: string;
  datasetCode: string;
  snapshotKey: string;
  projectionId: string;
  filters: Record<string, string>;
}

export type ChartSource = ManualChartSource | EurostatChartSource;

export interface TChartElement extends TElement {
  type: typeof CHART_NODE_TYPE;
  chartType: ChartType;
  mapping: ChartMapping;
  presentation: ChartPresentation;
  source: ChartSource;
  points: ChartPoint[];
  children: [{ text: '' }];
}

export interface EurostatCatalogueEntry {
  code: string;
  title: string;
  type: string;
  lastUpdate: string | null;
  structureLastChange: string | null;
  dataStart: string | null;
  dataEnd: string | null;
  valueCount: number;
}

export interface EurostatDimensionValue {
  id: string;
  label?: string;
}

export interface EurostatDimension {
  id: string;
  label: string;
  position: number;
  codelistId?: string | null;
  codelistVersion?: string | null;
  values: EurostatDimensionValue[];
}

export interface EurostatDatasetDetails extends EurostatCatalogueEntry {
  language: string;
  snapshotKey: string;
  dimensions: EurostatDimension[];
  attributes: string[];
  sampleRowBytes: number;
  estimatedBytes: number;
  importAllowed: boolean;
}

export interface EurostatImportProgress {
  datasetId: string;
  status: 'pending' | 'importing' | 'ready' | 'blocked' | 'error';
  partitionCount: number;
  completedPartitions: number;
  observationCount: number;
  estimatedBytes: number;
  actualBytes: number;
  error?: string | null;
}

export interface EurostatProjectionRequest {
  datasetId: string;
  filters: Record<string, string>;
  xDimension: string;
  seriesDimension?: string | null;
  valueField?: string;
}

export interface EurostatProjectionResult {
  projectionId: string;
  points: ChartPoint[];
}
