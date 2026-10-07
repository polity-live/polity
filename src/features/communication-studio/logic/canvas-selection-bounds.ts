import type Konva from 'konva';
import type { Bounds } from './selection-geometry';

/** Resolve only mounted, finite SDK geometry into viewport coordinates. */
export function studioCanvasSelectionBounds(
  stage: Konva.Stage | null,
  selected: readonly string[],
  zoom: number,
  pan: { x: number; y: number }
): Bounds | null {
  if (!stage) return null;
  const rectangles = selected.flatMap(id => {
    const rendered = stage.findOne(`#${id}`);
    if (!rendered) return [];
    const rect = rendered.getClientRect({ relativeTo: stage, skipStroke: true });
    return Number.isFinite(rect.x) && Number.isFinite(rect.y) ? [rect] : [];
  });
  if (!rectangles.length) return null;
  return {
    left: Math.min(...rectangles.map(rect => rect.x)) * zoom + pan.x,
    top: Math.min(...rectangles.map(rect => rect.y)) * zoom + pan.y,
    right: Math.max(...rectangles.map(rect => rect.x + rect.width)) * zoom + pan.x,
    bottom: Math.max(...rectangles.map(rect => rect.y + rect.height)) * zoom + pan.y,
  };
}
