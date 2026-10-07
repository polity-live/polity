import type { StudioElement } from './document';
import {
  chartNodeSchema,
  createFrameNode,
  mediaNodeSchema,
  richTextNodeSchema,
  shapeNodeSchema,
  tableNodeSchema,
  type StudioNode,
} from './document-v3';

/** The insert menu writes a semantic node directly into the V5 document. */
export function createStudioNodeFromElement(
  element: StudioElement,
  parentFrameId: string,
  zIndex: number
): StudioNode {
  const base = createFrameNode('custom', {
    id: element.id,
    name: element.text.slice(0, 80) || element.type,
    parentFrameId,
    transform: {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation,
      flipX: element.flipX,
      flipY: element.flipY,
    },
    zIndex,
    visible: element.visible,
    locked: element.locked,
    animation: element.animation,
    style: {
      fill: element.fill,
      fillBinding: null,
      stroke: element.stroke,
      strokeBinding: null,
      strokeWidth: element.strokeWidth,
      strokeStyle: 'solid',
      opacity: element.opacity,
      cornerRadius: 0,
      roughness: 0,
    },
  });
  if (element.type === 'text')
    return richTextNodeSchema.parse({
      ...base,
      type: 'richText',
      content: element.text.split('\n').map(text => ({
        id: crypto.randomUUID(),
        type: 'p',
        children: [{ id: crypto.randomUUID(), text }],
      })),
      typography: {
        fontFamily: element.font,
        fontSize: element.fontSize,
        lineHeight: element.lineHeight,
        letterSpacing: 0,
        horizontalAlign: element.align,
        verticalAlign: element.verticalAlign,
        textStyleId: null,
      },
    });
  if (element.type === 'image' || element.type === 'video') {
    if (!element.assetId) throw new Error('Media asset missing');
    return mediaNodeSchema.parse({
      ...base,
      type: 'media',
      mediaType: element.type,
      assetId: element.assetId,
      fit: element.fit,
      focus: { x: element.cropX, y: element.cropY },
      crop: element.crop,
      trim: { start: element.trimStart, end: null },
      muted: element.muted,
      alt: element.text,
    });
  }
  if (element.type === 'table')
    return tableNodeSchema.parse({ ...base, type: 'table', data: element.table });
  if (element.type === 'chart')
    return chartNodeSchema.parse({ ...base, type: 'chart', data: element.chart });
  return shapeNodeSchema.parse({
    ...base,
    type: 'shape',
    shape: element.type === 'rect' ? 'rectangle' : element.type,
    endArrowhead: element.type === 'arrow' ? 'arrow' : 'none',
  });
}
