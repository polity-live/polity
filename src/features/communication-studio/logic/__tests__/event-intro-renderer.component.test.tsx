// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({ render: vi.fn(), dispose: vi.fn(), loss: vi.fn() }));
vi.mock('../democracy-intro', () => ({
  createIllustratedDemocracy: vi.fn(() => ({ variant: 'illustrated' })),
  createSculpturalDemocracy: vi.fn(() => ({ variant: 'sculptural' })),
}));
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>();
  return {
    ...actual,
    WebGLRenderer: class {
      setSize = vi.fn();
      setPixelRatio = vi.fn();
      setClearColor = vi.fn();
      render = io.render;
      dispose = io.dispose;
      forceContextLoss = io.loss;
    },
  };
});
import * as THREE from 'three';
import { createIllustratedDemocracy, createSculpturalDemocracy } from '../democracy-intro';
import { createSpatialIntro, paintIntroSnapshot, paintIntroWash } from '../event-intro-renderer';
import { createEventTemplate } from '../event-templates';
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    globalAlpha: 1,
    drawImage: vi.fn(),
  } as any);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
it('renders the same themed scene across loop boundaries and releases every GPU allocation', () => {
  const document = createEventTemplate('cover', crypto.randomUUID());
  const geometry = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
  const material = vi.spyOn(THREE.Material.prototype, 'dispose');
  const renderer = createSpatialIntro(3840, 2160, document.theme);
  renderer.render(0, 0.45);
  const [scene, camera] = io.render.mock.calls.at(-1)!;
  const cameraPosition = camera.position.toArray();
  const ring = scene.children.find((n: any) => n.type === 'Group').children[0];
  const rotation = ring.rotation.toArray();
  expect(ring.material.color.getHexString().toUpperCase()).toBe(
    document.theme.light.brand.slice(1)
  );
  renderer.render(7000, 0.45);
  expect(camera.position.distanceTo(new THREE.Vector3(...cameraPosition))).toBeGreaterThan(1);
  renderer.render(14750, 0.45);
  expect(io.render.mock.calls).toHaveLength(4); // Both shots render only during the dissolve.
  renderer.render(90000, 0.45);
  expect(camera.position.toArray()).toEqual(cameraPosition);
  expect(ring.rotation.toArray()).toEqual(rotation);
  if (!('webglCanvas' in renderer)) throw new Error('Architecture needs WebGL');
  const webglCanvas = renderer.webglCanvas as HTMLCanvasElement;
  webglCanvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  expect(renderer.render(1000, 0.45)).toBe(false);
  webglCanvas.dispatchEvent(new Event('webglcontextrestored'));
  expect(renderer.render(1000, 0.45)).toBe(true);
  renderer.dispose();
  expect(geometry).toHaveBeenCalledTimes(3);
  expect(material).toHaveBeenCalledTimes(5);
  expect(io.dispose).toHaveBeenCalledOnce();
  expect(io.loss).toHaveBeenCalledOnce();
});
it('uses the frozen phase for static intro exports and disposes the renderer even when painting fails', async () => {
  const document = createEventTemplate('cover', crypto.randomUUID());
  const frame = document.nodes[0];
  if (frame.type !== 'frame') throw new Error('frame');
  frame.intro = {
    mode: 'spatial',
    assetId: null,
    intensity: 0.45,
    epochMs: 1000,
    snapshotAt: 46000,
  };
  const ctx = {
    drawImage: vi.fn(() => {
      throw new Error('paint failed');
    }),
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
  } as any;
  await paintIntroSnapshot(ctx, frame, document.theme, {});
  expect(io.render).toHaveBeenCalledOnce();
  expect(io.dispose).toHaveBeenCalledOnce();
  expect(ctx.fillRect).toHaveBeenCalled();
});

function paintingContext() {
  return {
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  } as any;
}

it('routes each democracy scene to its dedicated renderer with the requested dimensions and theme', () => {
  const theme = createEventTemplate('cover', crypto.randomUUID()).theme;
  expect(createSpatialIntro(1080, 1920, theme, 'democracy-illustrated')).toEqual({
    variant: 'illustrated',
  });
  expect(createIllustratedDemocracy).toHaveBeenCalledWith(1080, 1920, theme);
  expect(createSpatialIntro(1920, 1080, theme, 'democracy-sculptural')).toEqual({
    variant: 'sculptural',
  });
  expect(createSculpturalDemocracy).toHaveBeenCalledWith(1920, 1080, theme);
});

it('handles unavailable canvases and preserves a stable portrait scene when motion is disabled', () => {
  const theme = createEventTemplate('cover', crypto.randomUUID()).theme;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValueOnce(null);
  expect(() => createSpatialIntro(1080, 1920, theme)).toThrow('Intro canvas unavailable');
  const scene = createSpatialIntro(1080, 1920, theme);
  scene.render(15000, 0);
  const camera = io.render.mock.calls.at(-1)![1];
  const position = camera.position.toArray();
  scene.render(65000, 0);
  expect(camera.position.toArray()).toEqual(position);
  scene.dispose();
  for (const [width, height] of [
    [1920, 1080],
    [1080, 1920],
  ]) {
    for (const variant of [undefined, 'architecture', 'democracy-illustrated'] as const) {
      const ctx = paintingContext();
      paintIntroWash(ctx, width, height, theme, variant);
      expect(ctx.save).toHaveBeenCalledOnce();
      expect(ctx.restore).toHaveBeenCalledOnce();
      expect(ctx.fillRect).toHaveBeenCalledTimes(
        width >= height || variant === 'democracy-illustrated' ? 2 : 1
      );
    }
  }
});

