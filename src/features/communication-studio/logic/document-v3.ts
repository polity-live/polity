import { z } from 'zod';
import { chartDataSchema, fontFamilies, mediaCropSchema, tableDataSchema } from './document';
import { themePaletteRoleSchema } from '@/features/shared/appearance-theme/contract';
import { DEFAULT_STUDIO_THEME, studioThemeSnapshotSchema } from './theme';

const finite = z.number().finite();
const color = z.string().regex(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i);
const uuid = z.string().uuid();

export const STUDIO_DOCUMENT_SCHEMA_VERSION = 4 as const;

export const framePresetRegistry = {
  square: { id: 'square', label: 'Square post', width: 1080, height: 1080, safeArea: 54 },
  portrait: { id: 'portrait', label: 'Portrait post', width: 1080, height: 1350, safeArea: 54 },
  story: { id: 'story', label: 'Story / Reel', width: 1080, height: 1920, safeArea: 96 },
  widescreen: { id: 'widescreen', label: 'Widescreen', width: 1920, height: 1080, safeArea: 54 },
  standard: { id: 'standard', label: 'Presentation', width: 1440, height: 1080, safeArea: 54 },
} as const;

export type FramePresetId = keyof typeof framePresetRegistry;

export const transformSchema = z.object({
  x: finite.min(-1_000_000).max(1_000_000),
  y: finite.min(-1_000_000).max(1_000_000),
  width: finite.min(1).max(100_000),
  height: finite.min(1).max(100_000),
  rotation: finite.min(-360_000).max(360_000).default(0),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
});

export const constraintsSchema = z.object({
  horizontal: z.enum(['left', 'right', 'left-right', 'center', 'scale']).default('left'),
  vertical: z.enum(['top', 'bottom', 'top-bottom', 'center', 'scale']).default('top'),
});

export const studioStyleSchema = z.object({
  fill: color.nullable().default(null),
  fillBinding: themePaletteRoleSchema.nullable().default(null),
  stroke: color.nullable().default(null),
  strokeBinding: themePaletteRoleSchema.nullable().default(null),
  strokeWidth: finite.min(0).max(100).default(0),
  strokeStyle: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
  opacity: finite.min(0).max(1).default(1),
  cornerRadius: finite.min(0).max(10_000).default(0),
  roughness: finite.min(0).max(2).default(0),
});

const nodeBaseShape = {
  id: uuid,
  name: z.string().min(1).max(200),
  parentFrameId: uuid.nullable().default(null),
  transform: transformSchema,
  zIndex: z.number().int().min(-1_000_000).max(1_000_000),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  groupIds: z.array(uuid).max(32).default([]),
  constraints: constraintsSchema.default({ horizontal: 'left', vertical: 'top' }),
  style: studioStyleSchema,
  componentRef: z.string().max(200).nullable().default(null),
  overrides: z.array(z.string().min(1).max(120)).max(100).default([]),
  animation: z.enum(['none', 'fade']).default('none'),
  /** Durable Excalidraw payload for elements that use native Excalidraw interaction. */
  excalidraw: z.record(z.string(), z.json()).nullable().default(null),
};

export const frameNodeSchema = z.object({
  ...nodeBaseShape,
  type: z.literal('frame'),
  preset: z.enum(['square', 'portrait', 'story', 'widescreen', 'standard', 'custom']),
  duration: finite.min(1).max(60).default(5),
  transition: z.enum(['none', 'fade']).default('none'),
  clipContent: z.boolean().default(true),
  safeAreas: z
    .object({
      top: finite.nonnegative(),
      right: finite.nonnegative(),
      bottom: finite.nonnegative(),
      left: finite.nonnegative(),
    })
    .default({ top: 0, right: 0, bottom: 0, left: 0 }),
  grid: z
    .object({ enabled: z.boolean(), size: finite.min(1).max(1_000), snap: z.boolean() })
    .default({ enabled: true, size: 8, snap: true }),
  layout: z
    .object({
      mode: z.enum(['free', 'horizontal', 'vertical', 'wrap']).default('free'),
      padding: finite.min(0).max(10_000).default(0),
      gap: finite.min(0).max(10_000).default(0),
      align: z.enum(['start', 'center', 'end', 'stretch']).default('start'),
      justify: z.enum(['start', 'center', 'end', 'space-between']).default('start'),
    })
    .default({ mode: 'free', padding: 0, gap: 0, align: 'start', justify: 'start' }),
});

