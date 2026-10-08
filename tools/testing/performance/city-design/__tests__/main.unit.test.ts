// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  Scene: { prototype: { onBeforeRender: vi.fn(), onAfterRender: vi.fn() } },
  mount: vi.fn(),
  dispose: vi.fn(),
  selection: vi.fn(),
  preview: vi.fn(),
  update: vi.fn(),
  createPoint: vi.fn(),
  createCorridor: vi.fn(),
  createPreview: vi.fn(),
}));
vi.mock('three', () => ({ Scene: mocks.Scene }));
vi.mock('@/features/amendments/city-design/logic/cityDesignScene', () => ({
  mountCityDesignScene: mocks.mount,
}));
vi.mock('@/features/amendments/city-design/logic/cityDesignPlacement', () => ({
  createPointCityDesignObject: mocks.createPoint,
  createCorridorCityDesignObject: mocks.createCorridor,
  createCorridorPreview: mocks.createPreview,
}));
vi.mock('@/features/app-tutorial/city-design-fixture', () => ({
  createAppTutorialInitialCityDesignState: () => ({ objects: [] }),
  createAppTutorialOsmSnapshot: () => ({ features: [{ id: 'osm-1' }] }),
}));

interface BenchmarkApi {
  mount(count: number, width?: number, height?: number): Promise<Record<string, unknown>>;
  begin(): void;
  end(): Record<string, unknown>;
  quality(): { moving: boolean; pixelRatio: number };
  interactions(): Promise<Record<string, number>>;
}
const api = () => (window as unknown as { streetPerformance: BenchmarkApi }).streetPerformance;
let autoFrames: boolean;
let callbacks: Map<number, FrameRequestCallback>;
let nextId: number;
let changePose: (pose: unknown) => void;
let gl: {
  getExtension: ReturnType<typeof vi.fn>;
  getParameter: ReturnType<typeof vi.fn>;
  createQuery: ReturnType<typeof vi.fn>;
  beginQuery: ReturnType<typeof vi.fn>;
  endQuery: ReturnType<typeof vi.fn>;
  getQueryParameter: ReturnType<typeof vi.fn>;
  deleteQuery: ReturnType<typeof vi.fn>;
  QUERY_RESULT_AVAILABLE: string;
  QUERY_RESULT: string;
  RENDERER: string;
};
let objects: { name: string; visible: boolean }[];
let renderer: {
  getContext: () => typeof gl;
  getPixelRatio: () => number;
  info: { render: { calls: number; triangles: number } };
};
let scene: { traverse: (visit: (object: (typeof objects)[number]) => void) => void };

function render() {
  mocks.Scene.prototype.onBeforeRender(renderer, scene, {});
  mocks.Scene.prototype.onAfterRender();
}
function frame(timestamp: number) {
  const [id, callback] = callbacks.entries().next().value!;
  callbacks.delete(id);
  callback(timestamp);
}

beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  document.body.innerHTML = '<canvas></canvas><pre></pre>';
  autoFrames = true;
  callbacks = new Map();
  nextId = 0;
  let clock = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => (clock += 2));
  vi.stubGlobal('devicePixelRatio', 2);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = ++nextId;
    if (autoFrames) queueMicrotask(() => callback(performance.now()));
    else callbacks.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
  gl = {
    QUERY_RESULT_AVAILABLE: 'available',
    QUERY_RESULT: 'result',
    RENDERER: 'renderer',
    getExtension: vi.fn(name =>
      name === 'WEBGL_debug_renderer_info'
        ? { UNMASKED_RENDERER_WEBGL: 'debug-renderer' }
        : name === 'EXT_disjoint_timer_query_webgl2'
          ? { TIME_ELAPSED_EXT: 'elapsed', GPU_DISJOINT_EXT: 'disjoint' }
          : {}
    ),
    getParameter: vi.fn(name => (name === 'disjoint' ? false : 'Radeon 780M')),
    createQuery: vi.fn(() => ({ id: nextId })),
    beginQuery: vi.fn(),
    endQuery: vi.fn(),
    getQueryParameter: vi.fn((_query, name) => (name === 'available' ? true : 4_000_000)),
    deleteQuery: vi.fn(),
  };
  objects = [{ name: 'street', visible: true }];
  scene = { traverse: visit => objects.forEach(visit) };
  renderer = {
    getContext: () => gl,
    getPixelRatio: () => 1.5,
    info: { render: { calls: 12, triangles: 400 } },
  };
  mocks.createPoint.mockImplementation(value => value);
  mocks.createCorridor.mockImplementation(value => value);
  mocks.createPreview.mockImplementation((start, end, width) => ({ start, end, width }));
  mocks.mount.mockImplementation(async options => {
    changePose = options.onCameraPoseChange;
    changePose({ x: 0 });
    for (const name of [
      'onPointerDown',
      'onPointerMove',
      'onPointerHover',
      'onObjectSelect',
      'onOsmWaySelect',
      'onObjectRotate',
    ])
      options[name]();
    render();
    return {
      dispose: mocks.dispose,
      updateSelection: mocks.selection,
      updatePlacementPreview: mocks.preview,
      updateDesign: mocks.update,
    };
  });
  await import('../main.js');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('browser benchmark instrumentation', () => {
  it('mounts mixed production placements at the requested canvas size and reports GPU support', async () => {
    expect(document.querySelector('pre')!.textContent).toBe('Ready');
    expect(await api().mount(5, 1920, 1080)).toEqual({
      count: 5,
      width: 1920,
      height: 1080,
      osmFeatures: 1,
      devicePixelRatio: 2,
      gpu: 'Radeon 780M',
      multiDraw: true,
      gpuTimer: true,
    });
    expect(document.querySelector('canvas')!.style.width).toBe('1920px');
    expect(document.querySelector('canvas')!.style.height).toBe('1080px');
    expect(mocks.createPoint).toHaveBeenCalledWith({
      id: 'obj-0',
      type: 'tree',
      point: { x: -76, z: -40 },
    });
    expect(mocks.createCorridor.mock.calls.map(([value]) => value.type)).toEqual([
      'grass_strip',
      'building',
      'bike_lane',
      'street',
    ]);
    await api().mount(0);
    expect(mocks.dispose).toHaveBeenCalledOnce();
    expect(document.querySelector('canvas')!.style.width).toBe('1100px');
  });

  it('falls back to the standard renderer name when optional GPU extensions are unavailable', async () => {
    gl.getExtension.mockReturnValue(null);
    expect(await api().mount(0)).toMatchObject({
      gpu: 'Radeon 780M',
      multiDraw: false,
      gpuTimer: false,
    });
    expect(gl.getParameter).toHaveBeenCalledWith('renderer');
    autoFrames = false;
    api().begin();
    render();
    expect(api().end()).toMatchObject({ gpuP95: null, gpuSamples: 0, cpuRenderP95: 2 });
    expect(gl.beginQuery).not.toHaveBeenCalled();
  });

  it.each([
    ['visible', true],
    ['hidden', false],
  ] as const)(
    'records current visibility %s and focus %s together with frame and GPU measurements',
    async (visibility, focus) => {
      await api().mount(5);
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(visibility);
      vi.spyOn(document, 'hasFocus').mockReturnValue(focus);
      autoFrames = false;
      api().begin();
      frame(0);
      frame(10);
      frame(30);
      frame(70);
      render();
      changePose({ x: 1 });
      const result = api().end();
      expect(result).toMatchObject({
        frames: 3,
        averageFps: 1000 / (70 / 3),
        frameP50: 20,
        frameP95: 20,
        frameP99: 20,
        framesOver33ms: 1,
        gpuP95: 4,
        gpuSamples: 1,
        cpuRenderP95: 2,
        callsP95: 12,
        trianglesP95: 400,
        pixelRatio: 1.5,
        cameraMoved: true,
        visibility,
        documentHasFocus: focus,
      });
      expect(callbacks.size).toBe(0);
      expect(JSON.parse(document.querySelector('pre')!.textContent!)).toEqual(result);
      expect(gl.deleteQuery).toHaveBeenCalledOnce();
      render();
      expect(gl.beginQuery).toHaveBeenCalledOnce();
    }
  );

  it('reports empty percentiles and an unchanged camera when no frames are sampled', async () => {
    await api().mount(0);
    autoFrames = false;
    api().begin();
    expect(api().end()).toMatchObject({
      frames: 0,
      frameP50: null,
      frameP95: null,
      frameP99: null,
      cpuRenderP95: null,
      gpuP95: null,
      callsP95: null,
      trianglesP95: null,
      cameraMoved: false,
    });
  });

  it('discards disjoint GPU timing samples', async () => {
    await api().mount(0);
    autoFrames = false;
    api().begin();
    gl.getParameter.mockImplementation(name => name === 'disjoint');
    render();
    expect(api().end()).toMatchObject({ gpuP95: null, gpuSamples: 0 });
    expect(gl.deleteQuery).toHaveBeenCalledOnce();
  });

  it('defers unavailable GPU queries and releases outstanding queries before remounting', async () => {
    await api().mount(0);
    autoFrames = false;
    api().begin();
    gl.getQueryParameter.mockReturnValue(false);
    render();
    expect(api().end()).toMatchObject({ gpuSamples: 0 });
    expect(gl.deleteQuery).not.toHaveBeenCalled();
    autoFrames = true;
    await api().mount(1);
    expect(gl.deleteQuery).toHaveBeenCalledOnce();
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });

  it('keeps delayed GPU results attached to the phase that produced them', async () => {
    await api().mount(0);
    autoFrames = false;
    api().begin();
    gl.getQueryParameter.mockReturnValue(false);
    render();
    api().end();
    api().begin();
    gl.getQueryParameter.mockImplementation((_query, name) =>
      name === 'available' ? true : 4_000_000
    );
    render();
    expect(api().end()).toMatchObject({ gpuSamples: 1 });
    expect(gl.deleteQuery).toHaveBeenCalledTimes(2);
  });

  it('handles unavailable query allocation without ending a nonexistent query', async () => {
    await api().mount(0);
    autoFrames = false;
    api().begin();
    gl.createQuery.mockReturnValue(null);
    render();
    expect(api().end()).toMatchObject({ gpuSamples: 0 });
    expect(gl.endQuery).not.toHaveBeenCalled();
  });

  it('reports moving quality only for a visible moving scene object', async () => {
    await api().mount(0);
    objects.push({ name: 'tree:moving', visible: false });
    expect(api().quality()).toEqual({ moving: false, pixelRatio: 1.5 });
    objects.push({ name: 'road:moving', visible: true });
    expect(api().quality()).toEqual({ moving: true, pixelRatio: 1.5 });
  });

  it('measures real selection, preview and insertion updates separately', async () => {
    await api().mount(5);
    expect(await api().interactions()).toEqual({ selectionP95: 4, previewP95: 4, insertionP95: 4 });
    expect(mocks.selection).toHaveBeenCalledTimes(10);
    expect(mocks.selection).toHaveBeenLastCalledWith(
      expect.objectContaining({ selectedObjectId: 'obj-9', interactionMode: 'select' })
    );
    expect(mocks.preview).toHaveBeenCalledTimes(20);
    expect(mocks.createPreview).toHaveBeenLastCalledWith({ x: 0, z: 0 }, { x: 29, z: 8 }, 3);
    expect(mocks.update).toHaveBeenCalledTimes(5);
    expect(mocks.update.mock.calls.at(-1)![0].design.objects).toHaveLength(10);
  });
});
