import { formats, type StudioPage } from './document';

/** Fit the existing composition into the target canvas without cropping its content. */
export function resizePage(page: StudioPage, format: StudioPage['format']): StudioPage {
  const [width, height] = formats[page.format];
  const [nextWidth, nextHeight] = formats[format];
  const scale = Math.min(nextWidth / width, nextHeight / height);
  const dx = (nextWidth - width * scale) / 2;
  const dy = (nextHeight - height * scale) / 2;
  return {
    ...page,
    format,
    elements: page.elements.map(e => ({
      ...e,
      x: e.x * scale + dx,
      y: e.y * scale + dy,
      width: Math.max(4, e.width * scale),
      height: Math.max(4, e.height * scale),
      fontSize: Math.max(8, e.fontSize * scale),
    })),
  };
}
