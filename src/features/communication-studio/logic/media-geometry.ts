import type { StudioElement } from './document';

type MediaGeometrySource = Pick<
  StudioElement,
  'width' | 'height' | 'fit' | 'cropX' | 'cropY' | 'crop' | 'flipX' | 'flipY'
>;

/** Position the full media behind the visible element viewport, including a native Excalidraw crop. */
export function mediaDrawGeometry(
  element: MediaGeometrySource,
  sourceWidth: number,
  sourceHeight: number
) {
  const crop = element.crop;
  const uncroppedWidth = crop ? (element.width * crop.naturalWidth) / crop.width : element.width;
  const uncroppedHeight = crop
    ? (element.height * crop.naturalHeight) / crop.height
    : element.height;
  const scale =
    element.fit === 'cover'
      ? Math.max(uncroppedWidth / sourceWidth, uncroppedHeight / sourceHeight)
      : Math.min(uncroppedWidth / sourceWidth, uncroppedHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  const cropX = crop ? (element.flipX ? crop.naturalWidth - crop.x - crop.width : crop.x) : 0;
  const cropY = crop ? (element.flipY ? crop.naturalHeight - crop.y - crop.height : crop.y) : 0;

  return {
    x:
      (uncroppedWidth - width) * element.cropX -
      (cropX / (crop?.naturalWidth ?? 1)) * uncroppedWidth,
    y:
      (uncroppedHeight - height) * element.cropY -
      (cropY / (crop?.naturalHeight ?? 1)) * uncroppedHeight,
    width,
    height,
  };
}
