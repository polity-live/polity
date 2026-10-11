// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createStudioDocumentV3 } from '../document-v3';
const io = vi.hoisted(() => ({ render: vi.fn(() => true), dispose: vi.fn(), redraw: vi.fn() }));
vi.mock('../event-intro-renderer', () => ({
  createSpatialIntro: vi.fn(() => ({
    canvas: document.createElement('canvas'),
    render: io.render,
    dispose: io.dispose,
  })),
  paintIntroWash: vi.fn(),
}));
import { createIntroPlayer } from '../event-intro-player';
import { createSpatialIntro } from '../event-intro-renderer';
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
function setup() {
  const motion = new EventTarget() as MediaQueryList;
  Object.defineProperty(motion, 'matches', { value: false, writable: true });
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => motion)
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect: vi.fn(),
    drawImage: vi.fn(),
  } as any);
  const callbacks = new Map<number, FrameRequestCallback>();
  let sequence = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callbacks.set(++sequence, callback);
    return sequence;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
  const tick = (time: number) => {
    const batch = [...callbacks.values()];
    callbacks.clear();
    batch.forEach(fn => fn(time));
  };
  return {
    motion,
    callbacks,
    tick,
    canvas: document.createElement('canvas'),
    theme: createStudioDocumentV3('Intro').theme,
  };
}
it('uses one animation loop through a simulated day and cleans up on hidden tabs and unmount', () => {
  const env = setup();
  let now = 0;
  const dispose = createIntroPlayer(
    env.canvas,
    { mode: 'spatial', intensity: 0.45, assetId: null, epochMs: 0 },
    env.theme,
    undefined,
    () => now,
    io.redraw
  );
  for (let minute = 0; minute <= 1440; minute++) {
    now = minute * 60000;
    env.tick(now);
    expect(env.callbacks.size).toBe(1);
  }
  expect(io.render).toHaveBeenLastCalledWith(86400000, 0.45);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  document.dispatchEvent(new Event('visibilitychange'));
  expect(env.callbacks.size).toBe(0);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  now += 15000;
  document.dispatchEvent(new Event('visibilitychange'));
  expect(io.render).toHaveBeenLastCalledWith(now, 0.45);
  Object.defineProperty(env.motion, 'matches', { value: true });
  env.motion.dispatchEvent(new Event('change'));
  expect(env.callbacks.size).toBe(0);
  expect(io.render).toHaveBeenLastCalledWith(0, 0.45);
  dispose();
  expect(io.dispose).toHaveBeenCalledOnce();
  document.dispatchEvent(new Event('visibilitychange'));
  expect(env.callbacks.size).toBe(0);
});
it('loops background video silently, seeks shared time on return and releases its source', () => {
  const env = setup();
  let now = 12500;
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(vi.fn());
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(vi.fn());
  const create = document.createElement.bind(document);
  let video: HTMLVideoElement;
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    const element = create(tag);
    if (tag === 'video') video = element as HTMLVideoElement;
    return element;
  }) as any);
  const dispose = createIntroPlayer(
    env.canvas,
    { mode: 'video', intensity: 0.45, assetId: 'video', epochMs: 0 },
    env.theme,
    '/test.mp4',
    () => now,
    io.redraw
  );
  Object.defineProperties(video!, {
    duration: { value: 10 },
    readyState: { value: 2 },
    videoWidth: { value: 1920 },
    videoHeight: { value: 1080 },
  });
  video!.dispatchEvent(new Event('loadeddata'));
  expect(video!.muted && video!.loop && video!.playsInline).toBe(true);
  expect(video!.currentTime).toBe(2.5);
  expect(play).toHaveBeenCalled();
  now = 28700;
  document.dispatchEvent(new Event('visibilitychange'));
  expect(video!.currentTime).toBeCloseTo(8.7);
  video!.currentTime = 1;
  now = 34500;
  env.tick(20000);
  expect(video!.currentTime).toBeCloseTo(4.5);
  dispose();
  expect(video!.hasAttribute('src')).toBe(false);
  expect(pause).toHaveBeenCalled();
  expect(env.callbacks.size).toBe(0);
});

it('handles missing canvases and a failed or lost spatial renderer without allocating extra loops', () => {
  const env = setup();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValueOnce(null);
  const inactive = createIntroPlayer(
    env.canvas,
    { mode: 'spatial', intensity: 0.45, assetId: null },
    env.theme,
    undefined,
    () => 0,
    io.redraw
  );
  inactive();
  expect(env.callbacks.size).toBe(0);
  io.render.mockReturnValueOnce(false);
  const dispose = createIntroPlayer(
    env.canvas,
    { mode: 'spatial', intensity: 0.45, assetId: null },
    env.theme,
    undefined,
    () => 0,
    io.redraw
  );
  const drawCount = io.redraw.mock.calls.length;
  env.tick(0);
  env.tick(1);
  expect(io.redraw.mock.calls.length).toBe(drawCount + 1);
  io.render.mockImplementationOnce(() => {
    throw new Error('GPU failed');
  });
  env.tick(50);
  expect(io.redraw).toHaveBeenCalled();
  const pending = [...env.callbacks.values()][0];
  dispose();
  pending(100);
  expect(env.callbacks.size).toBe(0);
  expect(io.dispose).toHaveBeenCalledOnce();
});

