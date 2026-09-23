import { formats, type StudioPage } from '../../src/features/communication-studio/logic/document';

/** Fit the unbounded board into an output page without changing its saved sources. */
export function fitWhiteboardExport(source: StudioPage): StudioPage {
  const page = structuredClone(source),
    points: number[][] = [];
  for (const e of page.elements) {
    const angle = (e.rotation * Math.PI) / 180;
    for (const [x, y] of [
      [0, 0],
      [e.width, 0],
      [0, e.height],
      [e.width, e.height],
    ])
      points.push([
        e.x + x * Math.cos(angle) - y * Math.sin(angle),
        e.y + x * Math.sin(angle) + y * Math.cos(angle),
      ]);
  }
  for (const e of page.canvas?.elements ?? []) {
    if (e.isDeleted) continue;
    const cx = e.x + e.width / 2,
      cy = e.y + e.height / 2;
    for (const [x, y] of [
      [-e.width / 2, -e.height / 2],
      [e.width / 2, -e.height / 2],
      [-e.width / 2, e.height / 2],
      [e.width / 2, e.height / 2],
    ])
      points.push([
        cx + x * Math.cos(e.angle) - y * Math.sin(e.angle),
        cy + x * Math.sin(e.angle) + y * Math.cos(e.angle),
      ]);
  }
  if (!points.length) return page;
  const minX = Math.min(...points.map(p => p[0])),
    minY = Math.min(...points.map(p => p[1]));
  const width = Math.max(1, Math.max(...points.map(p => p[0])) - minX),
    height = Math.max(1, Math.max(...points.map(p => p[1])) - minY);
  const [outW, outH] = formats[page.format],
    scale = Math.min((outW - 80) / width, (outH - 80) / height);
  for (const e of page.elements) {
    e.x = (e.x - minX) * scale + 40;
    e.y = (e.y - minY) * scale + 40;
    e.width *= scale;
    e.height *= scale;
    e.fontSize *= scale;
    e.strokeWidth *= scale;
    for (const p of e.richText)
      for (const run of p.children) if (run.fontSize) run.fontSize *= scale;
  }
  for (const e of page.canvas?.elements ?? []) {
    e.x = (e.x - minX) * scale + 40;
    e.y = (e.y - minY) * scale + 40;
    e.width *= scale;
    e.height *= scale;
    if (typeof e.fontSize === 'number') e.fontSize *= scale;
    if (typeof e.strokeWidth === 'number') e.strokeWidth *= scale;
    if (Array.isArray(e.points))
      e.points = e.points.map(p =>
        Array.isArray(p) ? p.map(n => (typeof n === 'number' ? n * scale : n)) : p
      );
  }
  return page;
}
