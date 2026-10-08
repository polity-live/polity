import * as THREE from 'three';
import { mountCityDesignScene } from '@/features/amendments/city-design/logic/cityDesignScene';
import {
  createCorridorCityDesignObject,
  createPointCityDesignObject,
  createCorridorPreview,
} from '@/features/amendments/city-design/logic/cityDesignPlacement';
import {
  createAppTutorialInitialCityDesignState,
  createAppTutorialOsmSnapshot,
} from '@/features/app-tutorial/city-design-fixture';

const canvas = document.querySelector('canvas');
const output = document.querySelector('pre');
const noop = () => undefined;
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
const percentile = (values, p) =>
  values.toSorted((a, b) => a - b)[Math.floor((values.length - 1) * p)] ?? null;
let controller, renderer, scene, design, pose;
let phase = null;
let animationFrame = 0;
let previousFrame = null;
let renderStarted = 0;
let activeQuery = null;
const pendingQueries = [];
let timerExtension;

THREE.Scene.prototype.onBeforeRender = function (currentRenderer, currentScene, _currentCamera) {
  renderer = currentRenderer;
  scene = currentScene;
  renderStarted = performance.now();
  const gl = renderer.getContext();
  timerExtension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if (phase && timerExtension) {
    activeQuery = gl.createQuery();
    gl.beginQuery(timerExtension.TIME_ELAPSED_EXT, activeQuery);
  }
};
THREE.Scene.prototype.onAfterRender = function () {
  if (!phase) return;
  const gl = renderer.getContext();
  if (activeQuery) {
    gl.endQuery(timerExtension.TIME_ELAPSED_EXT);
    pendingQueries.push({ query: activeQuery, owner: phase });
    activeQuery = null;
  }
  phase.cpu.push(performance.now() - renderStarted);
  phase.calls.push(renderer.info.render.calls);
  phase.triangles.push(renderer.info.render.triangles);
  while (
    pendingQueries.length &&
    gl.getQueryParameter(pendingQueries[0].query, gl.QUERY_RESULT_AVAILABLE)
  ) {
    const { query, owner } = pendingQueries.shift();
    if (!gl.getParameter(timerExtension.GPU_DISJOINT_EXT))
      owner.gpu.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
    gl.deleteQuery(query);
  }
};

