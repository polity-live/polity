import type Konva from 'konva';
import type { CropHandle, MediaCropState } from './studio-crop';
import { panMediaCrop, resizeMediaCrop } from './studio-crop';
export interface CanvasCropDraft {
  nodeId: string;
  state: MediaCropState;
  zoom: number;
}

export interface CanvasCropGesture {
  nodeId: string;
  kind: 'pan' | CropHandle;
  start: { x: number; y: number };
  inverse: Konva.Transform;
  initial: MediaCropState;
}

export function createStudioCropGesture({
  draft: cropDraft,
  stage: stageNode,
  nodeId,
  kind,
  clientX,
  clientY,
  zoom,
  insideFrameOnly = false,
}: {
  draft: CanvasCropDraft | null;
  stage: Konva.Stage | null;
  nodeId: string;
  kind: 'pan' | CropHandle;
  clientX: number;
  clientY: number;
  zoom: number;
  insideFrameOnly?: boolean;
}): CanvasCropGesture | null {
  if (!cropDraft || cropDraft.nodeId !== nodeId) return null;
  const group = stageNode?.findOne(`#${nodeId}`);
  if (!stageNode || !group) return null;
  const bounds = stageNode.container().getBoundingClientRect();
  const point = {
    x: ((clientX - bounds.left) * stageNode.width()) / bounds.width,
    y: ((clientY - bounds.top) * stageNode.height()) / bounds.height,
  };
  const inverse = group.getAbsoluteTransform().copy().invert();
  const local = inverse.point(point);
  if (
    insideFrameOnly &&
    (local.x < -5 ||
      local.x > cropDraft.state.frame.width + 5 ||
      local.y < -5 ||
      local.y > cropDraft.state.frame.height + 5)
  )
    return null;
  let resolvedKind = kind;
  if (kind === 'pan') {
    const threshold = Math.max(5, 12 / zoom);
    const horizontal =
      local.x <= threshold
        ? 'left'
        : local.x >= cropDraft.state.frame.width - threshold
          ? 'right'
          : '';
    const vertical =
      local.y <= threshold
        ? 'top'
        : local.y >= cropDraft.state.frame.height - threshold
          ? 'bottom'
          : '';
    resolvedKind =
      horizontal && vertical
        ? (`${vertical}-${horizontal}` as CropHandle)
        : ((horizontal || vertical || 'pan') as CropHandle | 'pan');
  }
  return {
    nodeId,
    kind: resolvedKind,
    start: local,
    inverse,
    initial: cropDraft.state,
  };
}

export function updateStudioCropGesture({
  draft,
  gesture,
  stage,
  clientX,
  clientY,
}: {
  draft: CanvasCropDraft | null;
  gesture: CanvasCropGesture;
  stage: Konva.Stage;
  clientX: number;
  clientY: number;
}): CanvasCropDraft | null {
  if (draft?.nodeId !== gesture.nodeId) return draft;
  const bounds = stage.container().getBoundingClientRect();
  const local = gesture.inverse.point({
    x: ((clientX - bounds.left) * stage.width()) / bounds.width,
    y: ((clientY - bounds.top) * stage.height()) / bounds.height,
  });
  const dx = local.x - gesture.start.x;
  const dy = local.y - gesture.start.y;
  const state =
    gesture.kind === 'pan'
      ? panMediaCrop(gesture.initial, dx, dy)
      : resizeMediaCrop(gesture.initial, gesture.kind, dx, dy);
  return { ...draft, state };
}
