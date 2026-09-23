import { exportToSvg, restoreElements, getCommonBounds } from '@excalidraw/excalidraw';
import type { CanvasScene } from '../../src/features/communication-studio/logic/canvas-schema';
import type { BinaryFiles } from '@excalidraw/excalidraw/types';
export { canvasLayers } from '../../src/features/communication-studio/logic/canvas-layers';

export async function renderNative(scene: CanvasScene) {
  const elements = restoreElements(scene.elements as never, null).filter(e => !e.isDeleted);
  if (!elements.length) return null;
  const [x, y, right, bottom] = getCommonBounds(elements);
  const svg = await exportToSvg({
    elements,
    files: scene.files as BinaryFiles,
    exportPadding: 0,
    appState: { exportBackground: false, exportWithDarkMode: false },
  });
  return { svg: svg.outerHTML, x, y, width: right - x, height: bottom - y };
}
