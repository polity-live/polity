import { describe, expect, it, vi } from 'vitest';
import { useStudioViewportStore } from '../studio-viewport-store';
describe('Studio viewport project state', () => {
  it('updates tools, selection, frame, panel, viewport and each canvas option', () => {
    const state = useStudioViewportStore.getState();
    state.resetProject('viewport-first');
    const selected = [crypto.randomUUID()],
      frameId = crypto.randomUUID();
    state.setTool('draw');
    state.setSelection(selected);
    state.setFocusedFrame(frameId);
    state.setPanel('layers');
    state.setViewport({ x: -25, y: 80, zoom: 2 });
    for (const key of [
      'gridVisible',
      'snapping',
      'guidesVisible',
      'safeAreasVisible',
      'minimapVisible',
      'preview',
    ] as const) {
      state.setCanvasOption(key, !useStudioViewportStore.getState()[key]);
    }
    expect(useStudioViewportStore.getState()).toMatchObject({
      projectId: 'viewport-first',
      activeTool: 'draw',
      selectedNodeIds: selected,
      focusedFrameId: frameId,
      openedPanel: 'layers',
      viewport: { x: -25, y: 80, zoom: 2 },
      gridVisible: false,
      snapping: false,
      guidesVisible: false,
      safeAreasVisible: false,
      minimapVisible: true,
      preview: true,
    });
    const listener = vi.fn();
    const unsubscribe = useStudioViewportStore.subscribe(listener);
    state.resetProject('viewport-first');
    expect(listener).not.toHaveBeenCalled();
    state.resetProject('viewport-second');
    expect(listener).toHaveBeenCalledOnce();
    expect(useStudioViewportStore.getState()).toMatchObject({
      projectId: 'viewport-second',
      activeTool: 'selection',
      selectedNodeIds: [],
      focusedFrameId: null,
      openedPanel: null,
      viewport: { x: 0, y: 0, zoom: 1 },
      gridVisible: true,
      snapping: true,
      guidesVisible: true,
      safeAreasVisible: true,
      minimapVisible: false,
      preview: false,
    });
    unsubscribe();
  });
});
