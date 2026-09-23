import { element, elementSchema, type StudioPage } from './document';
import type { CanvasScene } from './canvas-schema';

type NativeElement = CanvasScene['elements'][number];
export function canFormatNativeText(e: NativeElement | undefined) {
  return (
    e?.type === 'text' &&
    !e.isDeleted &&
    !e.locked &&
    !e.containerId &&
    !e.frameId &&
    !(Array.isArray(e.boundElements) && e.boundElements.length) &&
    !(Array.isArray(e.groupIds) && e.groupIds.length) &&
    !e.link
  );
}

/** Explicit rich-text conversion is one undoable page operation; SDK source remains
 * in the previous revision. Never silently detach container/arrow/frame bindings. */
export function formatNativeText(
  page: StudioPage,
  id: string,
  style: 'bold' | 'italic' | 'underline'
) {
  const canvas = page.canvas;
  const e = canvas?.elements.find(e => e.id === id);
  if (!canvas || !e || !canFormatNativeText(e)) throw new Error('Select an unbound text element');
  const font = e.fontFamily === 3 ? 'JetBrains Mono' : 'Manrope';
  const text = elementSchema.parse(
    element('text', {
      ...(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(e.id)
        ? { id: e.id }
        : {}),
      x: e.x - ((Math.cos(e.angle) - 1) * e.width) / 2 + (Math.sin(e.angle) * e.height) / 2,
      y: e.y - (Math.sin(e.angle) * e.width) / 2 - ((Math.cos(e.angle) - 1) * e.height) / 2,
      width: Math.max(4, e.width),
      height: Math.max(4, e.height),
      rotation: (e.angle * 180) / Math.PI,
      opacity: Number(e.opacity ?? 100) / 100,
      order: Number(
        (e.customData as { polityOrder?: number } | undefined)?.polityOrder ??
          canvas.elements.indexOf(e) - canvas.elements.length
      ),
      text: String(e.text ?? ''),
      font,
      fontSize: Number(e.fontSize ?? 20),
      lineHeight: Number(e.lineHeight ?? 1.2),
      align: e.textAlign === 'center' || e.textAlign === 'right' ? e.textAlign : 'left',
      fill: String(e.strokeColor ?? '#12362D'),
      [style]: true,
    })
  );
  return {
    text,
    page: {
      ...page,
      elements: [...page.elements, text],
      canvas: {
        ...canvas,
        elements: canvas.elements.filter(v => v.id !== id),
      },
    },
  };
}
