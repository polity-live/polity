import {
  createFrameNode,
  drawingNodeSchema,
  richTextNodeSchema,
  shapeNodeSchema,
  type StudioDocumentV3,
  type StudioNode,
  type StudioPlateElement,
} from './document-v3';
import type { StudioElement } from './document';
import { getStudioRootFramesInLayerOrder } from './frame-order';
import { worldBounds, worldToLocalPoint } from './selection-geometry';
import { formatStudioRichText } from './patch-studio-node';
import type { StudioTool } from '../state/studio-viewport-store';
type Transact = (change: (document: StudioDocumentV3) => void) => void;
export function createStudioCanvasNode({
  document,
  canEdit,
  brandForeground,
  tool,
  start,
  end,
  rounded,
  points = [],
  transact,
}: {
  document: StudioDocumentV3 | null;
  canEdit: boolean;
  brandForeground?: string;
  tool: StudioTool;
  start: { x: number; y: number };
  end: { x: number; y: number };
  rounded: boolean;
  points?: [number, number][];
  transact: Transact;
}): string | null {
  const currentDocument = document;
  if (!currentDocument || !canEdit) return null;
  const frame = [...getStudioRootFramesInLayerOrder(currentDocument)].reverse().find(candidate => {
    const bounds = worldBounds(currentDocument, candidate);
    return (
      start.x >= bounds.left &&
      start.x <= bounds.right &&
      start.y >= bounds.top &&
      start.y <= bounds.bottom
    );
  });
  const parentFrameId = tool === 'frame' ? null : (frame?.id ?? null);
  const localStart = worldToLocalPoint(currentDocument, parentFrameId, start);
  const localEnd = worldToLocalPoint(currentDocument, parentFrameId, end);
  const x = Math.min(localStart.x, localEnd.x);
  const y = Math.min(localStart.y, localEnd.y);
  const width = Math.max(tool === 'text' ? 700 : 4, Math.abs(localEnd.x - localStart.x));
  const height = Math.max(tool === 'text' ? 180 : 4, Math.abs(localEnd.y - localStart.y));
  const id = crypto.randomUUID();
  const zIndex =
    Math.max(
      -1,
      ...currentDocument.nodes
        .filter(node => node.parentFrameId === parentFrameId)
        .map(node => node.zIndex)
    ) + 1;
  const foreground = brandForeground ?? '#12362D';
  const common = {
    id,
    name: tool === 'text' ? 'Text' : tool,
    parentFrameId,
    transform: { x, y, width, height, rotation: 0 },
    zIndex,
    style: {
      fill:
        tool === 'text'
          ? foreground
          : ['line', 'arrow', 'draw', 'laser'].includes(tool)
            ? null
            : '#B88A3B',
      stroke: foreground,
      strokeWidth: ['line', 'arrow', 'draw', 'laser'].includes(tool) ? 3 : 1,
      cornerRadius: rounded ? 24 : 0,
      opacity: 1,
    },
  };
  let node: StudioNode;
  if (tool === 'frame') {
    node = createFrameNode('custom', {
      id,
      name: 'Frame',
      zIndex,
      transform: {
        x,
        y,
        width: Math.max(200, width),
        height: Math.max(200, height),
        rotation: 0,
      },
    });
  } else if (tool === 'text') {
    node = richTextNodeSchema.parse({
      ...common,
      content: [
        { id: crypto.randomUUID(), type: 'p', children: [{ id: crypto.randomUUID(), text: '' }] },
      ],
      typography: {
        fontFamily: 'Manrope',
        fontSize: 42,
        lineHeight: 1.2,
        letterSpacing: 0,
        horizontalAlign: 'left',
        verticalAlign: 'top',
      },
      type: 'richText',
    });
  } else if (tool === 'draw' || tool === 'laser') {
    const localPoints = points.map(([px, py]) =>
      worldToLocalPoint(currentDocument, parentFrameId, { x: px, y: py })
    );
    node = drawingNodeSchema.parse({
      ...common,
      type: 'drawing',
      tool: tool === 'laser' ? 'laser' : 'pen',
      points: localPoints.map(point => [point.x - x, point.y - y]),
    });
  } else {
    node = shapeNodeSchema.parse({
      ...common,
      type: 'shape',
      shape: tool === 'rectangle' ? (rounded ? 'rounded-rectangle' : 'rectangle') : tool,
      endArrowhead: tool === 'arrow' ? 'arrow' : 'none',
    });
  }
  transact(document => {
    document.nodes.push(node);
  });
  return id;
}
export function changeStudioCanvasText({
  id,
  content,
  transact,
}: {
  id: string;
  content: StudioPlateElement[];
  transact: Transact;
}) {
  transact(document => {
    const node = document.nodes.find(candidate => candidate.id === id);
    if (node?.type !== 'richText') return;
    node.content = content;
    node.name =
      content
        .map(block => block.children.map(child => ('text' in child ? child.text : '')).join(''))
        .join(' ')
        .slice(0, 80) || 'Text';
  });
}

export function formatStudioCanvasText({
  active,
  property,
  value,
  transact,
}: {
  active: StudioElement | undefined | null;
  property: string;
  value: unknown;
  transact: Transact;
}) {
  if (active?.type !== 'text') return;
  transact(document => {
    const node = document.nodes.find(candidate => candidate.id === active.id);
    if (node?.type === 'richText')
      formatStudioRichText(node, property as Parameters<typeof formatStudioRichText>[1], value);
  });
}
