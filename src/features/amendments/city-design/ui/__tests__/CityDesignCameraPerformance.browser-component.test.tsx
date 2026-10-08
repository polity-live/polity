import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { userEvent } from 'vitest/browser';
import { mountCityDesignScene, type CityDesignSceneController } from '../../logic/cityDesignScene';
import { createEmptyCityDesignState } from '../../state/cityDesignReducer';
import {
  createCorridorCityDesignObject,
  createPointCityDesignObject,
} from '../../logic/cityDesignPlacement';
import { unprojectLocalPointToGeo } from '../../logic/cityDesignProjection';
import type { CityDesignComparisonMode } from '../../types';

let controller: CityDesignSceneController | undefined;
afterEach(() => {
  controller?.dispose();
  controller = undefined;
  vi.restoreAllMocks();
  document.querySelectorAll('[data-camera-benchmark]').forEach(element => element.remove());
});

async function mount() {
  const canvas = document.createElement('canvas');
  canvas.dataset.cameraBenchmark = 'true';
  canvas.style.cssText = 'display:block;width:900px;height:600px';
  document.body.append(canvas);
  const design = createEmptyCityDesignState();
  design.comparisonMode = 'new_design';
  design.objects = [
    createPointCityDesignObject({ id: 'tree', type: 'tree', point: { x: 18, z: 8 } }),
    createCorridorCityDesignObject({
      id: 'building',
      type: 'building',
      start: { x: -22, z: 8 },
      end: { x: -12, z: 8 },
      width: 7,
    }),
    createCorridorCityDesignObject({
      id: 'street',
      type: 'street',
      start: { x: -25, z: -10 },
      end: { x: 25, z: -10 },
      width: 6,
    }),
    createCorridorCityDesignObject({
      id: 'grass',
      type: 'grass_strip',
      start: { x: -25, z: -16 },
      end: { x: 25, z: -16 },
      width: 3,
    }),
  ];
  design.osmSnapshot = {
    fetchedAt: 1,
    bbox: { south: 52.51, west: 13.39, north: 52.53, east: 13.42 },
    features: [
      {
        id: 'osm-road',
        kind: 'road',
        geometryKind: 'line',
        widthMeters: 6,
        points: [
          { x: -25, z: -10 },
          { x: 25, z: -10 },
        ].map(point => unprojectLocalPointToGeo(point, design.origin)),
      },
    ],
  };
  let renderedScene: THREE.Scene | undefined;
  let camera: THREE.Camera | undefined;
  let renderer: THREE.WebGLRenderer | undefined;
  vi.spyOn(THREE.Scene.prototype, 'onBeforeRender').mockImplementation(
    (currentRenderer, currentScene, currentCamera) => {
      renderedScene = currentScene;
      renderer = currentRenderer;
      camera = currentCamera;
    }
  );
  const onObjectSelect = vi.fn(),
    onOsmWaySelect = vi.fn();
  controller = await mountCityDesignScene({
    canvas,
    design,
    placementPreview: null,
    placementPreviewType: null,
    placementStart: null,
    selectedObjectId: null,
    selectedOsmWayId: null,
    hiddenObjectIds: [],
    hiddenObjectCategories: [],
    focusObjectId: null,
    focusOsmWayId: null,
    interactionMode: 'select',
    readOnly: false,
    initialCameraPose: { position: { x: 0, y: 110, z: 100 }, target: { x: 0, y: 0, z: 0 } },
    onPointerDown: vi.fn(),
    onPointerMove: vi.fn(),
    onPointerHover: vi.fn(),
    onObjectSelect,
    onOsmWaySelect,
    onObjectRotate: vi.fn(),
    onCameraPoseChange: vi.fn(),
  });
  await waitFor(() => expect(renderedScene).toBeDefined());
  const click = async (x: number, z: number, y = 0.27) => {
    const point = new THREE.Vector3(x, y, z).project(camera!);
    await userEvent.click(canvas, {
      position: {
        x: ((point.x + 1) * canvas.clientWidth) / 2,
        y: ((1 - point.y) * canvas.clientHeight) / 2,
      },
    });
  };
  return {
    canvas,
    design,
    scene: renderedScene!,
    renderer: renderer!,
    click,
    onObjectSelect,
    onOsmWaySelect,
  };
}