const plateLeafSchema = z
  .object({
    id: uuid,
    text: z.string().max(100_000),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
    strikethrough: z.boolean().optional(),
    code: z.boolean().optional(),
    highlight: z.boolean().optional(),
    color: color.optional(),
    backgroundColor: color.optional(),
    fontSize: finite.min(8).max(300).optional(),
    fontFamily: z.enum(fontFamilies).optional(),
    textStyleId: uuid.optional(),
    colorBinding: themePaletteRoleSchema.optional(),
    data: z.record(z.string(), z.json()).optional(),
  })
  .strict();

export type StudioPlateChild = z.infer<typeof plateLeafSchema> | StudioPlateElement;
export interface StudioPlateElement {
  id: string;
  type: string;
  children: StudioPlateChild[];
  align?: 'left' | 'center' | 'right' | 'justify';
  list?: 'bullet' | 'number';
  url?: string;
  checked?: boolean;
  indent?: number;
  language?: string;
  value?: string;
}

export const plateElementSchema: z.ZodType<StudioPlateElement> = z.lazy(() =>
  z
    .object({
      id: uuid,
      type: z.string().min(1).max(80),
      children: z
        .array(z.union([plateLeafSchema, plateElementSchema]))
        .min(1)
        .max(5_000),
      align: z.enum(['left', 'center', 'right', 'justify']).optional(),
      list: z.enum(['bullet', 'number']).optional(),
      url: z.string().max(2_000).optional(),
      checked: z.boolean().optional(),
      indent: z.number().int().min(0).max(20).optional(),
      language: z.string().max(80).optional(),
      value: z.string().max(200_000).optional(),
      data: z.record(z.string(), z.json()).optional(),
    })
    .strict()
);

export const richTextNodeSchema = z.object({
  ...nodeBaseShape,
  type: z.literal('richText'),
  content: z.array(plateElementSchema).min(1).max(5_000),
  typography: z.object({
    fontFamily: z.enum(fontFamilies).default('Manrope'),
    fontSize: finite.min(8).max(300).default(42),
    lineHeight: finite.min(0.5).max(4).default(1.2),
    letterSpacing: finite.min(-20).max(100).default(0),
    horizontalAlign: z.enum(['left', 'center', 'right', 'justify']).default('left'),
    verticalAlign: z.enum(['top', 'middle', 'bottom']).default('top'),
    textStyleId: uuid.nullable().default(null),
  }),
});

export const shapeNodeSchema = z.object({
  ...nodeBaseShape,
  type: z.literal('shape'),
  shape: z.enum(['rectangle', 'rounded-rectangle', 'ellipse', 'diamond', 'line', 'arrow']),
  startArrowhead: z.enum(['none', 'arrow', 'bar', 'dot', 'triangle']).default('none'),
  endArrowhead: z.enum(['none', 'arrow', 'bar', 'dot', 'triangle']).default('none'),
  startBindingId: uuid.nullable().default(null),
  endBindingId: uuid.nullable().default(null),
});

export const drawingNodeSchema = z.object({
  ...nodeBaseShape,
  type: z.literal('drawing'),
  tool: z.enum(['pen', 'eraser', 'laser']).default('pen'),
  points: z.array(z.tuple([finite, finite])).max(100_000),
});

export const mediaNodeSchema = z.object({
  ...nodeBaseShape,
  type: z.literal('media'),
  mediaType: z.enum(['image', 'video', 'audio', 'file']),
  assetId: uuid,
  fit: z.enum(['contain', 'cover']).default('contain'),
  focus: z.object({ x: finite.min(0).max(1), y: finite.min(0).max(1) }).default({ x: 0.5, y: 0.5 }),
  crop: mediaCropSchema.nullable().default(null),
  trim: z
    .object({ start: finite.nonnegative(), end: finite.nonnegative().nullable() })
    .default({ start: 0, end: null }),
  muted: z.boolean().default(true),
  alt: z.string().max(2_000).default(''),
});

export const tableNodeSchema = z.object({
  ...nodeBaseShape,
  type: z.literal('table'),
  data: tableDataSchema,
});

export const chartNodeSchema = z.object({
  ...nodeBaseShape,
  type: z.literal('chart'),
  data: chartDataSchema,
  sourceAssetId: uuid.nullable().default(null),
});

export const embedNodeSchema = z.object({
  ...nodeBaseShape,
  type: z.literal('embed'),
  provider: z.enum(['supported', 'code', 'formula', 'columns', 'data-view']),
  value: z.string().max(200_000),
});

