import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { paintStudioPage } from '../paint';
let canvas: any,
  ctx: any,
  cache: any,
  media: any[],
  loadMode: string,
  seekMode: string,
  existing: boolean;
class MockImage {
  naturalWidth = 200;
  naturalHeight = 100;
  onload?: () => void;
  onerror?: () => void;
  constructor() {
    media.push(this);
  }
  set src(_url: string) {
    if (loadMode !== 'timeout')
      queueMicrotask(() => (loadMode === 'error' ? this.onerror?.() : this.onload?.()));
  }
}
class MockVideo extends MockImage {
  duration = 10;
  videoWidth = 100;
  videoHeight = 200;
  onloadeddata?: () => void;
  onseeked?: () => void;
  position = 0;
  set src(_url: string) {
    if (loadMode !== 'timeout')
      queueMicrotask(() => (loadMode === 'error' ? this.onerror?.() : this.onloadeddata?.()));
  }
  get currentTime() {
    return this.position;
  }
  set currentTime(value: number) {
    this.position = value;
    if (seekMode !== 'timeout') queueMicrotask(() => this.onseeked?.());
  }
}
const element = (type: string, properties = {}) => ({
  id: 'element',
  type,
  x: 20,
  y: 40,
  width: 100,
  height: 100,
  rotation: 90,
  opacity: 0.8,
  fill: '#12362D',
  animation: 'none',
  order: 0,
  fit: 'cover',
  cropX: 0.5,
  cropY: 0.5,
  trimStart: 2,
  ...properties,
});
const page = (elements: any[], extra = {}) => ({
  elements,
  background: '#FFFCF6',
  format: 'portrait',
  duration: 4,
  transition: 'none',
  ...extra,
});
beforeEach(() => {
  vi.useFakeTimers();
  cache = {};
  media = [];
  loadMode = 'success';
  seekMode = 'success';
  existing = true;
  ctx = Object.fromEntries(
    [
      'fillRect',
      'save',
      'restore',
      'translate',
      'scale',
      'rotate',
      'beginPath',
      'ellipse',
      'fill',
      'rect',
      'clip',
      'drawImage',
      'fillText',
    ].map(name => [name, vi.fn()])
  );
  ctx.measureText = vi.fn((text: string) => ({ width: text.length * 10 }));
  canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    toDataURL: vi.fn(() => 'data:image/png;base64,rendered'),
  };
  vi.stubGlobal('Image', MockImage);
  vi.stubGlobal('HTMLVideoElement', MockVideo);
  vi.stubGlobal('window', {});
  vi.stubGlobal('document', {
    querySelector: () => (existing ? canvas : null),
    createElement: (tag: string) => (tag === 'video' ? new MockVideo() : canvas),
    body: { appendChild: vi.fn() },
    fonts: { ready: Promise.resolve() },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('Studio canvas export drawing', () => {
  it('creates correctly sized canvases and renders layers in stable order with shapes and scene fades', async () => {
    existing = false;
    const p = page(
      [
        element('rect', { id: 'b', order: 1 }),
        element('ellipse', { id: 'a', order: 1 }),
        element('rect', { id: 'first', order: 0, animation: 'fade' }),
      ],
      { format: 'story', transition: 'fade' }
    );
    expect(await paintStudioPage(p, {}, 0.15, true)).toBe('data:image/png;base64,rendered');
    expect(canvas.height).toBe(1920);
    expect(canvas.width).toBe(1080);
    expect(document.body.appendChild).toHaveBeenCalledWith(canvas);
    expect(ctx.ellipse).toHaveBeenCalledWith(50, 50, 50, 50, 0, 0, Math.PI * 2);
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2);
    expect(ctx.globalAlpha).toBeCloseTo(0.5);
    expect(ctx.restore).toHaveBeenCalledTimes(6);
    await paintStudioPage(page([], { format: 'square' }), {});
    expect(canvas.height).toBe(1080);
    await paintStudioPage(page([]), {});
    expect(canvas.height).toBe(1350);
    canvas.getContext.mockReturnValue(null);
    await expect(paintStudioPage(page([]), {})).rejects.toThrow('Canvas unavailable');
  });
  it('wraps paragraphs, clips overflowing text and aligns plain text without interpreting markup', async () => {
    for (const align of ['left', 'center', 'right']) {
      ctx.fillText.mockClear();
      await paintStudioPage(
        page([
          element('text', {
            text: 'one two three\n<script>',
            font: 'Manrope',
            fontSize: 20,
            lineHeight: 1.2,
            verticalAlign: 'top',
            richText: [],
            bold: align === 'right',
            align,
          }),
        ]),
        {}
      );
      const calls = ctx.fillText.mock.calls as [string, number, number][];
      expect(calls.map(c => c[0]).join('')).toBe('one two three<script>');
      expect(calls.find(c => c[0] === 'three')?.[2]).toBe(24);
      expect(calls.find(c => c[0] === '<script>')?.[2]).toBe(48);
      expect(ctx.clip).toHaveBeenCalled();
      expect(ctx.font).toBe(`${align === 'right' ? 'bold ' : ''}20px "Manrope"`);
    }
  });
  it('loads and reuses media, applies crop and fit, seeks video within its duration and ignores absent assets', async () => {
    const p = page([
      element('image', { id: 'image', assetId: 'image' }),
      element('video', { id: 'video', assetId: 'video', fit: 'contain' }),
      element('image', { id: 'missing', assetId: 'absent' }),
    ]);
    await paintStudioPage(p, { image: 'image.png', video: 'video.mp4' }, 20);
    expect(media).toHaveLength(2);
    expect(ctx.drawImage.mock.calls[0]).toEqual([media[0], -50, 0, 200, 100]);
    expect(ctx.drawImage.mock.calls[1]).toEqual([media[1], 25, 0, 50, 100]);
    expect(media[1].currentTime).toBe(9.95);
    expect(media[1].muted).toBe(true);
    await paintStudioPage(p, { image: 'image.png', video: 'video.mp4' }, 20);
    expect(media).toHaveLength(2);
    expect(ctx.drawImage).toHaveBeenCalledTimes(4);
    cache = (window as any).__studioMedia;
    expect(cache.image).toBe(media[0]);
  });
  it('exports a native crop without rescaling the complete source into the cropped bounds', async () => {
    await paintStudioPage(
      page([
        element('image', {
          id: 'cropped',
          assetId: 'cropped',
          width: 100,
          height: 80,
          fit: 'contain',
          crop: {
            x: 50,
            y: 10,
            width: 100,
            height: 80,
            naturalWidth: 200,
            naturalHeight: 100,
          },
        }),
      ]),
      { cropped: 'cropped.png' }
    );
    expect(ctx.drawImage).toHaveBeenLastCalledWith(media[0], -50, -10, 200, 100);
  });
  it('applies horizontal and vertical reflection to structured and media exports', async () => {
    await paintStudioPage(
      page([
        element('rect', { id: 'shape', flipX: true, flipY: false }),
        element('image', { id: 'image', assetId: 'image', flipX: false, flipY: true }),
      ]),
      { image: 'image.png' }
    );
    expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
    expect(ctx.scale).toHaveBeenCalledWith(1, -1);
    expect(ctx.translate).toHaveBeenCalledWith(100, 0);
    expect(ctx.translate).toHaveBeenCalledWith(0, 100);
  });
  it('fails failed decoding and bounded media or video waits instead of exporting blank successful frames', async () => {
    loadMode = 'error';
    await expect(
      paintStudioPage(page([element('image', { assetId: 'bad' })]), { bad: 'bad' })
    ).rejects.toThrow('could not be decoded');
    loadMode = 'timeout';
    const loading = paintStudioPage(page([element('image', { assetId: 'slow' })]), {
      slow: 'slow',
    });
    const loadAssertion = expect(loading).rejects.toThrow('Media load timeout');
    await vi.advanceTimersByTimeAsync(30_000);
    await loadAssertion;
    loadMode = 'success';
    seekMode = 'timeout';
    const seeking = paintStudioPage(page([element('video', { assetId: 'video' })]), {
      video: 'video',
    });
    const seekAssertion = expect(seeking).rejects.toThrow('Video seek timeout');
    await vi.advanceTimersByTimeAsync(10_000);
    await seekAssertion;
  });
});
