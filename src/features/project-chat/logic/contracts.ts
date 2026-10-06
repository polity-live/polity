import { optionalFields } from '@/features/communication-studio/logic/patch-schema';
import { z } from 'zod';
import { projectContextReferenceSchema } from './context-references';
import {
  elementSchema,
  brandSchema,
  formats,
  postSchema,
} from '@/features/communication-studio/logic/document';
import { templateNames } from '@/features/communication-studio/logic/templates';
import { cityDesignObjectTypes } from '@/features/amendments/city-design/logic/cityDesignObjectRegistry';
import { BUILTIN_THEME_IDS } from '@/features/shared/appearance-theme';

const id = z.string().min(1).max(200);
const finite = z.number().finite();
const nonEmptyPatch = <T extends z.ZodRawShape>(shape: T) =>
  z
    .strictObject(optionalFields(shape))
    .refine(value => Object.keys(value).length > 0, 'Empty patch');
export const resourceRefSchema = z.union([
  z.strictObject({ id }),
  z.strictObject({ localRef: id }),
]);
const refs = z.array(resourceRefSchema).min(1).max(300);
export const projectScopeSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('studio'), projectId: z.string().uuid() }),
  z.strictObject({ kind: z.literal('amendment'), amendmentId: z.string().uuid() }),
]);
export type ProjectScope = z.infer<typeof projectScopeSchema>;
export const surfaceSchema = z.enum(['studio', 'amendment_text', 'city_design']);
export const editorContextSchema = z.strictObject({
  surface: surfaceSchema,
  branchId: z.string().uuid().nullable().optional(),
  proposalId: z.string().uuid().nullable().optional(),
  documentId: z.string().uuid().optional(),
  cityDesignId: z.string().uuid().optional(),
  pageId: id.optional(),
  elementIds: z.array(id).max(100).optional(),
  objectIds: z.array(id).max(100).optional(),
  featureIds: z.array(id).max(50).optional(),
  contentRevision: z.number().int().nonnegative().optional(),
  references: z.array(projectContextReferenceSchema).max(150).optional(),
  selection: z
    .strictObject({
      anchor: z.strictObject({
        path: z.array(z.number().int().nonnegative()).min(1).max(20),
        offset: z.number().int().nonnegative(),
      }),
      focus: z.strictObject({
        path: z.array(z.number().int().nonnegative()).min(1).max(20),
        offset: z.number().int().nonnegative(),
      }),
    })
    .optional(),
});
export type EditorContext = z.infer<typeof editorContextSchema>;
export const studioCreateSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  groupId: z.string().uuid().nullable(),
  kind: z.enum(['single', 'event', 'carousel', 'story', 'video', 'campaign', 'presentation']),
  template: z.enum(templateNames).default('announcement'),
  themeId: z.string().uuid().default(BUILTIN_THEME_IDS.polity),
  themeMode: z.enum(['light', 'dark']).default('light'),
  campaign: z
    .strictObject({
      weeks: z.number().int().min(1).max(12),
      corePostsPerWeek: z.number().int().min(1).max(3),
      storiesPerWeek: z.number().int().min(0).max(3),
    })
    .optional(),
});
const pageFormat = z.enum(
  Object.keys(formats) as [keyof typeof formats, ...(keyof typeof formats)[]]
);
const elementProperties = z.strictObject(
  optionalFields(
    elementSchema.omit({ id: true, type: true, locked: true, group: true, order: true }).shape
  )
);
const captions = postSchema.shape.captions.partial().strict();
export const studioActionSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('project.patch'),
    patch: nonEmptyPatch({
      title: z.string().min(1).max(200),
      startDate: z.iso.date().or(z.literal('')),
    }),
  }),
  z.strictObject({
    type: z.literal('theme.apply'),
    themeId: z.string().uuid(),
    mode: z.enum(['light', 'dark']),
  }),
  z.strictObject({
    type: z.literal('page.add'),
    ref: id,
    name: z.string().min(1).max(160),
    format: pageFormat,
    template: z.enum(templateNames).default('blank'),
    index: z.number().int().nonnegative().optional(),
  }),
  z.strictObject({ type: z.literal('page.duplicate'), page: resourceRefSchema, ref: id }),
  z.strictObject({
    type: z.literal('page.patch'),
    page: resourceRefSchema,
    patch: nonEmptyPatch({
      name: z.string().max(160),
      background: brandSchema.shape.background,
      duration: finite.min(1).max(60),
      transition: z.enum(['none', 'fade']),
    }),
  }),
  z.strictObject({ type: z.literal('page.resize'), page: resourceRefSchema, format: pageFormat }),
  z.strictObject({ type: z.literal('page.reorder'), pages: refs }),
  z.strictObject({ type: z.literal('page.remove'), page: resourceRefSchema }),
  z.strictObject({
    type: z.literal('element.add'),
    ref: id,
    page: resourceRefSchema,
    elementType: elementSchema.shape.type,
    properties: elementProperties,
  }),
  z.strictObject({
    type: z.literal('element.patch'),
    page: resourceRefSchema,
    element: resourceRefSchema,
    patch: elementProperties.refine(v => Object.keys(v).length > 0),
  }),
  z.strictObject({
    type: z.literal('element.remove'),
    page: resourceRefSchema,
    element: resourceRefSchema,
  }),
  z.strictObject({
    type: z.literal('element.reorder'),
    page: resourceRefSchema,
    elements: z.array(resourceRefSchema).max(100),
  }),
  z.strictObject({
    type: z.literal('elements.group'),
    page: resourceRefSchema,
    elements: z.array(resourceRefSchema).min(2).max(100),
  }),
  z.strictObject({ type: z.literal('elements.ungroup'), page: resourceRefSchema, groupId: id }),
  z.strictObject({
    type: z.literal('post.add'),
    ref: id,
    title: z.string().min(1).max(200),
    kind: postSchema.shape.kind,
    pages: z.array(resourceRefSchema).min(1).max(30),
    day: postSchema.shape.day.default(0),
    cta: z.string().max(300).default(''),
    captions: captions.default({}),
  }),
  z.strictObject({
    type: z.literal('post.patch'),
    post: resourceRefSchema,
    patch: nonEmptyPatch({
      title: z.string().max(200),
      day: postSchema.shape.day,
      cta: z.string().max(300),
      captions,
    }),
  }),
  z.strictObject({
    type: z.literal('post.set_pages'),
    post: resourceRefSchema,
    pages: z.array(resourceRefSchema).min(1).max(30),
  }),
  z.strictObject({ type: z.literal('post.remove'), post: resourceRefSchema }),
]);
export type StudioAction = z.infer<typeof studioActionSchema>;
export const marksSchema = z
  .strictObject({
    bold: z.boolean(),
    italic: z.boolean(),
    underline: z.boolean(),
    strikethrough: z.boolean(),
    code: z.boolean(),
  })
  .partial();
