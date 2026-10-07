import type Konva from 'konva';
import type { StudioDocumentV3 } from './document-v3';
import { worldMatrix } from './selection-geometry';
import type { StudioCanvasNodeChange } from '../ui/KonvaStudioCanvas';

export function restoreStudioCanvasTransforms(document: StudioDocumentV3, items: Konva.Node[]) {
  for (const item of items) {
    const source = document.nodes.find(node => node.id === item.id());
    if (!source) continue;
    item.position({
      x: source.transform.x + source.transform.width / 2,
      y: source.transform.y + source.transform.height / 2,
    });
    item.rotation(source.transform.rotation);
    item.scale({
      x: source.transform.flipX ? -1 : 1,
      y: source.transform.flipY ? -1 : 1,
    });
    item.getLayer()?.batchDraw();
  }
}

export function collectStudioCanvasTransforms(
  document: StudioDocumentV3,
  items: Konva.Node[]
): StudioCanvasNodeChange[] {
  return items.flatMap(item => {
    const source = document.nodes.find(node => node.id === item.id());
    if (!source) return [];
    const parent = document.nodes.find(node => node.id === source.parentFrameId);
    const [a, b, c, d] = parent ? worldMatrix(document, parent) : [1, 0, 0, 1, 0, 0];
    const width = Math.max(1, source.transform.width * Math.abs(item.scaleX()));
    const height = Math.max(1, source.transform.height * Math.abs(item.scaleY()));
    // Konva positions groups by their center; the document stores top-left coordinates.
    const localDx = item.x() - width / 2 - source.transform.x;
    const localDy = item.y() - height / 2 - source.transform.y;
    const flipX = item.scaleX() < 0;
    const flipY = item.scaleY() < 0;
    item.scaleX(flipX ? -1 : 1);
    item.scaleY(flipY ? -1 : 1);
    return [
      {
        nodeId: source.id,
        transform: {
          dx: a * localDx + c * localDy,
          dy: b * localDx + d * localDy,
          width,
          height,
          rotation: item.rotation(),
          flipX,
          flipY,
        },
      },
    ];
  });
}