it('pauses a video whose delayed play acknowledgement arrives after it becomes hidden and contains playback errors', async () => {
  const env = setup();
  const create = document.createElement.bind(document);
  let video!: HTMLVideoElement;
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    const element = create(tag);
    if (tag === 'video') video = element as HTMLVideoElement;
    return element;
  }) as any);
  let acknowledge!: () => void;
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(
    () =>
      new Promise<void>(resolve => {
        acknowledge = resolve;
      })
  );
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  const dispose = createIntroPlayer(
    env.canvas,
    { mode: 'video', assetId: 'video', intensity: 0.45 },
    env.theme,
    '/video.mp4',
    () => 2000,
    io.redraw
  );
  Object.defineProperties(video, {
    duration: { value: 10 },
    readyState: { value: 2 },
    videoWidth: { value: 100 },
    videoHeight: { value: 100 },
  });
  const seeked = video.onseeked!;
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  acknowledge();
  await Promise.resolve();
  expect(pause).toHaveBeenCalled();
  env.tick(0);
  expect(env.callbacks.size).toBe(0);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('play unavailable'));
  document.dispatchEvent(new Event('visibilitychange'));
  await Promise.resolve();
  await Promise.resolve();
  const redraws = io.redraw.mock.calls.length;
  video.dispatchEvent(new Event('error'));
  expect(io.redraw.mock.calls.length).toBeGreaterThan(redraws);
  document.dispatchEvent(new Event('visibilitychange'));
  dispose();
  const count = io.redraw.mock.calls.length;
  seeked.call(video, new Event('seeked'));
  expect(io.redraw.mock.calls.length).toBe(count);
});

it('uses a frozen video frame for reduced motion and ignores unseekable durations', () => {
  const env = setup();
  Object.defineProperty(env.motion, 'matches', { value: true, writable: true });
  const create = document.createElement.bind(document);
  let video!: HTMLVideoElement;
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    const element = create(tag);
    if (tag === 'video') {
      video = element as HTMLVideoElement;
      Object.defineProperties(video, {
        duration: { value: 0, configurable: true },
        readyState: { value: 2 },
        videoWidth: { value: 100 },
        videoHeight: { value: 100 },
      });
    }
    return element;
  }) as any);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  const dispose = createIntroPlayer(
    env.canvas,
    { mode: 'video', assetId: 'video', intensity: 0.45, epochMs: 0 },
    env.theme,
    '/video.mp4',
    () => 2000,
    io.redraw
  );
  expect(play).not.toHaveBeenCalled();
  Object.defineProperty(video, 'duration', { value: 10, configurable: true });
  video.dispatchEvent(new Event('loadeddata'));
  expect(video.currentTime).toBe(0);
  Object.defineProperty(env.motion, 'matches', { value: false });
  video.dispatchEvent(new Event('loadeddata'));
  env.tick(100);
  expect(video.currentTime).toBe(2);
  Object.defineProperty(video, 'duration', { value: Infinity, configurable: true });
  env.tick(2200);
  Object.defineProperty(video, 'duration', { value: 0 });
  env.tick(4400);
  expect(video.currentTime).toBe(2);
  dispose();
  const staticDispose = createIntroPlayer(
    env.canvas,
    { mode: 'static', assetId: null, intensity: 0 },
    env.theme,
    undefined,
    () => 0,
    io.redraw
  );
  staticDispose();
});

it('keeps a theme wash after scene allocation fails and permits an acknowledged active video to continue', async () => {
  const env = setup();
  vi.mocked(createSpatialIntro).mockImplementationOnce(() => {
    throw new Error('No WebGL');
  });
  const spatial = createIntroPlayer(
    env.canvas,
    { mode: 'spatial', intensity: 0.45, assetId: null },
    env.theme,
    undefined,
    () => 0,
    io.redraw
  );
  expect(io.redraw).toHaveBeenCalled();
  spatial();
  const create = document.createElement.bind(document);
  let video!: HTMLVideoElement;
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    const element = create(tag);
    if (tag === 'video') video = element as HTMLVideoElement;
    return element;
  }) as any);
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  const dispose = createIntroPlayer(
    env.canvas,
    { mode: 'video', intensity: 0.45, assetId: 'video' },
    env.theme,
    '/video.mp4',
    () => 0,
    io.redraw
  );
  await Promise.resolve();
  expect(video.getAttribute('src')).toBe('/video.mp4');
  expect(pause).not.toHaveBeenCalled();
  dispose();
});
