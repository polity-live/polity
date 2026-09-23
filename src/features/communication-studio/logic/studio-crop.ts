import type { StudioMediaCrop } from './document';
import { mediaDrawGeometry } from './media-geometry';

export interface MediaCropFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
}

export interface MediaCropState {
  frame: MediaCropFrame;
  crop: StudioMediaCrop;
  fit: 'contain' | 'cover';
  focus: { x: number; y: number };
}

export type CropHandle =
  'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function studioMediaGeometry(
  state: Pick<MediaCropState, 'frame' | 'fit' | 'focus'> & { crop: StudioMediaCrop | null },
  sourceWidth: number,
  sourceHeight: number
) {
  return mediaDrawGeometry(
    {
      width: state.frame.width,
      height: state.frame.height,
      fit: state.fit,
      cropX: state.focus.x,
      cropY: state.focus.y,
      crop: state.crop,
      flipX: state.frame.flipX,
      flipY: state.frame.flipY,
    },
    sourceWidth,
    sourceHeight
  );
}

/** Initialize from the pixels already visible in the frame; opening crop has no visual jump. */
export function initialMediaCrop(
  frame: MediaCropFrame,
  fit: 'contain' | 'cover',
  focus: { x: number; y: number },
  existing: StudioMediaCrop | null,
  sourceWidth: number,
  sourceHeight: number
): MediaCropState {
  const naturalWidth = Math.max(1, sourceWidth);
  const naturalHeight = Math.max(1, sourceHeight);
  if (existing) {
    const widthRatio = naturalWidth / existing.naturalWidth;
    const heightRatio = naturalHeight / existing.naturalHeight;
    return {
      frame,
      fit,
      focus,
      crop: {
        x: existing.x * widthRatio,
        y: existing.y * heightRatio,
        width: existing.width * widthRatio,
        height: existing.height * heightRatio,
        naturalWidth,
        naturalHeight,
      },
    };
  }
  const placement = mediaDrawGeometry(
    {
      width: frame.width,
      height: frame.height,
      fit,
      cropX: focus.x,
      cropY: focus.y,
      crop: null,
      flipX: frame.flipX,
      flipY: frame.flipY,
    },
    naturalWidth,
    naturalHeight
  );
  const scaleX = placement.width / naturalWidth;
  const scaleY = placement.height / naturalHeight;
  const x = clamp(-placement.x / scaleX, 0, naturalWidth);
  const y = clamp(-placement.y / scaleY, 0, naturalHeight);
  const right = clamp((frame.width - placement.x) / scaleX, x, naturalWidth);
  const bottom = clamp((frame.height - placement.y) / scaleY, y, naturalHeight);
  return {
    frame,
    fit,
    focus,
    crop: {
      x: frame.flipX ? naturalWidth - right : x,
      y: frame.flipY ? naturalHeight - bottom : y,
      width: Math.max(0.01, right - x),
      height: Math.max(0.01, bottom - y),
      naturalWidth,
      naturalHeight,
    },
  };
}

export function panMediaCrop(state: MediaCropState, dx: number, dy: number): MediaCropState {
  const geometry = studioMediaGeometry(state, state.crop.naturalWidth, state.crop.naturalHeight);
  const x = clamp(
    state.crop.x + ((state.frame.flipX ? dx : -dx) * state.crop.naturalWidth) / geometry.width,
    0,
    state.crop.naturalWidth - state.crop.width
  );
  const y = clamp(
    state.crop.y + ((state.frame.flipY ? dy : -dy) * state.crop.naturalHeight) / geometry.height,
    0,
    state.crop.naturalHeight - state.crop.height
  );
  return { ...state, crop: { ...state.crop, x, y } };
}

