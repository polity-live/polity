// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({ render: vi.fn(), dispose: vi.fn(), loss: vi.fn() }));
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
import { createSpatialIntro, paintIntroSnapshot } from '../event-intro-renderer';
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
