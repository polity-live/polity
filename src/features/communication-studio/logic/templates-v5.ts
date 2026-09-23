import type { StudioBrand } from './document';
import {
  createFrameNode,
  createStudioDocumentV5,
  framePresetRegistry,
  mediaNodeSchema,
  richTextNodeSchema,
  shapeNodeSchema,
  type FrameNode,
  type StudioDocumentV5,
} from './document-v3';

type TemplateKind = StudioDocumentV5['kind'];
type DeliverableKind = StudioDocumentV5['deliverables'][number]['kind'];

function addText(
  document: StudioDocumentV5,
  frame: FrameNode,
  value: string,
  box: { x: number; y: number; width: number; height: number },
  fontFamily: StudioBrand['font'],
  fontSize: number,
  color: string,
  zIndex: number,
  align: 'left' | 'center' = 'left'
) {
  const node = richTextNodeSchema.parse({
    id: crypto.randomUUID(),
    name: value.slice(0, 80) || 'Text',
    parentFrameId: frame.id,
    transform: { ...box, rotation: 0 },
    zIndex,
    style: { fill: color, stroke: null, strokeWidth: 0, opacity: 1 },
    type: 'richText',
    content: value.split('\n').map(text => ({
      id: crypto.randomUUID(),
      type: 'p',
      children: [{ id: crypto.randomUUID(), text }],
    })),
    typography: {
      fontFamily,
      fontSize,
      lineHeight: 1.2,
      letterSpacing: 0,
      horizontalAlign: align,
      verticalAlign: 'top',
    },
  });
  document.nodes.push(node);
}

function addFrame(
  document: StudioDocumentV5,
  name: string,
  format: 'portrait' | 'story' | 'widescreen',
  brand: StudioBrand,
  index: number,
  template: string
) {
  const definition = framePresetRegistry[format];
  const dark = index % 3 === 0;
  const background = dark ? brand.foreground : brand.background;
  const foreground = dark ? brand.background : brand.foreground;
  const frame = createFrameNode(format);
  frame.name = name.slice(0, 160);
  frame.zIndex = index;
  frame.transform.x = (index % 4) * (definition.width + 160);
  frame.transform.y = Math.floor(index / 4) * (definition.height + 220);
  frame.style.fill = background;
  frame.transition = 'fade';
  document.nodes.push(frame);

  if (template === 'blank') return frame;
  const quote = template === 'quote';
  const label =
    template === 'explanation' ? `SCHRITT ${String(index + 1).padStart(2, '0')}` : 'Polity';
  addText(
    document,
    frame,
    label,
    { x: 85, y: format === 'story' ? 270 : 90, width: 700, height: 55 },
    brand.bodyFont,
    28,
    foreground,
    0
  );
  addText(
    document,
    frame,
    quote ? `„${name}“` : name,
    { x: 85, y: format === 'story' ? 440 : 250, width: 900, height: 440 },
    brand.font,
    82,
    foreground,
    1,
    quote ? 'center' : 'left'
  );
  const body =
    template === 'checklist'
      ? '01  Ersten Punkt ergänzen\n02  Nächsten Schritt festlegen\n03  Gemeinsam ausprobieren'
      : template === 'invitation'
        ? 'Datum · Uhrzeit\nOrt oder Teilnahmelink\nAnmeldung ergänzen'
        : quote
          ? 'Name und Anlass ergänzen'
          : 'Euren Inhalt hier ergänzen.';
  addText(
    document,
    frame,
    body,
    { x: 85, y: format === 'story' ? 1100 : 850, width: 900, height: 300 },
    brand.bodyFont,
    38,
    foreground,
    2,
    quote ? 'center' : 'left'
  );
  const accent = shapeNodeSchema.parse({
    id: crypto.randomUUID(),
    name: 'Accent',
    parentFrameId: frame.id,
    transform: {
      x: 85,
      y: format === 'story' ? 1620 : 1210,
      width: template === 'explanation' ? 220 : 910,
      height: template === 'invitation' ? 12 : 4,
      rotation: 0,
    },
    zIndex: 3,
    style: { fill: brand.accent, stroke: null, strokeWidth: 0, opacity: 1 },
    type: 'shape',
    shape: 'rectangle',
  });
  document.nodes.push(accent);
  if (brand.logoAssetId) {
    document.nodes.push(
      mediaNodeSchema.parse({
        id: crypto.randomUUID(),
        name: 'Logo',
        parentFrameId: frame.id,
        transform: {
          x: 860,
          y: format === 'story' ? 250 : 70,
          width: 140,
          height: 100,
          rotation: 0,
        },
        zIndex: 4,
        style: { fill: null, stroke: null, strokeWidth: 0, opacity: 1 },
        type: 'media',
        mediaType: 'image',
        assetId: brand.logoAssetId,
      })
    );
  }
  return frame;
}

/** Starter content is born as durable Studio nodes. No legacy scene roundtrip occurs. */
export function createStudioTemplateDocumentV5(
  kind: TemplateKind,
  title: string,
  brand: StudioBrand,
  weeks = 4,
  template = 'announcement',
  counts = { core: 3, stories: 2 }
): StudioDocumentV5 {
  const document = createStudioDocumentV5(title, kind);
  document.frameDefaults.background = brand.background;
  let frameIndex = 0;
  const addPost = (postKind: DeliverableKind, name: string, day: number, code: string) => {
    const count =
      postKind === 'carousel' || postKind === 'video' ? 5 : postKind === 'story' ? 3 : 1;
    const frames = Array.from({ length: count }, (_, index) => {
      const frameName =
        index === 0
          ? name
          : index === count - 1
            ? 'Gemeinsam den nächsten Schritt gehen'
            : `${name} · ${index + 1}`;
      return addFrame(
        document,
        frameName,
        postKind === 'story' || postKind === 'video' ? 'story' : 'portrait',
        brand,
        frameIndex++,
        template
      );
    });
    document.deliverables.push({
      id: crypto.randomUUID(),
      code,
      title: name,
      kind: postKind,
      frameIds: frames.map(frame => frame.id),
      channel: 'instagram',
      order: document.deliverables.length,
      status: 'draft',
      dayOffset: day,
      scheduledAt: null,
      assignee: '',
      brief: '',
      captions: { instagram: '', linkedin: '', facebook: '' },
    });
  };
  if (kind === 'campaign') {
    for (let week = 0; week < Math.max(1, Math.min(12, weeks)); week++) {
      for (let index = 0; index < counts.core; index++) {
        const postKind = (['carousel', 'video', 'single'] as const)[index % 3];
        addPost(
          postKind,
          `${title} · Woche ${week + 1}`,
          week * 7 + Math.min(index * 2, 6),
          `W${week + 1}-${index + 1}`
        );
      }
      for (let index = 0; index < counts.stories; index++)
        addPost(
          'story',
          `${title} · Story ${index + 1}`,
          week * 7 + Math.min(index * 2 + 1, 6),
          `W${week + 1}-S${index + 1}`
        );
    }
  } else if (kind === 'whiteboard') {
    const frame = addFrame(document, title, 'widescreen', brand, 0, 'blank');
    frame.style.fill = brand.background;
  } else addPost(kind === 'event' ? 'single' : kind, title, 0, '01');
  return document;
}
