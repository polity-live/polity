import type { StudioPage } from './document';
import type { CanvasScene } from './canvas-schema';

export type CanvasLayer =
  | { kind: 'native'; elements: CanvasScene['elements'] }
  | { kind: 'polity'; element: StudioPage['elements'][number] };

/** Shared by the editor, playback and export worker. Adjacent native records stay
 * together so arrow labels and frame clipping retain their scene context. */
export function canvasLayers(page: StudioPage): CanvasLayer[] {
  const native = page.canvas?.elements ?? [];
  const items = [
    ...native
      .filter(e => !e.isDeleted)
      .map((element, i) => ({
        kind: 'native' as const,
        element,
        order: Number(
          (element.customData as { polityOrder?: number } | undefined)?.polityOrder ??
            i - native.length
        ),
      })),
    ...page.elements
      .filter(element => element.visible !== false)
      .map(element => ({ kind: 'polity' as const, element, order: element.order })),
  ].sort((a, b) => a.order - b.order || a.element.id.localeCompare(b.element.id));
  const layers: CanvasLayer[] = [];
  for (const item of items) {
    if (item.kind === 'polity') layers.push({ kind: 'polity', element: item.element });
    else {
      const previous = layers.at(-1);
      if (previous?.kind === 'native') previous.elements.push(item.element);
      else layers.push({ kind: 'native', elements: [item.element] });
    }
  }
  return layers;
}
