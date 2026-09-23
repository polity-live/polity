import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { z } from 'zod';
import { canvasSceneSchema } from './canvas-schema';
import { createTableData } from './table-operations';
import { themePaletteRoleSchema } from '@/features/shared/appearance-theme/contract';

export const formats = {
  feed: [1080, 1350],
  square: [1080, 1080],
  story: [1080, 1920],
  widescreen: [1920, 1080],
  standard: [1440, 1080],
} as const;
export const channels = ['instagram', 'linkedin', 'facebook'] as const;
export const fontFamilies = [
  'Newsreader',
  'Manrope',
  'Inter',
  'Open Sans',
  'IBM Plex Serif',
  'Public Sans',
  'PT Sans',
  'Work Sans',
  'Ubuntu',
  'JetBrains Mono',
] as const;
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const finite = z.number().finite();
export const textRunSchema = z.object({
  text: z.string().max(10000),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strikethrough: z.boolean().optional(),
  color: color.optional(),
  fontSize: finite.min(8).max(300).optional(),
  fontFamily: z.enum(fontFamilies).optional(),
  textStyleId: z.string().uuid().optional(),
  colorBinding: themePaletteRoleSchema.optional(),
  url: z
    .string()
    .url()
    .refine(v => /^https?:/.test(v))
    .optional(),
});
export const paragraphSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('p').default('p'),
  align: z.enum(['left', 'center', 'right', 'justify']).optional(),
  list: z.enum(['bullet', 'number']).optional(),
  children: z.array(textRunSchema).min(1).max(1000),
});
export const tableCellSchema = z.object({
  id: z.string().uuid(),
  text: z.string().max(10000),
  fill: color.default('#FFFFFF'),
  color: color.default('#12362D'),
  align: z.enum(['left', 'center', 'right']).default('left'),
  bold: z.boolean().default(false),
  borders: z
    .object({
      top: z.boolean().default(true),
      right: z.boolean().default(true),
      bottom: z.boolean().default(true),
      left: z.boolean().default(true),
    })
    .default({ top: true, right: true, bottom: true, left: true }),
});
export const tableDataSchema = z
  .object({
    rows: z
      .array(z.object({ id: z.string().uuid(), cells: z.array(tableCellSchema).min(1).max(20) }))
      .min(1)
      .max(50),
    widths: z.array(finite.min(0.01).max(1)).min(1).max(20),
    border: color.default('#888888'),
  })
  .refine(
    v => v.rows.every(r => r.cells.length === v.widths.length),
    'Table dimensions do not match'
  );
export const chartDataSchema = z
  .object({
    kind: z.enum(['bar', 'line', 'pie']),
    labels: z.array(z.string().max(100)).min(1).max(100),
    series: z
      .array(
        z.object({
          id: z.string().uuid(),
          name: z.string().max(100),
          color,
          values: z.array(finite).min(1).max(100),
        })
      )
      .min(1)
      .max(10),
    legend: z.boolean().default(true),
    colors: z.array(color).min(1).max(100).optional(),
  })
  .refine(
    v => v.series.every(s => s.values.length === v.labels.length),
    'Chart dimensions do not match'
  )
  .refine(
    v =>
      v.kind !== 'pie' ||
      (v.series.length === 1 &&
        v.series[0].values.every(n => n >= 0) &&
        v.series[0].values.some(n => n > 0)),
    'Pie chart needs one nonnegative series'
  );
export const mediaCropSchema = z
  .object({
    x: finite.min(0).max(100_000),
    y: finite.min(0).max(100_000),
    width: finite.positive().max(100_000),
    height: finite.positive().max(100_000),
    naturalWidth: finite.positive().max(100_000),
    naturalHeight: finite.positive().max(100_000),
  })
  .refine(crop => crop.x + crop.width <= crop.naturalWidth + 0.01, 'Crop exceeds image width')
  .refine(crop => crop.y + crop.height <= crop.naturalHeight + 0.01, 'Crop exceeds image height');