it('raycasts hidden selection surfaces and volumes in every comparison mode and retains independent multi-selection', async () => {
  const { design, scene, click, onObjectSelect, onOsmWaySelect } = await mount();
  const street = scene.getObjectByName('design:street')!;
  const root = street.parent!.getObjectByName('city-design-render-batches')!;
  const baseBuffers = root.children.map(object => (object as THREE.Mesh).geometry);
  const picks: THREE.Object3D[] = [];
  street.traverse(object => {
    if (object.userData.pickTarget) picks.push(object);
  });
  expect(picks.length).toBeGreaterThan(0);
  expect(picks.every(object => !object.visible)).toBe(true);
  await click(-18, -10);
  expect(onObjectSelect).toHaveBeenLastCalledWith('street');
  await click(-17, 8, 9.28);
  expect(onObjectSelect).toHaveBeenLastCalledWith('building');
  await click(18, 8, 2);
  expect(onObjectSelect).toHaveBeenLastCalledWith('tree');
  controller!.updateSelection({
    selectedObjectId: 'tree',
    selectedObjectIds: ['tree', 'building'],
    selectedOsmWayId: null,
    focusObjectId: null,
    focusOsmWayId: null,
    interactionMode: 'select',
    readOnly: false,
  });
  expect(baseBuffers.length).toBeGreaterThan(0);
  await waitFor(() =>
    expect(root.children.map(object => (object as THREE.Mesh).geometry)).toEqual(baseBuffers)
  );
  for (const mode of ['overlay', 'split', 'original', 'new_design'] as CityDesignComparisonMode[]) {
    controller!.updateDesign({
      design: { ...design, comparisonMode: mode },
      hiddenObjectIds: [],
      hiddenObjectCategories: [],
    });
    await new Promise(requestAnimationFrame);
    const original = mode === 'original';
    const offset = mode === 'split' ? 52 : 0;
    await click(-18 + offset, -10);
    expect(original ? onOsmWaySelect : onObjectSelect).toHaveBeenLastCalledWith(
      original ? 'osm-road' : 'street'
    );
    if (mode === 'split') {
      await click(-18 - 52, -10);
      expect(onOsmWaySelect).toHaveBeenLastCalledWith('osm-road');
    }
  }
}, 30_000);

it('uses prebuilt moving quality during keyboard and focus navigation, restores full quality, and leaves static matrices and shadows cached', async () => {
  const { scene, renderer, canvas } = await mount();
  const source = scene.getObjectByName('design:tree')!;
  const updates = vi.spyOn(source, 'updateMatrixWorld');
  const movingBatches = () => {
    const batches: THREE.Object3D[] = [];
    scene.traverse(object => {
      if (object.name.endsWith(':moving')) batches.push(object);
    });
    return batches;
  };
  const geometry = movingBatches().map(object => (object as THREE.Mesh).geometry);
  expect(movingBatches().every(object => !object.visible)).toBe(true);
  const fullRatio = Math.min(devicePixelRatio, 1.5);
  controller!.focusObject('tree');
  await waitFor(() => expect(movingBatches().some(object => object.visible)).toBe(true));
  expect(renderer.getPixelRatio()).toBeLessThanOrEqual(1);
  await waitFor(() => expect(movingBatches().every(object => !object.visible)).toBe(true), {
    timeout: 5000,
  });
  expect(renderer.getPixelRatio()).toBe(fullRatio);
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  expect(movingBatches().every(object => !object.visible)).toBe(true);
  expect(movingBatches().map(object => (object as THREE.Mesh).geometry)).toEqual(geometry);
  expect(renderer.shadowMap.needsUpdate).toBe(false);
  expect(updates).not.toHaveBeenCalled();
  const keyboardFrames: { moving: boolean; pixelRatio: number }[] = [];
  vi.spyOn(scene, 'onBeforeRender').mockImplementation(() => {
    keyboardFrames.push({
      moving: movingBatches().some(object => object.visible),
      pixelRatio: renderer.getPixelRatio(),
    });
  });
  canvas.focus();
  await userEvent.keyboard('{ArrowRight}');
  await waitFor(() => expect(keyboardFrames.some(frame => frame.moving)).toBe(true));
  expect(keyboardFrames.filter(frame => frame.moving).every(frame => frame.pixelRatio <= 1)).toBe(
    true
  );
  await waitFor(() => expect(movingBatches().every(object => !object.visible)).toBe(true));
  expect(renderer.getPixelRatio()).toBe(fullRatio);
  expect(movingBatches().map(object => (object as THREE.Mesh).geometry)).toEqual(geometry);
  expect(renderer.shadowMap.needsUpdate).toBe(false);
  expect(updates).not.toHaveBeenCalled();
}, 30_000);
