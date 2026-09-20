// This pure Canvas renderer is serialized into the isolated export browser.
// Text is drawn as text; project content is never interpreted as HTML or code.
export async function paintStudioPage(
  page: any,
  media: Record<string, string>,
  time = 0,
  animateScene = false
) {
  const w = 1080,
    h = page.format === 'story' ? 1920 : page.format === 'square' ? 1080 : 1350;
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
  await document.fonts.ready;
  for (const e of [...page.elements].sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id)
  )) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate((e.rotation * Math.PI) / 180);
    ctx.globalAlpha =
      e.opacity * (e.animation === 'fade' ? Math.min(1, Math.max(0, time / 0.4)) : 1);
    ctx.fillStyle = e.fill;
    if (e.type === 'rect') ctx.fillRect(0, 0, e.width, e.height);
    else if (e.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(e.width / 2, e.height / 2, e.width / 2, e.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'text') {
      ctx.font = `${e.bold ? 'bold' : 'normal'} ${e.fontSize}px "${e.font}"`;
      ctx.textBaseline = 'top';
      const lines: string[] = [];
      for (const paragraph of e.text.split('\n')) {
        let line = '';
        for (const word of paragraph.split(' ')) {
          const next = line ? line + ' ' + word : word;
          if (ctx.measureText(next).width > e.width && line) {
            lines.push(line);
            line = word;
          } else line = next;
        }
        lines.push(line);
      }
      ctx.beginPath();
      ctx.rect(0, 0, e.width, e.height);
      ctx.clip();
      lines.forEach((line, i) => {
        const width = ctx.measureText(line).width;
        ctx.fillText(
          line,
          e.align === 'center' ? (e.width - width) / 2 : e.align === 'right' ? e.width - width : 0,
          i * e.fontSize * 1.2
        );
      });
    } else if (e.assetId && media[e.assetId]) {
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
      const scale =
        e.fit === 'cover'
          ? Math.max(e.width / iw, e.height / ih)
          : Math.min(e.width / iw, e.height / ih);
      ctx.beginPath();
      ctx.rect(0, 0, e.width, e.height);
      ctx.clip();
      ctx.drawImage(
        image,
        (e.width - iw * scale) * e.cropX,
        (e.height - ih * scale) * e.cropY,
        iw * scale,
        ih * scale
      );
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