export const elementSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['text', 'image', 'rect', 'ellipse', 'video', 'line', 'arrow', 'table', 'chart']),
  x: finite.min(-4000).max(4000),
  y: finite.min(-4000).max(4000),
  width: finite.min(4).max(5000),
  height: finite.min(4).max(5000),
  rotation: finite.min(-360).max(360).default(0),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
  opacity: finite.min(0).max(1).default(1),
  order: finite.default(0),
  group: z.string().nullable().default(null),
  locked: z.boolean().default(false),
  visible: z.boolean().default(true),
  text: z.string().max(10000).default(''),
  font: z.enum(fontFamilies).default('Manrope'),
  fontSize: finite.min(8).max(300).default(42),
  bold: z.boolean().default(false),
  align: z.enum(['left', 'center', 'right', 'justify']).default('left'),
  italic: z.boolean().default(false),
  underline: z.boolean().default(false),
  strikethrough: z.boolean().default(false),
  verticalAlign: z.enum(['top', 'middle', 'bottom']).default('top'),
  lineHeight: finite.min(0.5).max(4).default(1.2),
  stroke: color.default('#12362D'),
  strokeWidth: finite.min(0).max(40).default(0),
  richText: z.array(paragraphSchema).max(1000).default([]),
  table: tableDataSchema.optional(),
  chart: chartDataSchema.optional(),
  fill: color.default('#12362D'),
  assetId: z.string().uuid().nullable().default(null),
  fit: z.enum(['contain', 'cover']).default('contain'),
  cropX: finite.min(0).max(1).default(0.5),
  cropY: finite.min(0).max(1).default(0.5),
  crop: mediaCropSchema.nullable().default(null),
  trimStart: finite.min(0).max(3600).default(0),
  muted: z.boolean().default(true),
  animation: z.enum(['none', 'fade']).default('none'),
});
export const pageSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(160),
  format: z.enum(['feed', 'square', 'story', 'widescreen', 'standard']),
  background: color,
  order: finite,
  duration: finite.min(1).max(60).default(5),
  transition: z.enum(['none', 'fade']).default('none'),
  elements: z.array(elementSchema).max(100),
  canvas: canvasSceneSchema.optional(),
});
export const brandSchema = z.object({
  background: color,
  foreground: color,
  accent: color,
  font: z.enum(fontFamilies),
  bodyFont: z.enum(fontFamilies),
  logoAssetId: z.string().uuid().nullable().default(null),
  themeId: z.string().nullable().default(null),
  revisionId: z.string().nullable().default(null),
});
export const postSchema = z.object({
  id: z.string().uuid(),
  code: z.string().max(100),
  title: z.string().max(200),
  kind: z.enum(['single', 'carousel', 'story', 'video']),
  pageIds: z.array(z.string().uuid()).max(30),
  day: z.number().int().min(0).max(365),
  action: z.string().max(300),
  status: z.enum(['draft', 'ready', 'published']).default('draft'),
  assignee: z.string().max(150).default(''),
  captions: z.object({
    instagram: z.string().max(20000),
    linkedin: z.string().max(20000),
    facebook: z.string().max(20000),
  }),
});
export const documentSchema = z
  .object({
    version: z.literal(2),
    title: z.string().max(200),
    kind: z.enum(['single', 'event', 'carousel', 'story', 'video', 'campaign', 'whiteboard']),
    brand: brandSchema,
    pages: z.array(pageSchema).max(300),
    posts: z.array(postSchema).max(100),
    startDate: z.iso.date().or(z.literal('')),
    source: z
      .object({
        type: z.enum(['event', 'amendment', 'statement']),
        id: z.string().uuid(),
        title: z.string(),
        text: z.string(),
        updatedAt: z.number(),
      })
      .nullable()
      .default(null),
  })
  .superRefine((d, ctx) => {
    const ids = new Set(d.pages.map(p => p.id));
    if (new Set(d.posts.map(p => p.id)).size !== d.posts.length)
      ctx.addIssue({ code: 'custom', message: translateText('features.studio.duplicatePosts') });
    if (ids.size !== d.pages.length)
      ctx.addIssue({ code: 'custom', message: translateText('features.studio.duplicatePages') });
    const elementIds = d.pages.flatMap(p => p.elements.map(e => e.id));
    if (new Set(elementIds).size !== elementIds.length)
      ctx.addIssue({ code: 'custom', message: translateText('features.studio.duplicateElements') });
    for (const e of d.pages.flatMap(p => p.elements)) {
      const sets = [
        e.richText.map(p => p.id),
        e.table?.rows.map(r => r.id) ?? [],
        e.table?.rows.flatMap(r => r.cells.map(c => c.id)) ?? [],
        e.chart?.series.map(s => s.id) ?? [],
      ];
      if (sets.some(ids => new Set(ids).size !== ids.length))
        ctx.addIssue({ code: 'custom', message: 'Duplicate nested Studio IDs' });
      if ((e.type === 'table' && !e.table) || (e.type === 'chart' && !e.chart))
        ctx.addIssue({ code: 'custom', message: 'Element data missing' });
    }
    for (const post of d.posts) {
      if (post.pageIds.some(id => !ids.has(id)))
        ctx.addIssue({ code: 'custom', message: translateText('features.studio.unknownPage') });
      if (
        post.kind === 'video' &&
        post.pageIds.reduce((sum, id) => sum + (d.pages.find(p => p.id === id)?.duration ?? 0), 0) >
          60
      )
        ctx.addIssue({
          code: 'custom',
          message: translateText('features.studio.videoDurationExceeded'),
        });
    }
  });
