import { z } from 'zod';
import {
  createFrameNode,
  mediaNodeSchema,
  richTextNodeSchema,
  shapeNodeSchema,
  studioDocumentV5Schema,
  type FrameNode,
  type StudioDocumentV5,
  type StudioNode,
} from './document-v3';
import { activePalette, paletteColor, themeFontFamily } from './theme';
import { studioAiTemplateLayouts } from './templates-v5';
import type { ThemePaletteRole } from '@/features/shared/appearance-theme/contract';
import {
  instantiateElementSet,
  elementSetSnapshotSchema,
  trackElementInstanceOverrides,
} from './element-library';

const unit = z.number().finite().min(0).max(1);
const box = z.object({ x: unit, y: unit, width: unit, height: unit });
const textElement = z.object({
  kind: z.literal('text'),
  text: z.string().trim().min(1).max(600),
  box,
  size: z.number().int().min(18).max(150).default(48),
  color: z.enum(['foreground', 'accent', 'muted']).default('foreground'),
});
const shapeElement = z.object({
  kind: z.literal('shape'),
  shape: z.enum(['rectangle', 'rounded-rectangle', 'ellipse', 'diamond', 'line', 'arrow']),
  box,
  color: z.enum(['foreground', 'accent', 'muted']).default('accent'),
});
const mediaElement = z.object({
  kind: z.literal('media'),
  assetId: z.string().uuid(),
  box,
});
const libraryElement = z.object({
  kind: z.literal('library'),
  setId: z.string().uuid(),
  box,
});
const aiElementSchema = z.discriminatedUnion('kind', [
  textElement,
  shapeElement,
  mediaElement,
  libraryElement,
]);
export const studioAiPlanSchema = z.object({
  title: z.string().trim().min(1).max(200),
  frames: z
    .array(
      z.object({
        eyebrow: z.string().trim().max(100).default(''),
        headline: z.string().trim().max(200).default(''),
        body: z.string().trim().max(800).default(''),
        cta: z.string().trim().max(140).default(''),
        variant: z.enum(['announcement', 'invitation', 'editorial']).default('announcement'),
        elements: z.array(aiElementSchema).max(30).default([]),
      })
    )
    .max(10)
    .default([]),
  edits: z
    .array(
      z
        .object({
          nodeId: z.string().uuid(),
          text: z.string().trim().min(1).max(800).optional(),
          box: box.optional(),
          color: z.enum(['foreground', 'accent', 'muted']).optional(),
          size: z.number().int().min(18).max(150).optional(),
        })
        .refine(
          value =>
            value.text !== undefined ||
            value.box !== undefined ||
            value.color !== undefined ||
            value.size !== undefined
        )
    )
    .max(50)
    .default([]),
  additions: z
    .array(z.object({ frameId: z.string().uuid(), element: aiElementSchema }))
    .max(30)
    .default([]),
  deletions: z.array(z.string().uuid()).max(30).default([]),
});
export type StudioAiPlan = z.infer<typeof studioAiPlanSchema>;
export type StudioAiFormat = 'square' | 'portrait' | 'story' | 'widescreen';
export type StudioAiMode = 'template' | 'free';
export type StudioAiLibrary = Map<
  string,
  {
    revisionId: string;
    snapshot: z.infer<typeof elementSetSnapshotSchema>;
    assetIds: Record<string, string>;
  }
>;

function lines(text: string, width: number, fontSize: number, letterSpacing = 0): number {
  const perLine = Math.max(1, Math.floor(width / (fontSize * 0.68 + Math.max(0, letterSpacing))));
  return text.split('\n').reduce((count, paragraph) => {
    let length = 0;
    let result = 1;
    for (const word of paragraph.split(/\s+/)) {
      if (length + word.length + (length ? 1 : 0) > perLine && length) {
        result++;
        length = 0;
      }
      if (word.length > perLine) {
        result += Math.ceil(word.length / perLine) - 1;
        length = word.length % perLine || perLine;
      } else length += word.length + (length ? 1 : 0);
    }
    return count + result;
  }, 0);
}

function fittedSize(
  text: string,
  width: number,
  height: number,
  preferred: number,
  lineHeight = 1.2,
  letterSpacing = 0
) {
  for (let size = preferred; size >= 18; size -= 2)
    if (lines(text, width, size, letterSpacing) * size * Math.max(1.24, lineHeight) <= height)
      return size;
  throw new Error('Text is too long for the selected frame and safe area');
}

