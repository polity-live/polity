import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { durableElements, type CanvasScene } from './canvas-schema';
import { stableJson } from './operations';
import type { StudioPage, StudioElement } from './document';
import { canvasLayers } from './canvas-layers';

export function orderedScene(page: StudioPage, projections: readonly ExcalidrawElement[]) {
  const native = sceneElements(page.canvas);
  return canvasLayers(page).flatMap(layer =>
    layer.kind === 'native'
      ? layer.elements.flatMap(e => native.filter(n => n.id === e.id))
      : projections.filter(e => e.id === layer.element.id)
  );
}

export function captureCanvasOrder(page: StudioPage, elements: readonly ExcalidrawElement[]) {
  const previous = canvasLayers(page).flatMap(l =>
    l.kind === 'native' ? l.elements.map(e => e.id) : [l.element.id]
  );
  const visible = elements.filter(e => !e.isDeleted);
  const existing = new Set(previous);
  const present = new Set(visible.map(e => e.id));
  const reordered =
    stableJson(previous.filter(id => present.has(id))) !==
    stableJson(visible.filter(e => existing.has(e.id)).map(e => e.id));
  const oldOrders = new Map<string, number>([
    ...page.elements.map(e => [e.id, e.order] as const),
    ...(page.canvas?.elements ?? []).map(
      (e, i) =>
        [
          e.id,
          Number(
            (e.customData as { polityOrder?: number } | undefined)?.polityOrder ??
              i - (page.canvas?.elements.length ?? 0)
          ),
        ] as const
    ),
  ]);
  let maximum = Math.max(-1, ...oldOrders.values());
  const orders = new Map(
    visible.map((e, i) => [e.id, reordered ? i : (oldOrders.get(e.id) ?? ++maximum)])
  );
  return {
    orders,
    elements: elements.map(e =>
      e.customData?.polityElement
        ? e
        : {
            ...e,
            customData: {
              ...e.customData,
              polityOrder: orders.get(e.id) ?? oldOrders.get(e.id) ?? 0,
            },
          }
    ) as ExcalidrawElement[],
  };
}

export function identifyDuplicatedProjections(
  next: readonly ExcalidrawElement[],
  previous: readonly ExcalidrawElement[]
): ExcalidrawElement[] {
  const existing = new Set(previous.map(e => e.id));
  const replacements = new Map(
    next
      .filter(
        e =>
          !existing.has(e.id) &&
          e.customData?.polityElement &&
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(e.id)
      )
      .map(e => [e.id, crypto.randomUUID()])
  );
  const id = (value: string) => replacements.get(value) ?? value;
  return next.map(e => ({
    ...e,
    id: id(e.id),
    frameId: e.frameId ? id(e.frameId) : null,
    boundElements: e.boundElements?.map(b => ({ ...b, id: id(b.id) })) ?? null,
    ...('containerId' in e ? { containerId: e.containerId ? id(e.containerId) : null } : {}),
    ...('startBinding' in e
      ? {
          startBinding: e.startBinding
            ? { ...e.startBinding, elementId: id(e.startBinding.elementId) }
            : null,
          endBinding: e.endBinding
            ? { ...e.endBinding, elementId: id(e.endBinding.elementId) }
            : null,
        }
      : {}),
  })) as ExcalidrawElement[];
}

/** Studio rotates about the top left, Excalidraw about the element centre. */
export function polityProjection(e: StudioElement) {
  const angle = (e.rotation * Math.PI) / 180;
  return {
    x: e.x + ((Math.cos(angle) - 1) * e.width) / 2 - (Math.sin(angle) * e.height) / 2,
    y: e.y + (Math.sin(angle) * e.width) / 2 + ((Math.cos(angle) - 1) * e.height) / 2,
    angle,
    scale: [e.flipX ? -1 : 1, e.flipY ? -1 : 1] as [1 | -1, 1 | -1],
  };
}

function projectionGeometry(shown: ExcalidrawElement, source?: StudioElement) {
  return {
    x:
      shown.x -
      ((Math.cos(shown.angle) - 1) * shown.width) / 2 +
      (Math.sin(shown.angle) * shown.height) / 2,
    y:
      shown.y -
      (Math.sin(shown.angle) * shown.width) / 2 -
      ((Math.cos(shown.angle) - 1) * shown.height) / 2,
    width: Math.max(4, shown.width),
    height: Math.max(4, shown.height),
    rotation: (shown.angle * 180) / Math.PI,
    flipX: 'scale' in shown && Array.isArray(shown.scale) ? shown.scale[0] < 0 : false,
    flipY: 'scale' in shown && Array.isArray(shown.scale) ? shown.scale[1] < 0 : false,
    opacity: shown.opacity / 100,
    locked: shown.locked,
    group: shown.groupIds.at(-1) ?? null,
    ...(source && (source.type === 'image' || source.type === 'video')
      ? { crop: shown.type === 'image' ? structuredClone(shown.crop) : source.crop }
      : {}),
  };
}

/** SDK duplication retains customData. Clone the structured source, never its bitmap. */
export function duplicatedPolityElements(
  page: StudioPage,
  elements: readonly ExcalidrawElement[],
  sources = page.elements
) {
  return elements.flatMap(shown => {
    if (shown.isDeleted || page.elements.some(e => e.id === shown.id)) return [];
    const original = sources.find(e => e.id === shown.customData?.polityElement);
    return original
      ? [{ ...structuredClone(original), id: shown.id, ...projectionGeometry(shown, original) }]
      : [];
  });
}

export function sceneElements(scene: CanvasScene | undefined): ExcalidrawElement[] {
  return (scene?.elements ?? []).map(e => ({
    ...e,
    version: 1,
    versionNonce: 0,
    updated: 0,
  })) as unknown as ExcalidrawElement[];
}

export function nativeSceneChanged(
  scene: CanvasScene | undefined,
  elements: readonly ExcalidrawElement[]
) {
  // SDK fractional indices are repaired after a remote insertion. Polity's own
  // stable layer order is content; these local repairs must not create undo steps.
  const byId = (records: readonly Record<string, unknown>[]) =>
    durableElements(records).sort((a, b) => a.id.localeCompare(b.id));
  return stableJson(byId(scene?.elements ?? [])) !== stableJson(byId(elements));
}

/** Read only content changes; regenerated display records are not writable data. */
export function readPolityGeometry(page: StudioPage, elements: readonly ExcalidrawElement[]) {
  return page.elements.flatMap(original => {
    const shown = elements.find(e => e.id === original.id && !e.isDeleted);
    if (!shown) return [];
    const patch = projectionGeometry(shown, original);
    return Object.entries(patch).some(([k, v]) =>
      typeof v === 'number'
        ? Math.abs(Number(original[k as keyof typeof original]) - v) > 0.001
        : original[k as keyof typeof original] !== v
    )
      ? [{ id: original.id, patch }]
      : [];
  });
}
