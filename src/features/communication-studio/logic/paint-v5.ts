import type { StudioDocumentV3, StudioNode } from './document-v3';
import { studioSceneChildren } from './studio-scene';
import { paintStudioRichText } from './rich-text-paint';
import { drawStudioElement } from './draw-element';
import { semanticElement } from './v3-adapter';
import { studioMediaGeometry } from './studio-crop';
import type { StudioElement } from './document';

function pathForShape(ctx: CanvasRenderingContext2D, node: Extract<StudioNode, { type: 'shape' }>) {
  const { width, height } = node.transform;
  ctx.beginPath();
  if (node.shape === 'ellipse')
    ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  else if (node.shape === 'diamond') {
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width, height / 2);
    ctx.lineTo(width / 2, height);
    ctx.lineTo(0, height / 2);
    ctx.closePath();
  } else if (node.shape === 'line' || node.shape === 'arrow') {
    ctx.moveTo(0, 0);
    ctx.lineTo(width, height);
    if (node.shape === 'arrow') {
      const angle = Math.atan2(height, width);
      const size = 18;
      ctx.moveTo(width - size * Math.cos(angle - 0.5), height - size * Math.sin(angle - 0.5));
      ctx.lineTo(width, height);
      ctx.lineTo(width - size * Math.cos(angle + 0.5), height - size * Math.sin(angle + 0.5));
    }
  } else {
    ctx.roundRect(
      0,
      0,
      width,
      height,
      node.shape === 'rounded-rectangle'
        ? Math.max(12, node.style.cornerRadius)
        : node.style.cornerRadius
    );
  }
}

async function mediaSource(source: string, video: boolean, time: number, trimStart: number) {
  if (video) {
    const element = document.createElement('video');
    element.muted = true;
    element.preload = 'auto';
    element.src = source;
    await new Promise<void>((resolve, reject) => {
      element.onloadeddata = () => resolve();
      element.onerror = () => reject(new Error('Video could not be decoded'));
    });
    const target = Math.min(trimStart + time, Math.max(0, element.duration - 0.05));
    if (target > 0)
      await new Promise<void>(resolve => {
        element.onseeked = () => resolve();
        element.currentTime = target;
      });
    return element;
  }
  const image = new Image();
  image.src = source;
  await image.decode();
  return image;
}

async function paintNode(
  ctx: CanvasRenderingContext2D,
  documentValue: StudioDocumentV3,
  node: StudioNode,
  media: Record<string, string>,
  time: number
): Promise<void> {
  const { x, y, width, height, rotation, flipX, flipY } = node.transform;
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.translate(-width / 2, -height / 2);
  ctx.globalAlpha *= node.style.opacity;
  ctx.fillStyle = node.style.fill ?? '#12362D';
  ctx.strokeStyle = node.style.stroke ?? '#12362D';
  ctx.lineWidth = node.style.strokeWidth;
  ctx.setLineDash(
    node.style.strokeStyle === 'dashed'
      ? [10, 7]
      : node.style.strokeStyle === 'dotted'
        ? [2, 5]
        : []
  );

  if (node.type === 'frame') {
    ctx.fillStyle =
      node.style.fill ??
      documentValue.frameDefaults.background ??
      documentValue.theme[documentValue.theme.mode].background;
    ctx.fillRect(0, 0, width, height);
    if (node.style.stroke && node.style.strokeWidth) ctx.strokeRect(0, 0, width, height);
    if (node.clipContent) {
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.clip();
    }
    for (const child of studioSceneChildren(documentValue, node.id))
      await paintNode(ctx, documentValue, child, media, time);
  } else if (node.type === 'richText') {
    paintStudioRichText(ctx, node);
  } else if (node.type === 'shape') {
    pathForShape(ctx, node);
    if (node.shape !== 'line' && node.shape !== 'arrow' && node.style.fill) ctx.fill();
    if (node.style.strokeWidth || node.shape === 'line' || node.shape === 'arrow') ctx.stroke();
  } else if (node.type === 'drawing') {
    ctx.beginPath();
    node.points.forEach(([px, py], index) => (index ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, node.style.strokeWidth);
    ctx.stroke();
  } else if (node.type === 'media' && media[node.assetId]) {
    const source = await mediaSource(
      media[node.assetId],
      node.mediaType === 'video',
      time,
      node.trim.start
    );
    const naturalWidth = Math.max(
      1,
      source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth
    );
    const naturalHeight = Math.max(
      1,
      source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight
    );
    const placement = studioMediaGeometry(
      { frame: node.transform, fit: node.fit, focus: node.focus, crop: node.crop },
      naturalWidth,
      naturalHeight
    );
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();
    ctx.drawImage(source, placement.x, placement.y, placement.width, placement.height);
  } else if (node.type === 'table' || node.type === 'chart') {
    const element = semanticElement(node) as StudioElement;
    drawStudioElement(ctx, { ...element, x: 0, y: 0, rotation: 0, opacity: 1 });
  } else if (node.type === 'embed') {
    ctx.fillStyle = node.style.fill ?? '#EEEEEE';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

/** Export a V5 frame using the same sibling order and text painter as the live Konva scene. */
export async function paintStudioDocumentFrame(
  documentValue: StudioDocumentV3,
  frameId: string,
  media: Record<string, string>,
  time = 0
): Promise<string> {
  const frame = documentValue.nodes.find(node => node.id === frameId && node.type === 'frame');
  if (!frame || frame.type !== 'frame') throw new Error('Studio frame not found');
  let canvas = document.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
  }
  canvas.width = frame.transform.width;
  canvas.height = frame.transform.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle =
    frame.style.fill ??
    documentValue.frameDefaults.background ??
    documentValue.theme[documentValue.theme.mode].background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await document.fonts.ready;
  const master = documentValue.masterLayout.frameId
    ? documentValue.nodes.find(
        node => node.id === documentValue.masterLayout.frameId && node.type === 'frame'
      )
    : null;
  const masterChildren =
    master?.type === 'frame' ? studioSceneChildren(documentValue, master.id) : [];
  const paintMaster = async (placement: 'background' | 'foreground') => {
    if (master?.type !== 'frame') return;
    ctx.save();
    ctx.scale(
      frame.transform.width / master.transform.width,
      frame.transform.height / master.transform.height
    );
    for (const child of masterChildren)
      if ((documentValue.masterLayout.placements[child.id] ?? 'foreground') === placement)
        await paintNode(ctx, documentValue, child, media, time);
    ctx.restore();
  };
  await paintMaster('background');
  for (const child of studioSceneChildren(documentValue, frame.id))
    await paintNode(ctx, documentValue, child, media, time);
  await paintMaster('foreground');
  return canvas.toDataURL('image/png');
}