function makeText(
  frame: FrameNode,
  document: StudioDocumentV5,
  name: string,
  text: string,
  rect: { x: number; y: number; width: number; height: number },
  size: number,
  color: string,
  zIndex: number,
  binding: ThemePaletteRole = 'foreground'
) {
  const styleName =
    name === 'Headline'
      ? 'headline'
      : name === 'Body' || name === 'Missing facts'
        ? 'body'
        : name === 'Eyebrow' || name === 'CTA'
          ? 'caption'
          : null;
  const textStyle = document.theme.textStyles.find(style => style.name.toLowerCase() === styleName);
  const lineHeight = textStyle?.lineHeight ?? 1.2;
  const letterSpacing = textStyle?.letterSpacing ?? 0;
  const fontSize = fittedSize(
    text,
    rect.width,
    rect.height,
    Math.max(18, textStyle?.size ?? size),
    lineHeight,
    letterSpacing
  );
  const colorBinding = textStyle?.color ?? binding;
  const fill = textStyle ? paletteColor(activePalette(document.theme), colorBinding) : color;
  return richTextNodeSchema.parse({
    id: crypto.randomUUID(),
    type: 'richText',
    name,
    textRole:
      name === 'Headline'
        ? 'title'
        : name === 'Body'
          ? 'subtitle'
          : name === 'CTA'
            ? 'cta'
            : name === 'Eyebrow'
              ? 'eyebrow'
              : undefined,
    parentFrameId: frame.id,
    transform: rect,
    zIndex,
    style: { fill, fillBinding: colorBinding, stroke: null, strokeWidth: 0, opacity: 1 },
    overrides: textStyle && fontSize !== textStyle.size ? ['typography.fontSize'] : [],
    content: text.split('\n').map(paragraph => ({
      id: crypto.randomUUID(),
      type: 'p',
      children: [
        {
          id: crypto.randomUUID(),
          text: paragraph,
          bold: textStyle?.bold ?? false,
          italic: textStyle?.italic ?? false,
          underline: textStyle?.underline ?? false,
        },
      ],
    })),
    typography: {
      fontFamily: themeFontFamily(
        textStyle?.font ??
          (name === 'Headline' ? document.theme.fonts.display : document.theme.fonts.sans)
      ),
      textStyleId: textStyle?.id,
      fontSize,
      lineHeight,
      letterSpacing,
      horizontalAlign: textStyle?.align ?? 'left',
      verticalAlign: 'top',
    },
  });
}

function absoluteBox(frame: FrameNode, relative: z.infer<typeof box>) {
  const safe = frame.safeAreas;
  const width = frame.transform.width - safe.left - safe.right;
  const height = frame.transform.height - safe.top - safe.bottom;
  const result = {
    x: safe.left + relative.x * width,
    y: safe.top + relative.y * height,
    width: relative.width * width,
    height: relative.height * height,
  };
  if (
    result.width < 1 ||
    result.height < 1 ||
    relative.x + relative.width > 1 ||
    relative.y + relative.height > 1
  )
    throw new Error('AI element exceeds the frame safe area');
  return result;
}

function frameForNode(document: StudioDocumentV5, node: StudioNode) {
  const frame = document.nodes.find(item => item.id === node.parentFrameId);
  if (frame?.type !== 'frame') throw new Error('Selected element has no editable frame');
  return frame;
}

function replaceText(node: Extract<StudioNode, { type: 'richText' }>, text: string) {
  const previous = node.content.flatMap(block => block.children).find(child => 'text' in child);
  node.name = text.slice(0, 80);
  node.content = text.split('\n').map(paragraph => ({
    id: crypto.randomUUID(),
    type: 'p',
    children: [{ ...previous, id: crypto.randomUUID(), text: paragraph, fontSize: undefined }],
  }));
  node.typography.fontSize = fittedSize(
    text,
    node.transform.width,
    node.transform.height,
    node.typography.fontSize,
    node.typography.lineHeight,
    node.typography.letterSpacing
  );
}