export const studioNodeSchema = z.discriminatedUnion('type', [
  frameNodeSchema,
  richTextNodeSchema,
  shapeNodeSchema,
  drawingNodeSchema,
  mediaNodeSchema,
  tableNodeSchema,
  chartNodeSchema,
  embedNodeSchema,
]);

export const deliverableSchema = z.object({
  id: uuid,
  code: z.string().max(100),
  title: z.string().max(200),
  kind: z.enum(['single', 'carousel', 'story', 'video']),
  frameIds: z.array(uuid).min(1).max(100),
  channel: z.enum(['instagram', 'linkedin', 'facebook', 'custom']).default('instagram'),
  order: z.number().int().nonnegative(),
  status: z.enum(['draft', 'ready', 'published']).default('draft'),
  dayOffset: z.number().int().min(0).max(3_650).default(0),
  scheduledAt: z.iso.datetime().nullable().default(null),
  assignee: z.string().max(150).default(''),
  brief: z.string().max(2_000).default(''),
  captions: z.object({
    instagram: z.string().max(20_000),
    linkedin: z.string().max(20_000),
    facebook: z.string().max(20_000),
  }),
});

export const componentInstanceSchema = z.object({
  id: uuid,
  setId: uuid,
  revisionId: uuid,
  sourceToInstance: z.record(uuid, uuid),
  localOverrides: z.record(uuid, z.array(z.string().min(1).max(160)).max(200)).default({}),
  localDeletions: z.array(uuid).max(50_000).default([]),
  detachedNodes: z.array(uuid).max(50_000).default([]),
});

export const studioDocumentV3Schema = z
  .object({
    schemaVersion: z.literal(STUDIO_DOCUMENT_SCHEMA_VERSION),
    title: z.string().min(1).max(200),
    kind: z.enum(['single', 'event', 'carousel', 'story', 'video', 'campaign', 'whiteboard']),
    theme: studioThemeSnapshotSchema,
    frameDefaults: z
      .object({ background: color.nullable().default(null) })
      .default({ background: null }),
    masterLayout: z
      .object({
        frameId: uuid.nullable().default(null),
        placements: z.record(uuid, z.enum(['background', 'foreground'])).default({}),
      })
      .default({ frameId: null, placements: {} }),
    nodes: z.array(studioNodeSchema).max(50_000),
    deliverables: z.array(deliverableSchema).max(1_000),
    campaign: z.object({ startDate: z.iso.date().or(z.literal('')) }).default({ startDate: '' }),
    componentInstances: z.array(componentInstanceSchema).max(10_000).default([]),
    files: z.record(z.string(), z.json()).default({}),
  })
  .superRefine((document, context) => {
    const nodeById = new Map(document.nodes.map(node => [node.id, node]));
    if (nodeById.size !== document.nodes.length)
      context.addIssue({ code: 'custom', path: ['nodes'], message: 'Duplicate Studio node IDs' });

    for (const node of document.nodes) {
      if (node.parentFrameId) {
        const parent = nodeById.get(node.parentFrameId);
        if (!parent || parent.type !== 'frame')
          context.addIssue({
            code: 'custom',
            path: ['nodes'],
            message: `Unknown parent frame for ${node.id}`,
          });
      }
      const visited = new Set([node.id]);
      let parentId = node.parentFrameId;
      while (parentId) {
        if (visited.has(parentId)) {
          context.addIssue({
            code: 'custom',
            path: ['nodes'],
            message: `Circular frame hierarchy at ${node.id}`,
          });
          break;
        }
        visited.add(parentId);
        parentId = nodeById.get(parentId)?.parentFrameId ?? null;
      }
    }

    const deliverableIds = new Set<string>();
    for (const deliverable of document.deliverables) {
      if (deliverableIds.has(deliverable.id))
        context.addIssue({
          code: 'custom',
          path: ['deliverables'],
          message: 'Duplicate deliverable IDs',
        });
      deliverableIds.add(deliverable.id);
      if (deliverable.frameIds.some(id => nodeById.get(id)?.type !== 'frame'))
        context.addIssue({
          code: 'custom',
          path: ['deliverables'],
          message: `Unknown deliverable frame in ${deliverable.id}`,
        });
    }

    const masterFrameId = document.masterLayout.frameId;
    if (masterFrameId) {
      const master = nodeById.get(masterFrameId);
      if (!master || master.type !== 'frame' || master.parentFrameId)
        context.addIssue({
          code: 'custom',
          path: ['masterLayout', 'frameId'],
          message: 'Master layout must reference a root frame',
        });
      for (const nodeId of Object.keys(document.masterLayout.placements)) {
        const node = nodeById.get(nodeId);
        if (!node || node.parentFrameId !== masterFrameId)
          context.addIssue({
            code: 'custom',
            path: ['masterLayout', 'placements', nodeId],
            message: 'Master placement must reference a direct master child',
          });
      }
      if (document.deliverables.some(deliverable => deliverable.frameIds.includes(masterFrameId)))
        context.addIssue({
          code: 'custom',
          path: ['deliverables'],
          message: 'Master layout cannot be exported as a deliverable frame',
        });
    }
  });

