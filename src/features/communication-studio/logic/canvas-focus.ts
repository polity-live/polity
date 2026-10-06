import type { StudioDocumentV3 } from './document-v3';
import { studioScenePaintOrder } from './studio-scene';
import { worldBounds, type Bounds } from './selection-geometry';

export function canvasFocusTarget(document: StudioDocumentV3, nodeId: string) {
  const node = studioScenePaintOrder(document).find(item => item.id === nodeId);
  if (!node) throw new Error('Canvas focus target unavailable');
  let root = node;
  const visited = new Set([node.id]);
  while (root.parentFrameId) {
    const parent = document.nodes.find(item => item.id === root.parentFrameId);
    if (!parent || visited.has(parent.id)) throw new Error('Canvas focus target unavailable');
    visited.add(parent.id);
    root = parent;
  }
  return {
    node,
    frameId: root.type === 'frame' ? root.id : undefined,
    bounds: worldBounds(document, node),
  };
}

/** A largest empty rectangle has its edges on the viewport or an obstacle edge. */
export function freeCanvasRectangle(viewport: Bounds, obstacles: readonly Bounds[]): Bounds | null {
  if (viewport.right <= viewport.left || viewport.bottom <= viewport.top) return null;
  const clipped = obstacles
    .map(rect => ({
      left: Math.max(viewport.left, rect.left),
      top: Math.max(viewport.top, rect.top),
      right: Math.min(viewport.right, rect.right),
      bottom: Math.min(viewport.bottom, rect.bottom),
    }))
    .filter(rect => rect.right > rect.left && rect.bottom > rect.top);
  const xs = [
    ...new Set([
      viewport.left,
      viewport.right,
      ...clipped.flatMap(rect => [rect.left, rect.right]),
    ]),
  ].sort((a, b) => a - b);
  const ys = [
    ...new Set([
      viewport.top,
      viewport.bottom,
      ...clipped.flatMap(rect => [rect.top, rect.bottom]),
    ]),
  ].sort((a, b) => a - b);
  let best: Bounds | null = null;
  let area = 0;
  for (let x = 0; x < xs.length - 1; x++)
    for (let right = x + 1; right < xs.length; right++) {
      for (let y = 0; y < ys.length - 1; y++)
        for (let bottom = y + 1; bottom < ys.length; bottom++) {
          const candidate = { left: xs[x], right: xs[right], top: ys[y], bottom: ys[bottom] };
          const nextArea = (candidate.right - candidate.left) * (candidate.bottom - candidate.top);
          if (
            nextArea <= area ||
            clipped.some(
              rect =>
                rect.left < candidate.right &&
                rect.right > candidate.left &&
                rect.top < candidate.bottom &&
                rect.bottom > candidate.top
            )
          )
            continue;
          best = candidate;
          area = nextArea;
        }
    }
  return best;
}
export function canvasFocusView(bounds: Bounds, free: Bounds, currentZoom: number) {
  const width = free.right - free.left - 64,
    height = free.bottom - free.top - 64;
  if (width <= 0 || height <= 0) throw new Error('No free canvas area');
  const zoom = Math.max(
    0.05,
    Math.min(
      currentZoom,
      4,
      width / Math.max(1, bounds.right - bounds.left),
      height / Math.max(1, bounds.bottom - bounds.top)
    )
  );
  return {
    zoom,
    pan: {
      x: (free.left + free.right - (bounds.left + bounds.right) * zoom) / 2,
      y: (free.top + free.bottom - (bounds.top + bounds.bottom) * zoom) / 2,
    },
  };
}
