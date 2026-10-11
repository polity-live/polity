// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({
  render: vi.fn(),
  dispose: vi.fn(),
  loss: vi.fn(),
  composerDispose: vi.fn(),
  passDispose: vi.fn(),
}));
vi.mock('three/addons/postprocessing/EffectComposer.js', () => ({
  EffectComposer: class {
    passes: any[] = [];
    addPass(pass: any) {
      this.passes.push(pass);
    }
    setSize = vi.fn();
    render() {
      io.render(this.passes[0].scene, this.passes[0].camera);
    }
    dispose = io.composerDispose;
  },
}));
vi.mock('three/addons/postprocessing/RenderPass.js', () => ({
  RenderPass: class {
    constructor(
      public scene: any,
      public camera: any
    ) {}
    dispose = io.passDispose;
  },
}));
vi.mock('three/addons/postprocessing/BokehPass.js', () => ({
  BokehPass: class {
    materialBokeh = { uniforms: { focus: { value: 14 } } };
    dispose = io.passDispose;
  },
}));
vi.mock('three/addons/postprocessing/OutputPass.js', () => ({
  OutputPass: class {
    dispose = io.passDispose;
  },
}));
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>();
  return {
    ...actual,
    WebGLRenderer: class {
      shadowMap = { enabled: false, type: 0 };
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
import { createCinematicDemocracy } from '../democracy-cinematic';
import { createEventTemplate } from '../event-templates';
import { createSpatialIntro, paintIntroSnapshot } from '../event-intro-renderer';

let ctx: CanvasRenderingContext2D;
beforeEach(() => {
  // Only record operations asserted below. Minute-by-minute rendering otherwise
  // retains hundreds of thousands of unused primitive calls under coverage.
  ctx = Object.fromEntries(
    [
      'save',
      'restore',
      'translate',
      'scale',
      'rotate',
      'beginPath',
      'moveTo',
      'lineTo',
      'closePath',
      'fill',
      'stroke',
      'arc',
      'fillRect',
      'drawImage',
    ].map(key => [key, key === 'fill' || key === 'drawImage' ? vi.fn() : () => undefined])
  ) as any;
  ctx.createLinearGradient = () => ({ addColorStop: vi.fn() }) as any;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as any);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

it('fails before allocating GPU resources when a drawing context is unavailable', () => {
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
  const theme = createEventTemplate('cover', crypto.randomUUID()).theme;
  expect(() => createIllustratedDemocracy(1920, 1080, theme)).toThrow('Intro canvas unavailable');
  expect(() => createCinematicDemocracy(1920, 1080, theme, [])).toThrow('Intro canvas unavailable');
  expect(io.render).not.toHaveBeenCalled();
});

it('keeps illustrated motion stationary when intensity is zero', () => {
  ctx.rotate = vi.fn();
  const scene = createIllustratedDemocracy(
    1920,
    1080,
    createEventTemplate('cover', crypto.randomUUID()).theme
  );
  scene.render(0, 0);
  const rotations = vi.mocked(ctx.rotate).mock.calls.map(call => [...call]);
  vi.mocked(ctx.rotate).mockClear();
  scene.render(5000, 0);
  expect(vi.mocked(ctx.rotate).mock.calls).toEqual(rotations);
  scene.dispose();
});

it('renders scalable illustrations without a GPU and disposes their bounded backing canvas', () => {
  const scene = createIllustratedDemocracy(
    2160,
    3840,
    createEventTemplate('cover', crypto.randomUUID()).theme
  );
  const backingSize = [scene.canvas.width, scene.canvas.height];
  expect(backingSize).toEqual([1080, 1920]);
  expect(scene.canvas.height).toBe(1920);
  for (let minute = 0; minute <= 1440; minute++)
    expect(scene.render(minute * 60000, 0.45)).toBe(true);
  expect([scene.canvas.width, scene.canvas.height]).toEqual(backingSize);
  expect(ctx.fill).toHaveBeenCalled();
  expect(io.render).not.toHaveBeenCalled();
  scene.dispose();
  expect(scene.canvas.width).toBe(1);
  expect(scene.render(0, 0.45)).toBe(false);
});
it('animates sculpted symbols, restores context and releases every unique GPU resource', () => {
  const geometry = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
  const material = vi.spyOn(THREE.Material.prototype, 'dispose');
  const texture = vi.spyOn(THREE.Texture.prototype, 'dispose');
  const scene = createSculpturalDemocracy(
    3840,
    2160,
    createEventTemplate('cover', crypto.randomUUID()).theme
  );
  scene.render(0, 0.45);
  const [world, camera] = io.render.mock.calls.at(-1)!;
  const position = camera.position.toArray();
  scene.render(86400000, 0.45);
  expect(camera.position.toArray()).toEqual(position);
  scene.render(15000, 0);
  expect(camera.position.toArray()).toEqual(position);
  scene.render(-1, 0.45);
  expect(camera.position.distanceTo(new THREE.Vector3(...position))).toBeLessThan(0.003);
  const allocated = new Set<THREE.BufferGeometry>();
  world.traverse((node: any) => {
    if (node.geometry) allocated.add(node.geometry);
  });
  scene.render(7000, 0.45);
  expect(camera.position.toArray()).not.toEqual(position);
  for (let i = 0; i < 6; i++) {
    scene.render(i * 15000, 0.45);
    expect(world.children.filter((n: any) => n.type === 'Group' && n.visible)).toHaveLength(6);
  }
  scene.render(89999, 0.45);
  const end = camera.position.clone();
  scene.render(90000, 0.45);
  expect(camera.position.distanceTo(end)).toBeLessThan(0.003);
  for (let minute = 0; minute <= 1440; minute++)
    expect(scene.render(minute * 60000, 0.45)).toBe(true);
  scene.webglCanvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  expect(scene.render(0, 0.45)).toBe(false);
  scene.webglCanvas.dispatchEvent(new Event('webglcontextrestored'));
  expect(scene.render(0, 0.45)).toBe(true);
  scene.dispose();
  scene.dispose();
  expect(geometry).toHaveBeenCalledTimes(allocated.size);
  expect(material).toHaveBeenCalledTimes(8);
  expect(texture).toHaveBeenCalledOnce();
  expect(io.dispose).toHaveBeenCalledOnce();
  expect(io.loss).toHaveBeenCalledOnce();
  expect(io.composerDispose).toHaveBeenCalledOnce();
  expect(io.passDispose).toHaveBeenCalledTimes(3);
});
it.each(['democracy-illustrated', 'democracy-sculptural'] as const)(
  'freezes %s with the same live renderer for exports',
  async variant => {
    const doc = createEventTemplate('cover', crypto.randomUUID()),
      frame = doc.nodes[0];
    if (frame.type !== 'frame' || !frame.intro) throw new Error('cover');
    frame.intro.scene = variant;
    frame.intro.epochMs = 1000;
    frame.intro.snapshotAt = 32000;
    await paintIntroSnapshot(ctx, frame, doc.theme, {});
    expect(ctx.drawImage).toHaveBeenCalled();
    const live = createSpatialIntro(1920, 1080, doc.theme, variant);
    expect(live.render(31000, 0.45)).toBe(true);
    live.dispose();
  }
);