export function fitStudioAiThemeText(document: StudioDocumentV5) {
  for (const node of document.nodes) {
    if (node.type !== 'richText') continue;
    const text = node.content
      .map(block => block.children.flatMap(child => ('text' in child ? [child.text] : [])).join(''))
      .join('\n');
    const preferred = Math.max(
      node.typography.fontSize,
      ...node.content.flatMap(block =>
        block.children.flatMap(child =>
          'text' in child ? [child.fontSize ?? node.typography.fontSize] : []
        )
      )
    );
    const size = fittedSize(
      text,
      node.transform.width,
      node.transform.height,
      preferred,
      node.typography.lineHeight,
      node.typography.letterSpacing
    );
    if (size === preferred) continue;
    const scale = size / preferred;
    node.typography.fontSize *= scale;
    if (!node.overrides.includes('typography.fontSize')) node.overrides.push('typography.fontSize');
    node.content = node.content.map(block => ({
      ...block,
      children: block.children.map(child =>
        'text' in child && child.fontSize !== undefined
          ? { ...child, fontSize: child.fontSize * scale }
          : child
      ),
    }));
  }
}

/** The model only chooses content and a bounded layout; this compiler owns V5 nodes and IDs. */
export function compileStudioAiPlan(input: {
  document: StudioDocumentV5;
  plan: StudioAiPlan;
  mode: StudioAiMode;
  format: StudioAiFormat;
  kind: 'single' | 'carousel' | 'story' | 'presentation';
  allowedNodeIds: ReadonlySet<string>;
  allowedFrameIds?: ReadonlySet<string>;
  assetIds: ReadonlySet<string>;
  libraries?: StudioAiLibrary;
  requiredPlaceholders?: readonly string[];
}): StudioDocumentV5 {
  const plan = studioAiPlanSchema.parse(input.plan);
  const document = structuredClone(input.document);
  const palette = activePalette(document.theme);
  const warnings = input.requiredPlaceholders ?? [];
  const hasPatch = plan.edits.length + plan.additions.length + plan.deletions.length > 0;
  if (plan.frames.length === 0 && !hasPatch) throw new Error('AI returned an empty design');
  if (plan.frames.length && hasPatch) throw new Error('AI mixed creation and editing');
  if (plan.frames.length && input.allowedNodeIds.size)
    throw new Error('Selected edits must target existing nodes');
  const appendElement = (
    frame: FrameNode,
    element: z.infer<typeof aiElementSchema>,
    zIndex: number
  ) => {
    const rect = absoluteBox(frame, element.box);
    if (element.kind === 'text') {
      const color =
        element.color === 'accent'
          ? palette.accentForeground
          : element.color === 'muted'
            ? palette.mutedForeground
            : palette.foreground;
      const binding =
        element.color === 'accent'
          ? 'accentForeground'
          : element.color === 'muted'
            ? 'mutedForeground'
            : 'foreground';
      document.nodes.push(
        makeText(
          frame,
          document,
          'AI text',
          element.text,
          rect,
          element.size,
          color,
          zIndex,
          binding
        )
      );
    } else if (element.kind === 'shape') {
      const color =
        element.color === 'accent'
          ? palette.accent
          : element.color === 'muted'
            ? palette.muted
            : palette.foreground;
      document.nodes.push(
        shapeNodeSchema.parse({
          id: crypto.randomUUID(),
          type: 'shape',
          shape: element.shape,
          name: `AI ${element.shape}`,
          parentFrameId: frame.id,
          zIndex,
          transform: rect,
          style: {
            fill: ['line', 'arrow'].includes(element.shape) ? null : color,
            fillBinding: ['line', 'arrow'].includes(element.shape) ? null : element.color,
            stroke: ['line', 'arrow'].includes(element.shape) ? color : null,
            strokeBinding: ['line', 'arrow'].includes(element.shape) ? element.color : null,
            strokeWidth: ['line', 'arrow'].includes(element.shape) ? 6 : 0,
            opacity: 1,
          },
        })
      );
    } else if (element.kind === 'media') {
      if (!input.assetIds.has(element.assetId))
        throw new Error('AI selected an unavailable media asset');
      document.nodes.push(
        mediaNodeSchema.parse({
          id: crypto.randomUUID(),
          type: 'media',
          mediaType: 'image',
          assetId: element.assetId,
          name: 'AI image',
          parentFrameId: frame.id,
          zIndex,
          transform: rect,
          style: { fill: null, stroke: null, strokeWidth: 0, opacity: 1 },
          fit: 'cover',
        })
      );
    } else {
      const library = input.libraries?.get(element.setId);
      if (!library) throw new Error('AI selected an unavailable library element');
      if (
        library.snapshot.nodes.some(
          node => !['frame', 'richText', 'shape', 'media'].includes(node.type)
        )
      )
        throw new Error('Library element contains a node type not supported by Studio AI');
      const created = instantiateElementSet(library.snapshot, {
        setId: element.setId,
        revisionId: library.revisionId,
        targetFrameId: frame.id,
        x: 0,
        y: 0,
        zIndex,
        assetIds: library.assetIds,
      });
      const scale = Math.min(
        rect.width / library.snapshot.width,
        rect.height / library.snapshot.height
      );
      for (const node of created.nodes) {
        node.transform.x = rect.x + node.transform.x * scale;
        node.transform.y = rect.y + node.transform.y * scale;
        node.transform.width *= scale;
        node.transform.height *= scale;
        node.style.strokeWidth *= scale;
        if (node.type === 'richText') {
          node.typography.fontSize *= scale;
          node.content = node.content.map(block => ({
            ...block,
            children: block.children.map(child =>
              'text' in child && child.fontSize !== undefined
                ? { ...child, fontSize: child.fontSize * scale }
                : child
            ),
          }));
        }
        if (
          node.transform.x + node.transform.width > frame.transform.width - frame.safeAreas.right ||
          node.transform.y + node.transform.height > frame.transform.height - frame.safeAreas.bottom
        )
          throw new Error('Library element exceeds the frame safe area');
      }
      document.nodes.push(...created.nodes);
      document.componentInstances.push(created.instance);
    }
  };
  if (plan.frames.length) {
    if (input.kind === 'single' && plan.frames.length !== 1)
      throw new Error('Single post requires one frame');
    if (plan.frames.length > 10) throw new Error('Too many frames');
    if (!document.deliverables.length && !document.nodes.length) {
      document.title = plan.title;
      document.kind = input.kind;
    }
    const frames: FrameNode[] = [];
    for (let index = 0; index < plan.frames.length; index++) {
      const idea = plan.frames[index];
      const frame = createFrameNode(input.format);
      frame.name = idea.headline || `Frame ${index + 1}`;
      frame.zIndex = document.nodes.filter(
        item => item.type === 'frame' && !item.parentFrameId
      ).length;
      frame.transform.x = frame.zIndex * (frame.transform.width + 160);
      frame.style.fill = palette.background;
      frame.style.fillBinding = 'background';
      document.nodes.push(frame);
      frames.push(frame);
      let zIndex = 0;
      if (input.mode === 'template') {
        const variant = idea.variant;
        const body = [
          idea.body,
          ...(index === 0 ? warnings.filter(warning => !idea.body.includes(warning)) : []),
        ]
          .filter(Boolean)
          .join('\n');
        const slots = studioAiTemplateLayouts[variant];
        const fields = [
          ['Eyebrow', idea.eyebrow, slots.eyebrow, 28, palette.foreground, 'foreground'],
          ['Headline', idea.headline, slots.headline, 82, palette.foreground, 'foreground'],
          ['Body', body, slots.body, 38, palette.foreground, 'foreground'],
          ['CTA', idea.cta, slots.cta, 28, palette.foreground, 'foreground'],
        ] as const;
        for (const [name, value, [x, y, width, height], size, color, binding] of fields) {
          if (!value) continue;
          document.nodes.push(
            makeText(
              frame,
              document,
              name,
              value,
              absoluteBox(frame, { x, y, width, height }),
              size,
              color,
              zIndex++,
              binding
            )
          );
        }
        document.nodes.push(
          shapeNodeSchema.parse({
            id: crypto.randomUUID(),
            type: 'shape',
            shape: 'rectangle',
            name: 'Accent',
            parentFrameId: frame.id,
            zIndex,
            transform: absoluteBox(frame, { x: 0.08, y: 0.17, width: 0.16, height: 0.006 }),
            style: {
              fill: palette.accent,
              fillBinding: 'accent',
              stroke: null,
              strokeWidth: 0,
              opacity: 1,
            },
          })
        );
      } else {
        if (!idea.elements.length) throw new Error('Free design needs explicit elements');
        for (const element of idea.elements) {
          if (index === 0 && warnings.length && element.box.y + element.box.height > 0.8)
            throw new Error('Free design must reserve the lower safe area for missing facts');
          appendElement(frame, element, zIndex++);
        }
        if (index === 0 && warnings.length)
          document.nodes.push(
            makeText(
              frame,
              document,
              'Missing facts',
              warnings.join('\n'),
              absoluteBox(frame, { x: 0.08, y: 0.83, width: 0.84, height: 0.12 }),
              28,
              palette.foreground,
              zIndex
            )
          );
      }
    }
    document.deliverables.push({
      id: crypto.randomUUID(),
      code: `AI-${document.deliverables.length + 1}`,
      title: plan.title,
      kind: input.kind,
      frameIds: frames.map(frame => frame.id),
      channel: input.kind === 'presentation' ? 'custom' : 'instagram',
      order: document.deliverables.length,
      status: 'draft',
      dayOffset: 0,
      scheduledAt: null,
      assignee: '',
      brief: '',
      captions: { instagram: '', linkedin: '', facebook: '' },
    });
  } else {
    if (!input.allowedNodeIds.size && !input.allowedFrameIds?.size)
      throw new Error('Select a frame or element to edit');
    for (const edit of plan.edits) {
      const node = document.nodes.find(item => item.id === edit.nodeId);
      if (!node || !input.allowedNodeIds.has(node.id))
        throw new Error('AI edit targets an unselected element');
      const frame = frameForNode(document, node);
      if (node.locked || frame.locked) throw new Error('A selected element or frame is locked');
      if (edit.box) node.transform = { ...node.transform, ...absoluteBox(frame, edit.box) };
      if (edit.size !== undefined) {
        if (node.type !== 'richText') throw new Error('Only text elements can change font size');
        node.typography.fontSize = edit.size;
      }
      if (edit.text !== undefined) {
        if (node.type !== 'richText') throw new Error('Only text elements can receive text edits');
        replaceText(node, edit.text);
      } else if (edit.size !== undefined && node.type === 'richText') {
        const content = node.content
          .flatMap(block => block.children.flatMap(child => ('text' in child ? [child.text] : [])))
          .join(' ');
        node.typography.fontSize = fittedSize(
          content,
          node.transform.width,
          node.transform.height,
          node.typography.fontSize,
          node.typography.lineHeight,
          node.typography.letterSpacing
        );
      }
      if (edit.color) {
        if (node.type === 'richText') {
          const role =
            edit.color === 'accent'
              ? 'accentForeground'
              : edit.color === 'muted'
                ? 'mutedForeground'
                : 'foreground';
          node.style.fillBinding = role;
          node.style.fill = palette[role];
          node.content = node.content.map(block => ({
            ...block,
            children: block.children.map(child =>
              'text' in child ? { ...child, colorBinding: role, color: palette[role] } : child
            ),
          }));
        } else if (node.type === 'shape') {
          const color = palette[edit.color];
          if (node.shape === 'line' || node.shape === 'arrow') {
            node.style.strokeBinding = edit.color;
            node.style.stroke = color;
          } else {
            node.style.fillBinding = edit.color;
            node.style.fill = color;
          }
        } else throw new Error('Selected element cannot be recolored');
      }
      if (edit.size !== undefined && node.type === 'richText')
        node.content = node.content.map(block => ({
          ...block,
          children: block.children.map(child =>
            'text' in child && child.fontSize !== undefined
              ? { ...child, fontSize: node.typography.fontSize }
              : child
          ),
        }));
    }
    for (const nodeId of plan.deletions) {
      const node = document.nodes.find(item => item.id === nodeId);
      if (!node || !input.allowedNodeIds.has(nodeId) || node.type === 'frame')
        throw new Error('AI deletion targets an unselected element');
      const frame = frameForNode(document, node);
      if (node.locked || frame.locked) throw new Error('A selected element or frame is locked');
      document.nodes = document.nodes.filter(item => item.id !== nodeId);
    }
    for (const addition of plan.additions) {
      const frame = document.nodes.find(item => item.id === addition.frameId);
      if (frame?.type !== 'frame') throw new Error('AI addition targets an unavailable frame');
      const authorized =
        input.allowedFrameIds?.has(frame.id) ||
        document.nodes.some(
          node => node.parentFrameId === frame.id && input.allowedNodeIds.has(node.id)
        );
      if (!authorized) throw new Error('AI addition targets an unselected frame');
      if (frame.locked) throw new Error('Selected frame is locked');
      const zIndex =
        Math.max(
          -1,
          ...document.nodes.filter(node => node.parentFrameId === frame.id).map(node => node.zIndex)
        ) + 1;
      appendElement(frame, addition.element, zIndex);
    }
    trackElementInstanceOverrides(input.document, document);
  }
  return studioDocumentV5Schema.parse(document);
}