export type StudioTransform = z.infer<typeof transformSchema>;
export type StudioNode = z.infer<typeof studioNodeSchema>;
export type FrameNode = z.infer<typeof frameNodeSchema>;
export type RichTextNode = z.infer<typeof richTextNodeSchema>;
export type StudioDeliverable = z.infer<typeof deliverableSchema>;
export type StudioDocumentV3 = z.infer<typeof studioDocumentV3Schema>;
export type StudioDocumentV4 = StudioDocumentV3;
export const studioDocumentV4Schema = studioDocumentV3Schema;

export function createStudioDocumentV3(
  title: string,
  kind: StudioDocumentV3['kind'] = 'single'
): StudioDocumentV3 {
  return studioDocumentV3Schema.parse({
    schemaVersion: STUDIO_DOCUMENT_SCHEMA_VERSION,
    title,
    kind,
    theme: DEFAULT_STUDIO_THEME,
    frameDefaults: { background: null },
    masterLayout: { frameId: null, placements: {} },
    nodes: [],
    deliverables: [],
    campaign: { startDate: '' },
    componentInstances: [],
    files: {},
  });
}

export const createStudioDocumentV4 = createStudioDocumentV3;

export function createFrameNode(
  preset: FramePresetId | 'custom' = 'portrait',
  values: Omit<Partial<FrameNode>, 'transform'> & {
    transform?: z.input<typeof transformSchema>;
  } = {}
): FrameNode {
  const definition = preset === 'custom' ? null : framePresetRegistry[preset];
  const safeArea = definition?.safeArea ?? 0;
  return frameNodeSchema.parse({
    id: crypto.randomUUID(),
    type: 'frame',
    name: definition?.label ?? 'Frame',
    parentFrameId: null,
    transform: {
      x: 0,
      y: 0,
      width: definition?.width ?? 1080,
      height: definition?.height ?? 1080,
      rotation: 0,
    },
    zIndex: 0,
    visible: true,
    locked: false,
    groupIds: [],
    constraints: { horizontal: 'left', vertical: 'top' },
    style: {
      fill: null,
      stroke: '#888888',
      strokeWidth: 1,
      strokeStyle: 'solid',
      opacity: 1,
      cornerRadius: 0,
      roughness: 0,
    },
    componentRef: null,
    animation: 'none',
    excalidraw: null,
    preset,
    duration: 5,
    transition: 'none',
    clipContent: true,
    safeAreas: { top: safeArea, right: safeArea, bottom: safeArea, left: safeArea },
    grid: { enabled: true, size: 8, snap: true },
    layout: { mode: 'free', padding: 0, gap: 0, align: 'start', justify: 'start' },
    ...values,
  });
}

export function frameChildren(document: StudioDocumentV3, frameId: string): StudioNode[] {
  return document.nodes
    .filter(node => node.parentFrameId === frameId)
    .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));
}

export function descendantsOf(document: StudioDocumentV3, nodeId: string): StudioNode[] {
  const result: StudioNode[] = [];
  const visit = (parentId: string) => {
    for (const node of document.nodes) {
      if (node.parentFrameId !== parentId) continue;
      result.push(node);
      visit(node.id);
    }
  };
  visit(nodeId);
  return result;
}

export function assertCanReparent(
  document: StudioDocumentV3,
  nodeIds: string[],
  parentFrameId: string | null
) {
  const ids = new Set(nodeIds);
  if (ids.size !== nodeIds.length) throw new Error('Duplicate node IDs');
  const target = parentFrameId ? document.nodes.find(node => node.id === parentFrameId) : null;
  if (parentFrameId && target?.type !== 'frame') throw new Error('Parent must be a frame');
  for (const id of ids) {
    const node = document.nodes.find(candidate => candidate.id === id);
    if (!node) throw new Error('Node not found');
    if (node.locked) throw new Error('Node is locked');
    if (
      parentFrameId === id ||
      descendantsOf(document, id).some(child => child.id === parentFrameId)
    )
      throw new Error('Circular frame hierarchy');
  }
}
