import type Konva from 'konva';
import type { StudioDocumentV3 } from './document-v3';
import { isDescendantOf, worldMatrix } from './selection-geometry';
export interface CanvasDragPreview {
  driverId: string;
  selectedIds: string[];
  roots: string[];
  origins: Map<string, { x: number; y: number }>;
  disabledFollowers: Map<string, boolean>;
  startClientX: number;
  startClientY: number;
  initialDelta: { x: number; y: number };
  delta: { x: number; y: number };
}

interface DragOptions {
  document: StudioDocumentV3;
  selected: string[];
  stage: Konva.Stage | null;
  driverId: string;
  clientX: number;
  clientY: number;
}
export function createStudioDragPreview({
  document,
  selected,
  stage,
  driverId,
  clientX,
  clientY,
}: DragOptions): CanvasDragPreview {
  const selectedIds = selected.includes(driverId) ? selected : [driverId];
  const editableIds = selectedIds.filter(id => {
    const node = document.nodes.find(candidate => candidate.id === id);
    return node && !node.locked;
  });
  const roots = editableIds.filter(id => {
    const node = document.nodes.find(candidate => candidate.id === id);
    return (
      node &&
      !editableIds.some(parentId => {
        const parent = document.nodes.find(candidate => candidate.id === parentId);
        return parent?.type === 'frame' && isDescendantOf(document, node, parentId);
      })
    );
  });
  const origins = new Map(
    [...new Set([...roots, driverId])].flatMap(id => {
      const node = document.nodes.find(candidate => candidate.id === id);
      return node
        ? [
            [
              id,
              {
                x: node.transform.x + node.transform.width / 2,
                y: node.transform.y + node.transform.height / 2,
              },
            ] as const,
          ]
        : [];
    })
  );
  const driver = document.nodes.find(candidate => candidate.id === driverId);
  const rendered = stage?.findOne(`#${driverId}`);
  const origin = origins.get(driverId);
  const parent = driver?.parentFrameId
    ? document.nodes.find(candidate => candidate.id === driver.parentFrameId)
    : null;
  const [a, b, c, d] = parent ? worldMatrix(document, parent) : [1, 0, 0, 1, 0, 0];
  const localX = rendered && origin ? rendered.x() - origin.x : 0;
  const localY = rendered && origin ? rendered.y() - origin.y : 0;
  const disabledFollowers = new Map<string, boolean>();
  for (const id of roots) {
    if (id === driverId) continue;
    const follower = stage?.findOne(`#${id}`);
    if (!follower) continue;
    disabledFollowers.set(id, follower.draggable());
    follower.draggable(false);
  }
  return {
    driverId,
    selectedIds,
    roots,
    origins,
    disabledFollowers,
    startClientX: clientX,
    startClientY: clientY,
    initialDelta: { x: a * localX + c * localY, y: b * localX + d * localY },
    delta: { x: 0, y: 0 },
  };
}

export function updateStudioDragPreview({
  preview,
  zoom,
  ...options
}: DragOptions & { preview: CanvasDragPreview | null; zoom: number }): CanvasDragPreview {
  const { document, stage, driverId, clientX, clientY } = options;
  if (preview?.driverId !== driverId) preview = createStudioDragPreview(options);
  const delta = {
    x: preview.initialDelta.x + (clientX - preview.startClientX) / zoom,
    y: preview.initialDelta.y + (clientY - preview.startClientY) / zoom,
  };
  preview.delta = delta;
  for (const id of preview.roots) {
    if (id === driverId) continue;
    const node = document.nodes.find(candidate => candidate.id === id);
    const rendered = stage?.findOne(`#${id}`);
    const origin = preview.origins.get(id);
    if (!node || !rendered || !origin) continue;
    const parent = node.parentFrameId
      ? document.nodes.find(candidate => candidate.id === node.parentFrameId)
      : null;
    const [a, b, c, d] = parent ? worldMatrix(document, parent) : [1, 0, 0, 1, 0, 0];
    const determinant = a * d - b * c;
    // The canonical parent basis contains rotations and reflections, so its determinant is ±1.
    rendered.position({
      x: origin.x + (d * delta.x - c * delta.y) / determinant,
      y: origin.y + (-b * delta.x + a * delta.y) / determinant,
    });
    rendered.getLayer()?.batchDraw();
  }
  if (!preview.roots.includes(driverId)) {
    const driver = stage?.findOne(`#${driverId}`);
    const origin = preview.origins.get(driverId);
    if (driver && origin) driver.position(origin);
  }
  return preview;
}

export function clearStudioDragPreview(
  stage: Konva.Stage | null,
  preview: CanvasDragPreview | null
) {
  if (!preview) return;
  for (const [id, draggable] of preview.disabledFollowers) {
    stage?.findOne(`#${id}`)?.draggable(draggable);
  }
  for (const [id, origin] of preview.origins) {
    const rendered = stage?.findOne(`#${id}`);
    rendered?.position(origin);
    rendered?.getLayer()?.draw();
  }
}
