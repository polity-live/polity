import { drawStudioElement } from './draw-element';
import { mediaDrawGeometry } from './media-geometry';
// This pure Canvas renderer is serialized into the isolated export browser.
// Text is drawn as text; project content is never interpreted as HTML or code.
export async function paintStudioPage(
  page: any,
  media: Record<string, string>,
  time = 0,
  animateScene = false
) {
  const w = page.format === 'widescreen' ? 1920 : page.format === 'standard' ? 1440 : 1080,
    h =
      page.format === 'story'
        ? 1920
        : page.format === 'square' || ['widescreen', 'standard'].includes(page.format)
          ? 1080
          : 1350;
  let canvas = document.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
  }
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const cache = ((window as any).__studioMedia ??= {} as Record<
    string,
    HTMLImageElement | HTMLVideoElement
  >);
  ctx.fillStyle = page.background;
  ctx.fillRect(0, 0, w, h);
  const renderer = (window as any).PolityCanvasRenderer;
  if (page.canvas?.elements?.some((e: any) => !e.isDeleted) && !renderer)
    throw new Error('Excalidraw export renderer is unavailable');
  const layers = renderer
    ? renderer.canvasLayers(page)
    : [...page.elements]
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
        .map(element => ({ kind: 'polity', element }));
  await document.fonts.ready;
  for (const layer of layers) {
    if (layer.kind === 'native') {
      const native = await renderer.renderNative({ ...page.canvas, elements: layer.elements });
      if (native) {
        const image = new Image();
        image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(native.svg);
        await image.decode();
        ctx.drawImage(image, native.x, native.y, native.width, native.height);
      }
      continue;
    }
    const e = layer.element;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate((e.rotation * Math.PI) / 180);
    ctx.globalAlpha =
      e.opacity * (e.animation === 'fade' ? Math.min(1, Math.max(0, time / 0.4)) : 1);
    ctx.fillStyle = e.fill;
    if (!['image', 'video'].includes(e.type))
      ((window as any).drawStudioElement ?? drawStudioElement)(ctx, e);
    else if (e.assetId && media[e.assetId]) {
      ctx.translate(e.flipX ? e.width : 0, e.flipY ? e.height : 0);
      ctx.scale(e.flipX ? -1 : 1, e.flipY ? -1 : 1);
      let image = cache[e.assetId];
      if (!image) {
        image = e.type === 'video' ? document.createElement('video') : new Image();
        cache[e.assetId] = image;
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Media load timeout')), 30_000);
          const done = () => {
            clearTimeout(timer);
            resolve();
          };
          image.onerror = () => {
            clearTimeout(timer);
            reject(new Error('Media could not be decoded'));
          };
          if (image instanceof HTMLVideoElement) {
            image.muted = true;
            image.preload = 'auto';
            image.onloadeddata = done;
          } else image.onload = done;
          (image as HTMLImageElement).src = media[e.assetId];
        });
      }
      if (image instanceof HTMLVideoElement) {
        const target = Math.min(e.trimStart + time, Math.max(0, image.duration - 0.05));
        if (Math.abs(image.currentTime - target) > 0.005)
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Video seek timeout')), 10000);
            image.onseeked = () => {
              clearTimeout(timer);
              resolve();
            };
            image.currentTime = target;
          });
      }
      const iw = image instanceof HTMLVideoElement ? image.videoWidth : image.naturalWidth,
        ih = image instanceof HTMLVideoElement ? image.videoHeight : image.naturalHeight;
      const placement = mediaDrawGeometry(e, iw, ih);
      ctx.beginPath();
      ctx.rect(0, 0, e.width, e.height);
      ctx.clip();
      ctx.drawImage(image, placement.x, placement.y, placement.width, placement.height);
    }
    ctx.restore();
  }
  if (animateScene && page.transition === 'fade') {
    ctx.fillStyle = '#000000';
    ctx.globalAlpha =
      1 - Math.min(1, Math.max(0, time / 0.3), Math.max(0, (page.duration - time) / 0.3));
    ctx.fillRect(0, 0, w, h);
  }
  return canvas.toDataURL('image/png');
}
