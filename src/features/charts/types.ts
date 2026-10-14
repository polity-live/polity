import type { TElement } from 'platejs';

export const DATA_VIEW_NODE_TYPE = 'data_view';
export const MAX_MANUAL_CHART_ROWS = 5_000;
export const MAX_MANUAL_CHART_COLUMNS = 50;
export const MAX_MANUAL_CSV_BYTES = 2_000_000;
export const MAX_CHART_POINTS = 5_000;
export const MAX_DATASET_SNAPSHOT_BYTES = 50 * 1024 * 1024;
export const MAX_EUROSTAT_DATASET_BYTES = MAX_DATASET_SNAPSHOT_BYTES;
export const EUROSTAT_PARTITION_CELL_LIMIT = 20_000;
export const EUROSTAT_DEFAULT_VALUE_FIELD = 'OBS_VALUE';
export const EUROSTAT_VALUE_FIELDS = [EUROSTAT_DEFAULT_VALUE_FIELD] as const;

export type ChartType = 'line' | 'bar' | 'area' | 'pie';
export type DataViewKind = 'chart' | 'table' | 'stat';
export type DataAggregation = 'none' | 'sum' | 'mean' | 'median' | 'min' | 'max' | 'count';
export type DataSortDirection = 'asc' | 'desc';
export type DatasetColumnType = 'number' | 'date' | 'category' | 'text';
export type DatasetColumnRole = 'measure' | 'time' | 'geo' | 'dimension' | 'label';
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
  tableMode?: ChartTableMode;
  valueColumns?: string[];
}

export type ChartTableMode = 'columnMapping' | 'rowsAsSeries' | 'columnsAsSeries';

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

export interface GovDataResourceSummary {
  id: string;
  name: string;
  format: string;
  mimetype?: string | null;
  size?: number | null;
  modified?: string | null;
  url: string;
}

export interface GovDataCatalogueEntry {
  id: string;
  name: string;
  title: string;
  notes?: string | null;
  publisher?: string | null;
  organizationTitle?: string | null;
  modified?: string | null;
  timeCoverage?: DatasetSearchResult['timeCoverage'];
  spatialCoverage?: DatasetSearchResult['spatialCoverage'];
  resources: GovDataResourceSummary[];
}

export interface GovDataProvenance {
  packageId: string;
  packageName: string;
  packageTitle: string;
  resourceId: string;
  resourceName: string;
  resourceUrl: string;
  publisher?: string | null;
  organizationTitle?: string | null;
  modified?: string | null;
  resourceModified?: string | null;
  licenseTitle?: string | null;
  importedAt: string;
}

export interface DatasetColumnProfile {
  technical?: boolean;
  name: string;
  label: string;
  type: DatasetColumnType;
  role: DatasetColumnRole;
  nullCount: number;
  distinctCount: number;
  min?: number | string | null;
  max?: number | string | null;
}

export interface DatasetMeasureOption {
  id: string;
  label: string;
  unit: string;
  filters: Record<string, string>;
}

export interface DatasetSelectionIdentity {
  provider: DatasetProviderId;
  providerDatasetId?: string | null;
  providerResourceId?: string | null;
  snapshotId?: string | null;
  datasetId?: string | null;
}

/** Download identity only: display and import filters deliberately have no place here. */
export interface DatasetRawDownloadRequest extends DatasetSelectionIdentity {
  language?: 'de' | 'en' | 'fr';
}
export interface DatasetRawDownloadPreparation {
  url: string;
  fileName: string;
  kind: 'provider' | 'snapshot';
  fullDataset: boolean;
}

export interface DatasetPreviewRequest extends DatasetSelectionIdentity {
  language?: string;
  filters?: DatasetImportFilters;
  rowFilters?: Record<string, string>;
  timeRange?: DataViewQuery['timeRange'];
  rowConditions?: DatasetRowCondition[];
  page?: { offset: number; limit: number };
  sort?: DataViewQuery['sort'];
}

export type DatasetRowCondition =
  | { column: string; operator: 'in'; values: string[] }
  | { column: string; operator: 'contains'; value: string }
  | { column: string; operator: 'range'; min?: string; max?: string; numeric?: boolean }
  | { column: string; operator: 'empty' };

export interface DatasetTableSelection {
  filters: DatasetImportFilters;
  rowFilters: Record<string, string>;
  rowConditions: DatasetRowCondition[];
  timeRange?: DataViewQuery['timeRange'];
  columns: string[];
  sort?: DataViewQuery['sort'];
}

export interface DatasetPreview {
  identity: DatasetSelectionIdentity;
  columns: DatasetColumnProfile[];
  rows: Record<string, string>[];
  appliedFilters: DatasetImportFilters;
  rowFilters: Record<string, string>;
  timeRange?: DataViewQuery['timeRange'];
  sampled: boolean;
  sampledRowCount: number;
  metadata?: Record<string, unknown>;
  page?: { offset: number; limit: number; total: number; nextOffset: number | null };
  facets?: Record<string, { values: string[]; complete: boolean }>;
}

export interface DataViewQuery {
  measureColumn?: string | null;
  dimensionColumn?: string | null;
  seriesColumn?: string | null;
  filters: Record<string, string>;
  rowConditions?: DatasetRowCondition[];
  timeRange?: { column: string; startYear: number; endYear: number } | null;
  aggregation: DataAggregation;
  layout?: 'long' | 'wide' | 'multi';
  valueColumns?: string[];
  columns?: string[];
  sort?: {
    column: string;
    direction: DataSortDirection;
  } | null;
  limit?: 5 | 10 | 25 | 50;
}

