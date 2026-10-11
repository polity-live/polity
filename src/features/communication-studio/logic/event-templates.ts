import {
  createFrameNode,
  createStudioDocumentV3,
  richTextNodeSchema,
  chartNodeSchema,
  shapeNodeSchema,
  type StudioDocumentV3,
  type StudioNode,
} from './document-v3';
import { type LiveBinding } from './live-contract';
import { applyThemeSnapshot, type StudioThemeSnapshot } from './theme';
import { defaultEventIntro } from './event-intro';

export const eventTemplateTypes = [
  'cover',
  'vote',
  'election',
  'speech',
  'discussion',
  'accreditation',
  'amendment',
  'implementation_review',
  'support_confirmation',
] as const;
export function createBoundText(
  binding: LiveBinding,
  parentFrameId: string,
  zIndex = 0
): StudioNode {
  return richTextNodeSchema.parse({
    id: crypto.randomUUID(),
    name: binding.field,
    type: 'richText',
    parentFrameId,
    transform: { x: 100, y: 100, width: 1720, height: 120, rotation: 0 },
    zIndex,
    style: { fillBinding: 'foreground' },
    liveBinding: binding,
    showAnimation: { preset: 'stagger', duration: 0.8, intensity: 0.4 },
    content: [
      { id: crypto.randomUUID(), type: 'p', children: [{ id: crypto.randomUUID(), text: '…' }] },
    ],
    typography: { fontFamily: 'Manrope', fontSize: 42 },
  });
}
export function createLiveNode(
  binding: LiveBinding,
  parentFrameId: string,
  zIndex = 0
): StudioNode {
  if (binding.field !== 'results') return createBoundText(binding, parentFrameId, zIndex);
  return chartNodeSchema.parse({
    id: crypto.randomUUID(),
    name: 'Results',
    type: 'chart',
    parentFrameId,
    zIndex,
    liveBinding: binding,
    transform: { x: 100, y: 100, width: 1720, height: 600 },
    style: { fillBinding: 'foreground' },
    data: {
      kind: 'bar',
      layout: 'results',
      labels: ['…'],
      series: [{ id: crypto.randomUUID(), name: 'Votes', color: '#2563EB', values: [0] }],
    },
  });
}
export function createEventTemplate(
  template: string,
  sourceId: string,
  index = 0,
  theme?: StudioThemeSnapshot
): StudioDocumentV3 {
  const document = createStudioDocumentV3('Event', 'event');
  const cover = template === 'cover';
  const sourceType = cover ? 'event' : 'agenda_item';
  const frame = createFrameNode('widescreen', {
    name: template,
    zIndex: index,
    transform: { x: index * 2080, y: 0, width: 1920, height: 1080 },
    style: { ...createFrameNode('widescreen').style, fillBinding: 'background', strokeWidth: 0 },
    eventSource: { type: sourceType, id: sourceId, template },
    portrait: { transform: { x: 0, y: 0, width: 1080, height: 1920 } },
    ...(cover ? { intro: { ...defaultEventIntro } } : {}),
    showAnimation: { preset: cover ? 'none' : 'fade', duration: 0.8, intensity: 0.3 },
    transition: cover ? 'none' : 'fade',
  });
  document.nodes.push(frame);
  const add = (
    field: LiveBinding['field'],
    format: LiveBinding['format'],
    y: number,
    height: number,
    size: number,
    portraitY: number,
    portraitHeight: number
  ) => {
    const node = createBoundText(
      { sourceType, sourceId, field, format },
      frame.id,
      document.nodes.length
    );
    node.eventTemplateSlot = field;
    if (cover) node.showAnimation = { preset: 'none', duration: 0.8, intensity: 0 };
    node.transform = { ...node.transform, y, height };
    node.portrait = {
      transform: { x: 70, y: portraitY, width: 940, height: portraitHeight },
      fontSize: size,
    };
    if (node.type === 'richText') {
      node.typography.fontSize = size;
      node.textRole = field === 'title' ? 'title' : field === 'details' ? 'body' : 'subtitle';
      const style = document.theme.textStyles.find(s =>
        field === 'title' ? /headline|title/i.test(s.name) : /body/i.test(s.name)
      );
      if (style) node.typography.textStyleId = style.id;
    }
    document.nodes.push(node);
  };
  add(cover ? 'organizer' : 'status', 'text', 70, 70, 30, 110, 90);
  add('title', 'text', 180, 240, 84, 300, 370);
  add('times', 'text', 440, 90, 36, 740, 160);
  const results = [
    'vote',
    'election',
    'amendment',
    'implementation_review',
    'support_confirmation',
  ].includes(template);
  if (results) {
    const chart = chartNodeSchema.parse({
      id: crypto.randomUUID(),
      name: 'Ergebnisse',
      type: 'chart',
      parentFrameId: frame.id,
      eventTemplateSlot: 'results',
      transform: { x: 100, y: 520, width: 1720, height: 420 },
      zIndex: 4,
      style: { fillBinding: 'foreground' },
      liveBinding: { sourceType, sourceId, field: 'results', format: 'results' },
      portrait: { transform: { x: 70, y: 1030, width: 940, height: 650 } },
      data: {
        kind: 'bar',
        labels: ['…'],
        series: [{ id: crypto.randomUUID(), name: 'Stimmen', color: '#2563EB', values: [0] }],
        legend: true,
      },
    });
    document.nodes.push(chart);
    add('details', 'text', 970, 70, 30, 1740, 100);
  } else if (cover) {
    add('location', 'text', 610, 110, 42, 1040, 170);
    add('countdown', 'countdown', 820, 150, 64, 1420, 200);
  } else {
    add(
      template === 'speech' || template === 'discussion' ? 'speakers' : 'details',
      template === 'speech' || template === 'discussion' ? 'speakers' : 'text',
      600,
      360,
      42,
      1050,
      650
    );
  }
  document.nodes.push(
    shapeNodeSchema.parse({
      id: crypto.randomUUID(),
      name: 'Accent',
      type: 'shape',
      shape: 'rectangle',
      parentFrameId: frame.id,
      eventTemplateSlot: 'accent',
      transform: { x: 100, y: 1010, width: 500, height: 8 },
      zIndex: 100,
      style: { fillBinding: 'accent' },
      portrait: { transform: { x: 70, y: 1840, width: 300, height: 8 } },
    })
  );
  document.show = { order: 'agenda', cues: [] };
  applyThemeSnapshot(document, theme ?? document.theme);
  return document;
}
