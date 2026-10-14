import { z } from 'zod';
import { datasetRowConditionsSchema } from './datasetRowConditions';

const text = z.string().max(10_000);
const optionalText = text.nullable().optional();
export const dataViewConfigurationSchema = z.object({
  type: z.literal('data_view'),
  view: z.enum(['chart', 'table', 'stat']),
  chartType: z.enum(['line', 'bar', 'area', 'pie']).optional(),
  source: z.object({
    kind: z.literal('dataset'),
    provider: z.enum(['EUROSTAT', 'GENESIS_DESTATIS', 'GOVDATA', 'UPLOAD']),
    datasetId: z.string().min(1).max(200),
    snapshotId: z.string().min(1).max(200),
    snapshotKey: text.optional(),
    title: text,
    providerDatasetId: optionalText,
    providerResourceId: optionalText,
    publisher: optionalText,
    sourceUrl: optionalText,
    license: optionalText,
    snapshotTakenAt: optionalText,
    sourceUpdatedAt: optionalText,
    dataPeriod: z.object({ start: optionalText, end: optionalText }).nullable().optional(),
    groupId: optionalText,
    filters: z.record(z.string().max(200), z.string().max(300)).optional(),
  }),
  query: z.object({
    measureColumn: optionalText,
    dimensionColumn: optionalText,
    seriesColumn: optionalText,
    filters: z.record(z.string().max(200), z.string().max(300)),
    rowConditions: datasetRowConditionsSchema.optional(),
    timeRange: z
      .object({
        column: text,
        startYear: z.number().int().min(1800).max(2199),
        endYear: z.number().int().min(1800).max(2199),
      })
      .refine(value => value.startYear <= value.endYear)
      .nullable()
      .optional(),
    aggregation: z.enum(['none', 'sum', 'mean', 'median', 'min', 'max', 'count']),
    layout: z.enum(['long', 'wide', 'multi']).optional(),
    valueColumns: z.array(text).max(50).optional(),
    columns: z.array(text).max(50).optional(),
    sort: z
      .object({ column: text, direction: z.enum(['asc', 'desc']) })
      .nullable()
      .optional(),
    limit: z.union([z.literal(5), z.literal(10), z.literal(25), z.literal(50)]).optional(),
  }),
  presentation: z.object({
    title: text.optional(),
    description: text.optional(),
    xAxisLabel: text.optional(),
    yAxisLabel: text.optional(),
    showLegend: z.boolean().optional(),
    showGrid: z.boolean().optional(),
    showTooltip: z.boolean().optional(),
    donut: z.boolean().optional(),
  }),
  children: z.tuple([z.object({ text: z.literal('') })]),
});