export interface DataViewProjectionRequest extends DataViewQuery {
  snapshotId: string;
  view: DataViewKind;
}

export interface ChartDataViewProjection {
  view: 'chart';
  snapshotId: string;
  points: ChartPoint[];
  rowCount: number;
}

export interface TableDataViewProjection {
  view: 'table';
  snapshotId: string;
  columns: string[];
  rows: Record<string, string>[];
  rowCount: number;
}

export interface StatDataViewProjection {
  view: 'stat';
  snapshotId: string;
  label: string;
  value: number;
  aggregation: DataAggregation;
  rowCount: number;
}

export type DataViewProjection =
  ChartDataViewProjection | TableDataViewProjection | StatDataViewProjection;

export interface GovDataImportResult {
  datasetId: string;
  snapshotId: string;
  snapshotKey: string;
  columns: string[];
  rows: Record<string, string>[];
  provenance: GovDataProvenance;
}

export type DatasetProviderId = 'EUROSTAT' | 'GENESIS_DESTATIS' | 'GOVDATA' | 'UPLOAD';

export interface DatasetChartSource {
  sourceUpdatedAt?: string | null;
  dataPeriod?: { start?: string | null; end?: string | null } | null;
  kind: 'dataset';
  provider: DatasetProviderId;
  datasetId: string;
  snapshotId: string;
  snapshotKey?: string;
  title: string;
  providerDatasetId?: string | null;
  providerResourceId?: string | null;
  publisher?: string | null;
  sourceUrl?: string | null;
  license?: string | null;
  snapshotTakenAt?: string | null;
  filters?: Record<string, string>;
  groupId?: string | null;
}

export interface TDataViewElement extends TElement {
  type: typeof DATA_VIEW_NODE_TYPE;
  view: DataViewKind;
  source: DatasetChartSource;
  query: DataViewQuery;
  chartType?: ChartType;
  presentation: ChartPresentation;
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
  coverageRegions?: { included: boolean; values: Record<string, string[]> }[];
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
  snapshotId?: string;
  filters: Record<string, string>;
  xDimension: string;
  seriesDimension?: string | null;
  valueField?: string;
}

export interface EurostatProjectionResult {
  projectionId?: string;
  snapshotId?: string;
  points: ChartPoint[];
}

export interface DatasetSearchResult {
  id: string;
  provider: DatasetProviderId;
  providerDatasetId?: string | null;
  providerResourceId?: string | null;
  title: string;
  description?: string | null;
  publisher?: string | null;
  license?: string | null;
  sourceUrl?: string | null;
  modified?: string | null;
  structureSummary?: string | null;
  valueSummary?: string | null;
  formatSummary?: string | null;
  snapshotId?: string | null;
  snapshotKey?: string | null;
  snapshotTakenAt?: string | null;
  rowCount?: number | null;
  columnCount?: number | null;
  columnProfiles?: DatasetColumnProfile[];
  byteSize?: number | null;
  groupId?: string | null;
  timeCoverage?: { start?: string | null; end?: string | null } | null;
  spatialCoverage?: string[] | Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  entry?: unknown;
  searchMatch?: DatasetSearchMatch;
}

export interface DatasetSearchFilters {
  period?: { start: number; end: number } | null;
  area?: string | null;
}

export interface DatasetSearchIntent {
  query: string;
  topic: string;
  period: { start: number; end: number } | null;
  area: string | null;
  isCode: boolean;
}

export interface DatasetSearchMatch {
  group: 'matching' | 'other';
  area: {
    status: 'match' | 'unknown' | 'different';
    label?: string;
    source: 'metadata' | 'text' | 'unknown';
  };
  period: {
    status: 'match' | 'unknown' | 'different';
    start?: number;
    end?: number;
    source: 'metadata' | 'text' | 'unknown';
  };
}

export interface DatasetProviderError {
  provider: DatasetProviderId;
  message: string;
  code?: 'authentication' | 'timeout' | 'unavailable' | 'invalid_response' | 'incomplete_metadata';
}

export interface DatasetImportFilters {
  area?: string | null;
  period?: { start: number; end: number } | null;
  dimensions?: Record<string, string>;
}

export interface DatasetPreparation {
  provider: 'EUROSTAT' | 'GENESIS_DESTATIS';
  code: string;
  title: string;
  dimensions: EurostatDimension[];
  geoDimension?: string | null;
  timeDimension?: string | null;
  estimatedBytes: number | null;
  importAllowed: boolean;
  suggestedFilters: DatasetImportFilters;
  spatialCoverage?: DatasetSearchResult['spatialCoverage'];
  timeCoverage?: DatasetSearchResult['timeCoverage'];
  coverageRegions?: EurostatDatasetDetails['coverageRegions'];
}

export interface DatasetProviderSearchResponse {
  results: DatasetSearchResult[];
  errors: DatasetProviderError[];
}

export interface DatasetSnapshotImportResult {
  providerDatasetId?: string | null;
  datasetId: string;
  snapshotId: string;
  snapshotKey: string;
  provider: DatasetProviderId;
  providerResourceId?: string | null;
  title: string;
  publisher?: string | null;
  sourceUrl?: string | null;
  columns: string[];
  columnProfiles?: DatasetColumnProfile[];
  rows: Record<string, string>[];
  rowCount: number;
  columnCount: number;
  byteSize: number;
  snapshotTakenAt: string;
  provenance?: Record<string, unknown>;
}