const href = z
  .string()
  .max(2000)
  .refine(v => /^https?:\/\//i.test(v) || /^\/(?!\/)/.test(v), 'Unsafe link');
export const richInlineSchema = z.strictObject({
  text: z.string().max(20000),
  marks: marksSchema.optional(),
  href: href.optional(),
});
const inline = z.array(richInlineSchema).min(1).max(200);
export const richBlockSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('paragraph'), content: inline }),
  z.strictObject({
    kind: z.literal('heading'),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    content: inline,
  }),
  z.strictObject({ kind: z.literal('quote'), content: inline }),
  z.strictObject({
    kind: z.literal('list'),
    ordered: z.boolean(),
    items: z.array(inline).min(1).max(100),
  }),
  z
    .strictObject({
      kind: z.literal('table'),
      rows: z.array(z.array(inline).min(1).max(30)).min(1).max(100),
    })
    .refine(v => v.rows.every(row => row.length === v.rows[0].length), 'Unequal table rows'),
]);
const blocks = z.array(richBlockSchema).min(1).max(100);
export const amendmentActionSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('metadata.patch'),
    patch: nonEmptyPatch({
      title: z.string().min(1).max(200),
      code: z.string().max(100).nullable(),
      reason: z.string().max(20000).nullable(),
      preamble: z.string().max(20000).nullable(),
      hashtags: z.array(z.string().min(1).max(100)).max(50),
    }),
  }),
  z.strictObject({ type: z.literal('text.replace'), anchorRef: id, text: z.string().max(20000) }),
  z.strictObject({
    type: z.literal('text.format'),
    anchorRef: id,
    marks: marksSchema.refine(v => Object.keys(v).length > 0),
  }),
  z.strictObject({
    type: z.literal('blocks.insert'),
    anchorBlockRef: id,
    position: z.enum(['before', 'after']),
    blocks,
  }),
  z.strictObject({ type: z.literal('blocks.append'), blocks }),
  z.strictObject({
    type: z.literal('blocks.replace'),
    blockRefs: z.array(id).min(1).max(100),
    blocks,
  }),
  z.strictObject({ type: z.literal('blocks.remove'), blockRefs: z.array(id).min(1).max(100) }),
]);
export type AmendmentAction = z.infer<typeof amendmentActionSchema>;
const point = z.strictObject({ x: finite, z: finite });
export const geometryInputSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('point'), point, rotationDeg: finite.default(0) }),
  z.strictObject({ kind: z.literal('polygon'), points: z.array(point).min(3).max(10000) }),
  z.strictObject({
    kind: z.literal('corridor'),
    start: point,
    end: point,
    widthMeters: finite.positive().max(1000),
  }),
  z.strictObject({
    kind: z.literal('path_corridor'),
    points: z.array(point).min(2).max(10000),
    widthMeters: finite.positive().max(1000),
  }),
]);
const properties = z.record(
  z.string().max(100),
  z.union([z.string().max(2000), finite, z.boolean(), z.null()])
);
export const cityActionSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('object.add'),
    ref: id,
    objectType: z.enum(cityDesignObjectTypes),
    geometry: geometryInputSchema,
    properties: properties.default({}),
  }),
  z.strictObject({ type: z.literal('object.patch'), object: resourceRefSchema, properties }),
  z.strictObject({
    type: z.literal('object.set_geometry'),
    object: resourceRefSchema,
    geometry: geometryInputSchema,
  }),
  z.strictObject({
    type: z.literal('object.translate'),
    object: resourceRefSchema,
    dxMeters: finite,
    dzMeters: finite,
  }),
  z.strictObject({
    type: z.literal('object.rotate'),
    object: resourceRefSchema,
    rotationDeg: finite,
  }),
  z.strictObject({
    type: z.literal('object.set_width'),
    object: resourceRefSchema,
    widthMeters: finite.positive().max(1000),
  }),
  z.strictObject({
    type: z.literal('object.set_unit_cost'),
    object: resourceRefSchema,
    unitCostMinor: z.number().int().nonnegative().safe().nullable(),
  }),
  z.strictObject({ type: z.literal('object.remove'), object: resourceRefSchema }),
  z.strictObject({ type: z.literal('osm.import_feature'), featureId: id }),
]);
export type CityAction = z.infer<typeof cityActionSchema>;
export const applyActionsSchema = <T extends z.ZodType>(action: T) =>
  z.strictObject({
    snapshotId: z.string().uuid(),
    summary: z.string().trim().min(1).max(200),
    actions: z.array(action).min(1).max(50),
  });
export const applyStudioSchema = applyActionsSchema(studioActionSchema);
export const applyAmendmentSchema = applyActionsSchema(amendmentActionSchema);
export const applyCitySchema = applyActionsSchema(cityActionSchema);
export class ProjectToolError extends Error {
  constructor(
    public code: string,
    message = code,
    public recovery: 'none' | 'read_again' | 'ask_user' | 'resume' = 'none'
  ) {
    super(message);
  }
}
export function resolveRef(
  ref: z.infer<typeof resourceRefSchema>,
  created: Record<string, string>
) {
  const value = 'id' in ref ? ref.id : created[ref.localRef];
  if (!value) throw new ProjectToolError('invalid_reference');
  return value;
}
export function registerRef(ref: string, created: Record<string, string>, createId: () => string) {
  if (Object.hasOwn(created, ref) || ['__proto__', 'constructor', 'prototype'].includes(ref))
    throw new ProjectToolError('invalid_reference');
  return (created[ref] = createId());
}
