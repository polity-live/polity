import { z } from 'zod';

export const datasetProjectionRequestSchema = z.object({
  view: z.enum(['chart', 'table', 'stat']),
  measureColumn: z.string().nullable().optional(),
  dimensionColumn: z.string().nullable().optional(),
  seriesColumn: z.string().nullable().optional(),
  filters: z.record(z.string(), z.string()).default({}),
  aggregation: z.enum(['sum', 'mean', 'median', 'min', 'max', 'count']).default('sum'),
  layout: z.enum(['long', 'wide', 'multi']).optional(),
  valueColumns: z.array(z.string()).max(50).optional(),
  columns: z.array(z.string()).max(50).optional(),
  sort: z
    .object({
      column: z.string(),
      direction: z.enum(['asc', 'desc']),
    })
    .nullable()
    .optional(),
  limit: z.union([z.literal(5), z.literal(10), z.literal(25), z.literal(50)]).optional(),
});