it('leaves missing and static intros intact and renders a spatial snapshot without an explicit epoch', async () => {
  const template = createEventTemplate('cover', crypto.randomUUID());
  const frame = template.nodes[0];
  if (frame.type !== 'frame') throw new Error('frame');
  const ctx = paintingContext();
  delete frame.intro;
  await paintIntroSnapshot(ctx, frame, template.theme, {});
  frame.intro = { mode: 'static', intensity: 0.45, assetId: null };
  await paintIntroSnapshot(ctx, frame, template.theme, {});
  expect(ctx.drawImage).not.toHaveBeenCalled();
  frame.intro = { mode: 'spatial', intensity: 0.45, assetId: null };
  await paintIntroSnapshot(ctx, frame, template.theme, {});
  expect(ctx.drawImage).toHaveBeenCalledOnce();
  expect(io.dispose).toHaveBeenCalledOnce();
  frame.intro = { mode: 'video', intensity: 0.45, assetId: null };
  await paintIntroSnapshot(ctx, frame, template.theme, {});
  frame.intro.assetId = 'missing';
  await paintIntroSnapshot(ctx, frame, template.theme, {});
  expect(ctx.drawImage).toHaveBeenCalledOnce();
});

it.each([
  [10, 12500, 2500],
  [10, -2500, 7500],
  [10, undefined, 0],
  [Infinity, 12000, 0],
  [0, 12000, 0],
] as const)(
  'exports decoded video at its wrapped snapshot phase (duration=%s snapshot=%s)',
  async (duration, snapshotAt, targetMs) => {
    const template = createEventTemplate('cover', crypto.randomUUID());
    const frame = template.nodes[0];
    if (frame.type !== 'frame') throw new Error('frame');
    frame.intro = {
      mode: 'video',
      assetId: 'clip',
      intensity: 0.45,
      ...(snapshotAt === undefined ? {} : { snapshotAt }),
    };
    const create = document.createElement.bind(document);
    let video!: HTMLVideoElement;
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      const element = create(tag);
      if (tag === 'video') {
        video = element as HTMLVideoElement;
        let time = 0;
        Object.defineProperties(video, {
          duration: { value: duration },
          videoWidth: { value: 1920 },
          videoHeight: { value: 1080 },
          src: { set: () => queueMicrotask(() => video.dispatchEvent(new Event('loadeddata'))) },
          currentTime: {
            get: () => time,
            set: (value: number) => {
              time = value;
              queueMicrotask(() => video.dispatchEvent(new Event('seeked')));
            },
          },
        });
      }
      return element;
    }) as any);
    const ctx = paintingContext();
    await paintIntroSnapshot(ctx, frame, template.theme, { clip: '/clip.mp4' });
    expect(video.currentTime).toBe(targetMs / 1000);
    expect(ctx.drawImage).toHaveBeenCalledWith(video, 0, 0, 1920, 1080);
    expect(video.onloadeddata).toBeNull();
    expect(video.onseeked).toBeNull();
    expect(video.onerror).toBeNull();
    expect(video.pause).toHaveBeenCalled();
    expect(video.load).toHaveBeenCalled();
  }
);

it.each(['decode-error', 'load-timeout', 'seek-timeout'] as const)(
  'keeps the themed snapshot usable after %s and releases the video',
  async failure => {
    vi.useFakeTimers();
    try {
      const template = createEventTemplate('cover', crypto.randomUUID());
      const frame = template.nodes[0];
      if (frame.type !== 'frame') throw new Error('frame');
      frame.intro = { mode: 'video', assetId: 'clip', intensity: 0.45, snapshotAt: 1000 };
      const create = document.createElement.bind(document);
      let video!: HTMLVideoElement;
      vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
      vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
      vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
        const element = create(tag);
        if (tag === 'video') {
          video = element as HTMLVideoElement;
          Object.defineProperty(video, 'duration', { value: 10 });
        }
        return element;
      }) as any);
      const ctx = paintingContext();
      const snapshot = paintIntroSnapshot(ctx, frame, template.theme, { clip: '/broken.mp4' });
      if (failure === 'decode-error') video.dispatchEvent(new Event('error'));
      if (failure === 'seek-timeout') {
        video.dispatchEvent(new Event('loadeddata'));
        await Promise.resolve();
      }
      await vi.advanceTimersByTimeAsync(failure === 'seek-timeout' ? 10000 : 15000);
      await snapshot;
      expect(ctx.drawImage).not.toHaveBeenCalled();
      expect(ctx.fillRect).toHaveBeenCalled();
      expect(video.pause).toHaveBeenCalled();
      expect(video.load).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  }
);