export function zoomMediaCrop(state: MediaCropState, factor: number): MediaCropState {
  const { crop } = state;
  const bounded = clamp(factor, 0.05, 20);
  const width = clamp(crop.width / bounded, 0.01, crop.naturalWidth);
  const height = clamp(crop.height / bounded, 0.01, crop.naturalHeight);
  const centerX = crop.x + crop.width / 2;
  const centerY = crop.y + crop.height / 2;
  return {
    ...state,
    fit: 'cover',
    crop: {
      ...crop,
      x: clamp(centerX - width / 2, 0, crop.naturalWidth - width),
      y: clamp(centerY - height / 2, 0, crop.naturalHeight - height),
      width,
      height,
    },
  };
}

/** Resize the clip window and the source rectangle together, keeping source pixels at their scale. */
export function resizeMediaCrop(
  state: MediaCropState,
  handle: CropHandle,
  dx: number,
  dy: number
): MediaCropState {
  const { crop, frame } = state;
  const geometry = studioMediaGeometry(state, crop.naturalWidth, crop.naturalHeight);
  const pixelsPerX = crop.naturalWidth / geometry.width;
  const pixelsPerY = crop.naturalHeight / geometry.height;
  let left = 0,
    right = 0,
    top = 0,
    bottom = 0;
  const minWidth = Math.min(4, frame.width);
  const minHeight = Math.min(4, frame.height);
  const leftMargin = frame.flipX ? crop.naturalWidth - crop.x - crop.width : crop.x;
  const rightMargin = frame.flipX ? crop.x : crop.naturalWidth - crop.x - crop.width;
  const topMargin = frame.flipY ? crop.naturalHeight - crop.y - crop.height : crop.y;
  const bottomMargin = frame.flipY ? crop.y : crop.naturalHeight - crop.y - crop.height;
  if (handle.includes('left'))
    left = clamp(
      dx,
      -leftMargin / pixelsPerX,
      Math.min(frame.width - minWidth, (crop.width - 0.01) / pixelsPerX)
    );
  if (handle.includes('right'))
    right = clamp(
      dx,
      Math.max(minWidth - frame.width, -(crop.width - 0.01) / pixelsPerX),
      rightMargin / pixelsPerX
    );
  if (handle.includes('top'))
    top = clamp(
      dy,
      -topMargin / pixelsPerY,
      Math.min(frame.height - minHeight, (crop.height - 0.01) / pixelsPerY)
    );
  if (handle.includes('bottom'))
    bottom = clamp(
      dy,
      Math.max(minHeight - frame.height, -(crop.height - 0.01) / pixelsPerY),
      bottomMargin / pixelsPerY
    );
  // Local clip sides map to opposite source sides when a media node is flipped.
  const sourceLeft = frame.flipX ? -right * pixelsPerX : left * pixelsPerX;
  const sourceRight = frame.flipX ? -left * pixelsPerX : right * pixelsPerX;
  const sourceTop = frame.flipY ? -bottom * pixelsPerY : top * pixelsPerY;
  const sourceBottom = frame.flipY ? -top * pixelsPerY : bottom * pixelsPerY;
  const width = frame.width + right - left;
  const height = frame.height + bottom - top;
  const radians = (frame.rotation * Math.PI) / 180;
  const localCenterX = ((left + right) / 2) * (frame.flipX ? -1 : 1);
  const localCenterY = ((top + bottom) / 2) * (frame.flipY ? -1 : 1);
  const centerX =
    frame.x + frame.width / 2 + Math.cos(radians) * localCenterX - Math.sin(radians) * localCenterY;
  const centerY =
    frame.y +
    frame.height / 2 +
    Math.sin(radians) * localCenterX +
    Math.cos(radians) * localCenterY;
  return {
    ...state,
    frame: { ...frame, x: centerX - width / 2, y: centerY - height / 2, width, height },
    crop: {
      ...crop,
      x: crop.x + sourceLeft,
      y: crop.y + sourceTop,
      width: crop.width + sourceRight - sourceLeft,
      height: crop.height + sourceBottom - sourceTop,
    },
  };
}