export type StudioElement = z.infer<typeof elementSchema>;
export type StudioMediaCrop = z.infer<typeof mediaCropSchema>;
export type StudioPage = z.infer<typeof pageSchema>;
export type StudioDocument = z.infer<typeof documentSchema>;
export type StudioBrand = z.infer<typeof brandSchema>;
export type StudioPost = z.infer<typeof postSchema>;
export const defaultBrand: StudioBrand = {
  background: '#F7F5EF',
  foreground: '#12362D',
  accent: '#B88A3B',
  font: 'Newsreader',
  bodyFont: 'Manrope',
  logoAssetId: null,
  themeId: null,
  revisionId: null,
};
export function element(
  type: StudioElement['type'],
  values: Partial<StudioElement> = {}
): StudioElement {
  if (type === 'table' && !values.table)
    values = {
      ...values,
      table: createTableData({ rowCount: 3, colCount: 2 }),
    };
  if (type === 'chart' && !values.chart)
    values = {
      ...values,
      chart: {
        kind: 'bar',
        labels: ['A', 'B', 'C'],
        legend: true,
        series: [
          { id: crypto.randomUUID(), name: 'Series', color: '#B88A3B', values: [30, 60, 45] },
        ],
      },
    };
  return elementSchema.parse({
    id: crypto.randomUUID(),
    type,
    x: 85,
    y: 160,
    width: 900,
    height: 220,
    ...values,
  });
}
export function dateForDay(start: string, day: number) {
  if (!start) return '';
  const date = new Date(start + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + day);
  return date.toISOString().slice(0, 10);
}
export function sorted<T extends { order: number; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
export function validateExport(doc: StudioDocument) {
  documentSchema.parse(doc);
  const issues: string[] = [];
  for (const p of doc.pages) {
    const [w, h] = formats[p.format];
    for (const e of p.elements) {
      if ((e.type === 'image' || e.type === 'video') && !e.assetId)
        issues.push(`${p.name}: missing media`);
      if (e.x + e.width < 0 || e.y + e.height < 0 || e.x > w || e.y > h)
        issues.push(`${p.name}: element outside page`);
    }
  }
  return issues;
}
