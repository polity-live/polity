import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { element } from '../document';
import {
  createFrameNode,
  createStudioDocumentV5,
  drawingNodeSchema,
  embedNodeSchema,
  mediaNodeSchema,
  shapeNodeSchema,
} from '../document-v3';
import { createStudioNodeFromElement } from '../create-studio-node';
import { paintStudioDocumentFrame } from '../paint-v5';

const methods = [
  'save',
  'restore',
  'translate',
  'rotate',
  'scale',
  'setLineDash',
  'beginPath',
  'ellipse',
  'moveTo',
  'lineTo',
  'closePath',
  'roundRect',
  'fill',
  'stroke',
  'fillRect',
  'strokeRect',
  'rect',
  'clip',
  'drawImage',
  'fillText',
  'arc',
];
let ctx: Record<string, any>,
  canvas: any,
  existing: boolean,
  decodeFails: boolean,
  videos: FakeVideo[];
class FakeImage {
  src = '';
  naturalWidth = 200;
  naturalHeight = 100;
  async decode() {
    if (decodeFails) throw new Error('Image decode failed');
  }
}
class FakeVideo {
  muted = false;
  preload = '';
  duration = 10;
  videoWidth = 100;
  videoHeight = 200;
  position = 0;
  onloadeddata?: () => void;
  onerror?: () => void;
  onseeked?: () => void;
  set src(_source: string) {
    queueMicrotask(() => (decodeFails ? this.onerror?.() : this.onloadeddata?.()));
  }
  set currentTime(time: number) {
    this.position = time;
    queueMicrotask(() => this.onseeked?.());
  }
  get currentTime() {
    return this.position;
  }
}
beforeEach(() => {
  existing = false;
  decodeFails = false;
  videos = [];
  ctx = Object.fromEntries(methods.map(name => [name, vi.fn()]));
  ctx.globalAlpha = 1;
  ctx.measureText = (text: string) => ({ width: text.length * 8 });
  canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    toDataURL: vi.fn(() => 'data:image/png;base64,fixture'),
  };
  vi.stubGlobal('Image', FakeImage);
  vi.stubGlobal('HTMLVideoElement', FakeVideo);
  vi.stubGlobal('document', {
    querySelector: () => (existing ? canvas : null),
    createElement: (tag: string) => {
      if (tag !== 'video') return canvas;
      const video = new FakeVideo();
      videos.push(video);
      return video;
    },
    body: { appendChild: vi.fn() },
    fonts: { ready: Promise.resolve() },
  });
});
afterEach(() => vi.unstubAllGlobals());
function fixture() {
  const document = createStudioDocumentV5('Export fixture');
  const frame = createFrameNode('custom', {
    transform: { x: 0, y: 0, width: 200, height: 100, rotation: 0 },
  });
  document.nodes = [frame];
  return { document, frame };
}
function shape(
  parent: string,
  kind: 'rectangle' | 'rounded-rectangle' | 'ellipse' | 'diamond' | 'line' | 'arrow',
  index = 1
) {
  return shapeNodeSchema.parse({
    ...createFrameNode('custom'),
    type: 'shape',
    parentFrameId: parent,
    shape: kind,
    transform: { x: 10, y: 20, width: 40, height: 30, rotation: 90, flipX: true, flipY: true },
    style: { fill: '#FF0000', stroke: '#000000', strokeWidth: 2, strokeStyle: 'dashed' },
    zIndex: index,
  });
}
it.each(['rectangle', 'rounded-rectangle', 'ellipse', 'diamond', 'line', 'arrow'] as const)(
  'exports a transformed %s using the native path and stroke',
  async kind => {
    const { document: value, frame } = fixture();
    value.nodes.push(shape(frame.id, kind));
    expect(await paintStudioDocumentFrame(value, frame.id, {})).toBe(
      'data:image/png;base64,fixture'
    );
    expect(canvas).toMatchObject({ width: 200, height: 100 });
    expect(document.body.appendChild).toHaveBeenCalledWith(canvas);
    expect(ctx.scale).toHaveBeenCalledWith(-1, -1);
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2);
    expect(ctx.setLineDash).toHaveBeenCalledWith([10, 7]);
    expect(ctx.stroke).toHaveBeenCalled();
    if (kind === 'ellipse')
      expect(ctx.ellipse).toHaveBeenCalledWith(20, 15, 20, 15, 0, 0, Math.PI * 2);
    if (kind === 'rectangle') expect(ctx.roundRect).toHaveBeenCalledWith(0, 0, 40, 30, 0);
    if (kind === 'rounded-rectangle') expect(ctx.roundRect).toHaveBeenCalledWith(0, 0, 40, 30, 12);
    if (kind === 'diamond') expect(ctx.closePath).toHaveBeenCalled();
    if (kind === 'arrow') expect(ctx.lineTo).toHaveBeenCalledTimes(3);
    expect(ctx.fill).toHaveBeenCalledTimes(kind === 'line' || kind === 'arrow' ? 0 : 1);
  }
);
it('preserves sibling order, skips invisible nodes and paints both master placements at the frame scale', async () => {
  const { document: value, frame } = fixture();
  existing = true;
  const master = createFrameNode('custom', { transform: { x: 0, y: 0, width: 100, height: 100 } });
  const background = shape(master.id, 'rectangle', 1),
    foreground = shape(master.id, 'ellipse', 2),
    local = shape(frame.id, 'diamond', 3),
    invisible = shape(frame.id, 'arrow', 4);
  invisible.visible = false;
  value.masterLayout = { frameId: master.id, placements: { [background.id]: 'background' } };
  value.nodes.push(master, foreground, invisible, local, background);
  await paintStudioDocumentFrame(value, frame.id, {});
  expect(document.body.appendChild).not.toHaveBeenCalled();
  expect(ctx.scale.mock.calls.filter(([x, y]: number[]) => x === 2 && y === 1)).toHaveLength(2);
  expect(ctx.roundRect.mock.invocationCallOrder[0]).toBeLessThan(
    ctx.closePath.mock.invocationCallOrder[0]
  );
  expect(ctx.closePath.mock.invocationCallOrder[0]).toBeLessThan(
    ctx.ellipse.mock.invocationCallOrder[0]
  );
  expect(ctx.lineTo).toHaveBeenCalledTimes(3);
});
it('renders nested frame clipping, drawings, rich text, native tables and charts, and embed backgrounds', async () => {
  const { document: value, frame } = fixture();
  const nested = createFrameNode('custom', {
    parentFrameId: frame.id,
    clipContent: true,
    style: { ...frame.style, fill: '#FFFFFF' },
  });
  const drawing = drawingNodeSchema.parse({
    ...shape(nested.id, 'rectangle'),
    type: 'drawing',
    points: [
      [0, 0],
      [10, 10],
    ],
    style: { strokeStyle: 'dotted', strokeWidth: 0 },
  });
  const nodes = ['text', 'table', 'chart'].map(type =>
    createStudioNodeFromElement(
      element(type as 'text' | 'table' | 'chart', {
        text: 'Visible words',
        width: 200,
        height: 100,
      }),
      frame.id,
      3
    )
  );
  const embed = embedNodeSchema.parse({
    ...nested,
    id: crypto.randomUUID(),
    type: 'embed',
    parentFrameId: frame.id,
    provider: 'code',
    value: '<p>Embed</p>',
    style: { ...frame.style, fill: null },
  });
  value.nodes.push(nested, drawing, ...nodes, embed);
  await paintStudioDocumentFrame(value, frame.id, {});
  expect(ctx.strokeRect).toHaveBeenCalledWith(0, 0, 1080, 1080);
  expect(ctx.clip).toHaveBeenCalled();
  expect(ctx.setLineDash).toHaveBeenCalledWith([2, 5]);
  expect(ctx.fillText.mock.calls.map(([text]: [string]) => text).join('')).toContain('Visible');
  expect(ctx.fillRect.mock.calls.length).toBeGreaterThan(10);
  expect(ctx.lineCap).toBe('round');
});
it('uses document and theme background fallbacks and accepts frames without clipping or strokes', async () => {
  const { document: value, frame } = fixture();
  frame.clipContent = false;
  frame.style.stroke = null;
  const nested = structuredClone(frame);
  nested.id = crypto.randomUUID();
  nested.parentFrameId = frame.id;
  value.nodes.push(nested);
  value.frameDefaults.background = '#123456';
  await paintStudioDocumentFrame(value, frame.id, {});
  expect(ctx.fillStyle).toBe('#123456');
  expect(ctx.strokeRect).not.toHaveBeenCalled();
  expect(ctx.clip).not.toHaveBeenCalled();
  value.frameDefaults.background = null;
  await paintStudioDocumentFrame(value, frame.id, {});
  expect(ctx.fillStyle).toBe(value.theme[value.theme.mode].background);
});
it('draws shapes without a fill or stroke and decodes image placement while skipping missing assets', async () => {
  const { document: value, frame } = fixture();
  const noStroke = shape(frame.id, 'rectangle');
  noStroke.style.fill = null;
  noStroke.style.stroke = null;
  noStroke.style.strokeWidth = 0;
  const image = mediaNodeSchema.parse({
    ...noStroke,
    id: crypto.randomUUID(),
    type: 'media',
    mediaType: 'image',
    assetId: crypto.randomUUID(),
    fit: 'cover',
    transform: { x: 0, y: 0, width: 100, height: 100 },
    style: { strokeStyle: 'solid' },
  });
  const missing = structuredClone(image);
  missing.id = crypto.randomUUID();
  missing.assetId = crypto.randomUUID();
  value.nodes.push(noStroke, image, missing);
  await paintStudioDocumentFrame(value, frame.id, { [image.assetId]: 'image.png' });
  expect(ctx.fill).not.toHaveBeenCalled();
  expect(ctx.stroke).not.toHaveBeenCalled();
  expect(ctx.drawImage).toHaveBeenCalledOnce();
  expect(ctx.drawImage.mock.calls[0].slice(1)).toEqual([-50, 0, 200, 100]);
});
it('seeks video within its duration, supports its first frame and rejects failed media decoding', async () => {
  const { document: value, frame } = fixture();
  const video = mediaNodeSchema.parse({
    ...shape(frame.id, 'rectangle'),
    type: 'media',
    mediaType: 'video',
    assetId: crypto.randomUUID(),
    transform: { x: 0, y: 0, width: 100, height: 100 },
    trim: { start: 2, end: null },
  });
  value.nodes.push(video);
  const media = { [video.assetId]: 'video.mp4' };
  await paintStudioDocumentFrame(value, frame.id, media, 20);
  expect(videos[0].currentTime).toBe(9.95);
  expect(videos[0].muted).toBe(true);
  expect(ctx.drawImage.mock.calls[0].slice(1)).toEqual([25, 0, 50, 100]);
  video.trim.start = 0;
  await paintStudioDocumentFrame(value, frame.id, media, 0);
  expect(videos[1].currentTime).toBe(0);
  decodeFails = true;
  await expect(paintStudioDocumentFrame(value, frame.id, media)).rejects.toThrow(
    'Video could not be decoded'
  );
  video.mediaType = 'image';
  await expect(paintStudioDocumentFrame(value, frame.id, media)).rejects.toThrow(
    'Image decode failed'
  );
});
it('rejects missing frames and unavailable canvases without publishing a PNG', async () => {
  const { document: value, frame } = fixture();
  await expect(paintStudioDocumentFrame(value, crypto.randomUUID(), {})).rejects.toThrow(
    'Studio frame not found'
  );
  canvas.getContext.mockReturnValue(null);
  await expect(paintStudioDocumentFrame(value, frame.id, {})).rejects.toThrow('Canvas unavailable');
  expect(canvas.toDataURL).not.toHaveBeenCalled();
});
