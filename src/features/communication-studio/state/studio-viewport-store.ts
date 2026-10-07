import { create } from 'zustand';

export type StudioTool =
  | 'selection'
  | 'hand'
  | 'frame'
  | 'text'
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'line'
  | 'arrow'
  | 'draw'
  | 'eraser'
  | 'laser'
  | 'comment';

export interface StudioViewport {
  x: number;
  y: number;
  zoom: number;
}

interface StudioViewportState {
  projectId: string | null;
  activeTool: StudioTool;
  selectedNodeIds: string[];
  focusedFrameId: string | null;
  openedPanel: string | null;
  viewport: StudioViewport;
  gridVisible: boolean;
  snapping: boolean;
  guidesVisible: boolean;
  safeAreasVisible: boolean;
  minimapVisible: boolean;
  preview: boolean;
  resetProject: (projectId: string) => void;
  setTool: (tool: StudioTool) => void;
  setSelection: (selectedNodeIds: string[]) => void;
  setFocusedFrame: (focusedFrameId: string | null) => void;
  setPanel: (openedPanel: string | null) => void;
  setViewport: (viewport: StudioViewport) => void;
  setCanvasOption: (
    key:
      | 'gridVisible'
      | 'snapping'
      | 'guidesVisible'
      | 'safeAreasVisible'
      | 'minimapVisible'
      | 'preview',
    value: boolean
  ) => void;
}

const defaults = {
  activeTool: 'selection' as const,
  selectedNodeIds: [] as string[],
  focusedFrameId: null as string | null,
  openedPanel: null as string | null,
  viewport: { x: 0, y: 0, zoom: 1 },
  gridVisible: true,
  snapping: true,
  guidesVisible: true,
  safeAreasVisible: true,
  minimapVisible: false,
  preview: false,
};

export const useStudioViewportStore = create<StudioViewportState>(set => ({
  projectId: null,
  ...defaults,
  resetProject: projectId =>
    set(state => (state.projectId === projectId ? state : { projectId, ...defaults })),
  setTool: activeTool => set({ activeTool }),
  setSelection: selectedNodeIds => set({ selectedNodeIds }),
  setFocusedFrame: focusedFrameId => set({ focusedFrameId }),
  setPanel: openedPanel => set({ openedPanel }),
  setViewport: viewport => set({ viewport }),
  setCanvasOption: (key, value) => set({ [key]: value }),
}));
