import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { z } from 'zod';

export const formats = { feed: [1080, 1350], square: [1080, 1080], story: [1080, 1920] } as const;
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
export const elementSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['text', 'image', 'rect', 'ellipse', 'video']),
  x: finite.min(-4000).max(4000),
  y: finite.min(-4000).max(4000),
  width: finite.min(4).max(5000),
  height: finite.min(4).max(5000),
  rotation: finite.min(-360).max(360).default(0),
  opacity: finite.min(0).max(1).default(1),
  order: finite.default(0),
  group: z.string().nullable().default(null),
  locked: z.boolean().default(false),
  text: z.string().max(10000).default(''),
  font: z.enum(fontFamilies).default('Manrope'),
  fontSize: finite.min(8).max(300).default(42),
  bold: z.boolean().default(false),
  align: z.enum(['left', 'center', 'right']).default('left'),
  fill: color.default('#12362D'),
  assetId: z.string().uuid().nullable().default(null),
  fit: z.enum(['contain', 'cover']).default('contain'),
  cropX: finite.min(0).max(1).default(0.5),
  cropY: finite.min(0).max(1).default(0.5),
  trimStart: finite.min(0).max(3600).default(0),
  muted: z.boolean().default(true),
  animation: z.enum(['none', 'fade']).default('none'),
});
export const pageSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(160),
  format: z.enum(['feed', 'square', 'story']),
  background: color,
  order: finite,
  duration: finite.min(1).max(60).default(5),
  transition: z.enum(['none', 'fade']).default('none'),
  elements: z.array(elementSchema).max(100),
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
    version: z.literal(1),
    title: z.string().max(200),
    kind: z.enum(['single', 'event', 'carousel', 'story', 'video', 'campaign']),
    brand: brandSchema,
    pages: z.array(pageSchema).min(1).max(300),
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