function sample(timestamp) {
  if (previousFrame !== null) phase.frames.push(timestamp - previousFrame);
  previousFrame = timestamp;
  animationFrame = requestAnimationFrame(sample);
}
function makeDesign(count) {
  const state = createAppTutorialInitialCityDesignState();
  state.osmSnapshot = createAppTutorialOsmSnapshot();
  state.objects = Array.from({ length: count }, (_, i) => {
    const x = (i % 20) * 8 - 76,
      z = Math.floor(i / 20) * 7 - 40;
    return i % 5 === 0
      ? createPointCityDesignObject({ id: `obj-${i}`, type: 'tree', point: { x, z } })
      : createCorridorCityDesignObject({
          id: `obj-${i}`,
          type:
            i % 5 === 1
              ? 'grass_strip'
              : i % 5 === 2
                ? 'building'
                : i % 5 === 3
                  ? 'bike_lane'
                  : 'street',
          start: { x, z },
          end: { x: x + 6, z: z + 1 },
          width: 3,
        });
  });
  return state;
}
window.streetPerformance = {
  async mount(count, width = 1100, height = 720) {
    if (renderer) {
      const gl = renderer.getContext();
      for (const { query } of pendingQueries) gl.deleteQuery(query);
      pendingQueries.length = 0;
    }
    controller?.dispose();
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    design = makeDesign(count);
    controller = await mountCityDesignScene({
      canvas,
      design,
      placementPreview: null,
      placementPreviewType: null,
      placementStart: null,
      selectedObjectId: null,
      selectedOsmWayId: null,
      selectedChangeRequestId: null,
      hiddenObjectIds: [],
      hiddenObjectCategories: [],
      changeRequests: [],
      focusObjectId: null,
      focusOsmWayId: null,
      interactionMode: 'camera',
      readOnly: false,
      initialCameraPose: null,
      onPointerDown: noop,
      onPointerMove: noop,
      onPointerHover: noop,
      onObjectSelect: noop,
      onOsmWaySelect: noop,
      onObjectRotate: noop,
      onCameraPoseChange: value => {
        pose = value;
      },
    });
    await frame();
    await frame();
    const gl = renderer.getContext();
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      count,
      osmFeatures: design.osmSnapshot.features.length,
      width,
      height,
      devicePixelRatio: devicePixelRatio,
      gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      multiDraw: Boolean(gl.getExtension('WEBGL_multi_draw')),
      gpuTimer: Boolean(gl.getExtension('EXT_disjoint_timer_query_webgl2')),
    };
  },
  begin() {
    phase = {
      frames: [],
      cpu: [],
      gpu: [],
      calls: [],
      triangles: [],
      pose: JSON.stringify(pose),
      startedAt: performance.now(),
    };
    previousFrame = null;
    animationFrame = requestAnimationFrame(sample);
  },
  end() {
    cancelAnimationFrame(animationFrame);
    const elapsed = performance.now() - phase.startedAt;
    const frames = phase.frames;
    const result = {
      durationMs: elapsed,
      frames: frames.length,
      averageFps: 1000 / (frames.reduce((a, b) => a + b, 0) / frames.length),
      frameP50: percentile(frames, 0.5),
      frameP95: percentile(frames, 0.95),
      frameP99: percentile(frames, 0.99),
      framesOver33ms: frames.filter(value => value > 33.3).length,
      cpuRenderP95: percentile(phase.cpu, 0.95),
      gpuP95: percentile(phase.gpu, 0.95),
      gpuSamples: phase.gpu.length,
      callsP95: percentile(phase.calls, 0.95),
      trianglesP95: percentile(phase.triangles, 0.95),
      pixelRatio: renderer.getPixelRatio(),
      cameraMoved: phase.pose !== JSON.stringify(pose),
    };
    phase = null;
    output.textContent = JSON.stringify(result, null, 2);
    return result;
  },
  quality() {
    let moving = false;
    scene.traverse(object => {
      if (object.name.endsWith(':moving') && object.visible) moving = true;
    });
    return { moving, pixelRatio: renderer.getPixelRatio() };
  },
  async interactions() {
    const selection = [],
      preview = [],
      insertion = [];
    const measure = async (samples, action) => {
      const start = performance.now();
      action();
      await frame();
      samples.push(performance.now() - start);
    };
    for (let i = 0; i < 10; i++)
      await measure(selection, () =>
        controller.updateSelection({
          selectedObjectId: `obj-${i}`,
          selectedOsmWayId: null,
          focusObjectId: null,
          focusOsmWayId: null,
          interactionMode: 'select',
          readOnly: false,
        })
      );
    for (let i = 0; i < 20; i++)
      await measure(preview, () =>
        controller.updatePlacementPreview({
          placementPreview: createCorridorPreview({ x: 0, z: 0 }, { x: 10 + i, z: 8 }, 3),
          placementPreviewType: 'street',
          placementStart: { x: 0, z: 0 },
        })
      );
    for (let i = 0; i < 5; i++)
      await measure(insertion, () => {
        design = {
          ...design,
          objects: [
            ...design.objects,
            createPointCityDesignObject({ id: `new-${i}`, type: 'tree', point: { x: i, z: 0 } }),
          ],
        };
        controller.updateDesign({ design, hiddenObjectIds: [], hiddenObjectCategories: [] });
      });
    return {
      selectionP95: percentile(selection, 0.95),
      previewP95: percentile(preview, 0.95),
      insertionP95: percentile(insertion, 0.95),
    };
  },
};
output.textContent = 'Ready';
