import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from '@excalidraw/excalidraw/element/types';
import type { StudioElement, StudioPage } from './document';
import { durableElements } from './canvas-schema';
import { polityProjection } from './canvas-adapter';

export function isNativeTemplateElement(e: StudioElement) {
  if (!e.visible) return false;
  if (e.animation !== 'none') return false;
  if (e.type === 'text')
    return (
      !e.richText.length &&
      !e.bold &&
      !e.italic &&
      !e.underline &&
      !e.strikethrough &&
      e.align !== 'justify' &&
      e.verticalAlign === 'top'
    );
  return ['rect', 'ellipse', 'line', 'arrow'].includes(e.type);
}

/** Stable IDs keep comments and element links valid. Complex sources stay editable
 * in Studio. SDK text uses SDK fonts; do not claim branded fonts are preserved. */
export function nativeTemplatePage(
  page: StudioPage,
  convert: (elements: ExcalidrawElementSkeleton[]) => readonly ExcalidrawElement[]
) {
  const sources = page.elements.filter(isNativeTemplateElement);
  if (!sources.length || page.canvas?.nativeTemplates) return page;
  const native = sources.map(e => {
    const common = {
      id: e.id,
      x: e.x,
      y: e.y,
      width: e.width,
      height: e.height,
      opacity: e.opacity * 100,
      locked: e.locked,
      roughness: 0,
      seed: Array.from(e.id).reduce(
        (hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) | 0,
        0
      ),
      groupIds: e.group ? [e.group] : [],
      customData: { polityOrder: e.order },
    };
    const [converted] = convert([
      e.type === 'text'
        ? {
            ...common,
            type: 'text',
            text: e.text,
            originalText: e.text,
            fontSize: e.fontSize,
            fontFamily: e.font === 'JetBrains Mono' ? 3 : 2,
            lineHeight: e.lineHeight as ExcalidrawTextElement['lineHeight'],
            textAlign: e.align as 'left' | 'center' | 'right',
            verticalAlign: 'top',
            strokeColor: e.fill,
            autoResize: false,
            height: e.text.split('\n').length * e.fontSize * e.lineHeight,
          }
        : e.type === 'line' || e.type === 'arrow'
          ? {
              ...common,
              type: e.type,
              strokeColor: e.strokeWidth ? e.stroke : e.fill,
              strokeWidth: Math.max(1, e.strokeWidth),
              points: [
                [0, 0],
                [e.width, e.height],
              ],
              endArrowhead: e.type === 'arrow' ? 'arrow' : null,
            }
          : {
              ...common,
              type: e.type === 'rect' ? 'rectangle' : 'ellipse',
              backgroundColor: e.fill,
              fillStyle: 'solid',
              strokeColor: e.strokeWidth ? e.stroke : 'transparent',
              strokeWidth: e.strokeWidth,
            },
    ]);
    return {
      ...converted,
      ...polityProjection({ ...e, width: converted.width, height: converted.height }),
    };
  });
  const ids = new Set(sources.map(e => e.id));
  return {
    ...page,
    elements: page.elements.filter(e => !ids.has(e.id)),
    canvas: {
      version: 1 as const,
      ...page.canvas,
      nativeTemplates: true,
      elements: [...(page.canvas?.elements ?? []), ...durableElements(native)],
      files: page.canvas?.files ?? {},
    },
  };
}
