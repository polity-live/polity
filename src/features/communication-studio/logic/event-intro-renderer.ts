import * as THREE from 'three';
import type { FrameNode } from './document-v3';
import { activePalette, type StudioThemeSnapshot } from './theme';
import { introPhase } from './event-intro';
import { createIllustratedDemocracy, createSculpturalDemocracy } from './democracy-intro';

/** Six camera passages dissolve into one another, including the 90-second loop boundary.
 * One scene and one GPU context serve both the live output and frozen exports. */
export function createSpatialIntro(
  width: number,
  height: number,
  theme: StudioThemeSnapshot,
  variant?: NonNullable<FrameNode['intro']>['scene']
) {
  if (variant === 'democracy-illustrated') return createIllustratedDemocracy(width, height, theme);
  if (variant === 'democracy-sculptural') return createSculpturalDemocracy(width, height, theme);
  const palette = activePalette(theme);
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1920 / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Intro canvas unavailable');
  const webglCanvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas: webglCanvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(canvas.width, canvas.height, false);
  renderer.setPixelRatio(1);
  const darkness = new THREE.Color(palette.brand).multiplyScalar(0.16);
  renderer.setClearColor(darkness);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(darkness, 18, 52);
  const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 80);
  const group = new THREE.Group();
  scene.add(group);
  scene.add(new THREE.HemisphereLight(palette.highlight, palette.brand, 0.8));
  const light = new THREE.DirectionalLight(palette.highlight, 4.5);
  scene.add(light);
  const rim = new THREE.PointLight(palette.accent, 170, 40);
  scene.add(rim);
  const fill = new THREE.PointLight(palette.highlight, 110, 35);
  scene.add(fill);
  const block = new THREE.BoxGeometry(1, 1, 1);
  const ringGeometry = new THREE.TorusGeometry(3.4, 0.12, 12, 96);
  const materials = [palette.brand, palette.highlight, palette.accent].map(
    color => new THREE.MeshStandardMaterial({ color, metalness: 0.72, roughness: 0.24 })
  );
  const glow = new THREE.MeshBasicMaterial({ color: palette.highlight });
  // Layered civic architecture: close foreground fins, distant colonnades and a suspended seal.
  for (let i = 0; i < 28; i++) {
    const column = new THREE.Mesh(block, materials[i % 3]);
    const side = i % 2 === 0 ? -1 : 1;
    column.position.set(side * (4 + (i % 5) * 0.7), 0, 5 - Math.floor(i / 2) * 1.1);
    column.scale.set(0.55 + (i % 3) * 0.25, 5 + (i % 4) * 1.2, 0.8);
    column.rotation.y = side * 0.2;
    group.add(column);
    const line = new THREE.Mesh(block, glow);
    line.position.copy(column.position);
    line.position.x -= side * 0.32;
    line.scale.set(0.035, column.scale.y * 0.8, 0.04);
    group.add(line);
  }
  const floor = new THREE.Mesh(block, materials[0]);
  floor.position.set(0, -4.5, -4);
  floor.scale.set(28, 0.2, 40);
  group.add(floor);
  const seal = new THREE.Mesh(ringGeometry, materials[2]);
  seal.position.set(0, 1, -7);
  group.add(seal);
  for (let i = 0; i < 8; i++) {
    const panel = new THREE.Mesh(block, materials[1]);
    panel.position.set((i - 3.5) * 1.2, 1, -10);
    panel.scale.set(0.35, 8, 0.12);
    panel.rotation.z = -0.3;
    group.add(panel);
  }
  const dustGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(180 * 3);
  for (let i = 0; i < positions.length; i++) {
    // Deterministic particles keep independent screens and exports identical.
    const n = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    positions[i] = (n - Math.floor(n) - 0.5) * (i % 3 === 2 ? 28 : 20);
  }
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dustMaterial = new THREE.PointsMaterial({
    color: palette.highlight,
    size: 0.035,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  scene.add(dust);
  const shots = [
    { yaw: 0.32, sweep: 0.58, radius: 16, travel: -5, height: 3.5, rise: -3 },
    { yaw: -0.72, sweep: 0.48, radius: 10, travel: 4, height: -1, rise: 2 },
    { yaw: 0.9, sweep: -0.5, radius: 12, travel: -4, height: 7, rise: -4 },
    { yaw: -0.2, sweep: -0.55, radius: 17, travel: -6, height: 1, rise: 3 },
    { yaw: 0.65, sweep: -0.8, radius: 9, travel: 5, height: -2, rise: 3 },
    { yaw: -0.6, sweep: 0.85, radius: 14, travel: 2, height: 5, rise: -3 },
  ];
  const target = new THREE.Vector3();
  let lost = false;
  const onLost = (event: Event) => {
    event.preventDefault();
    lost = true;
  };
  const onRestored = () => {
    lost = false;
  };
  webglCanvas.addEventListener('webglcontextlost', onLost);
  webglCanvas.addEventListener('webglcontextrestored', onRestored);
  function drawShot(index: number, seconds: number, motion: number, alpha: number) {
    const shot = shots[index];
    const progress = seconds / 16.5;
    const yaw = shot.yaw + shot.sweep * progress * motion;
    const radius = (shot.radius + shot.travel * progress * motion) * (width < height ? 1.2 : 1);
    camera.position.set(
      Math.sin(yaw) * radius,
      shot.height + shot.rise * progress * motion,
      Math.cos(yaw) * radius - 3
    );
    // Leave a consistent, calm text area regardless of camera direction.
    const offset = width < height ? 0 : 3.6;
    target.set(-Math.cos(yaw) * offset, width < height ? 3.2 : 0, -5 + Math.sin(yaw) * offset);
    camera.lookAt(target);
    renderer.render(scene, camera);
    if (!ctx) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(webglCanvas, 0, 0);
  }
  return {
    canvas,
    webglCanvas,
    render(elapsedMs: number, intensity: number) {
      if (lost) return false;
      const phase = intensity === 0 ? 0 : introPhase(elapsedMs);
      const angle = phase * Math.PI * 2;
      const motion = Math.min(1, Math.max(0, intensity)) * 1.6;
      light.position.set(Math.sin(angle * 3) * 10, 6, 5 + Math.cos(angle * 3) * 6);
      rim.position.set(Math.cos(angle * 2) * 7, -1, Math.sin(angle * 2) * 9 - 4);
      fill.position.set(-4, 5 + Math.sin(angle * 3) * 3, -8);
      seal.rotation.set(
        0.12 + Math.sin(angle) * 0.18 * motion,
        Math.sin(angle) * 0.6 * motion,
        -0.2
      );
      dust.rotation.y = Math.sin(angle) * 0.25 * motion;
      dust.position.y = Math.cos(angle) * 0.8 * motion;
      const seconds = phase * 90;
      const index = Math.min(5, Math.floor(seconds / 15));
      const local = seconds - index * 15;
      ctx.globalAlpha = 1;
      drawShot(index, local + 1.5, motion, 1);
      if (local > 13.5) {
        const blend = (local - 13.5) / 1.5;
        drawShot((index + 1) % 6, local - 13.5, motion, blend * blend * (3 - 2 * blend));
      }
      ctx.globalAlpha = 1;
      return true;
    },
    dispose() {
      webglCanvas.removeEventListener('webglcontextlost', onLost);
      webglCanvas.removeEventListener('webglcontextrestored', onRestored);
      block.dispose();
      ringGeometry.dispose();
      dustGeometry.dispose();
      materials.forEach(material => material.dispose());
      glow.dispose();
      dustMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

/** A theme wash makes editable text readable without recoloring uploaded footage. */
export function paintIntroWash(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: StudioThemeSnapshot,
  variant?: NonNullable<FrameNode['intro']>['scene']
) {
  const background = activePalette(theme).background;
  const cinematic = variant && variant !== 'architecture';
  const wash = ctx.createLinearGradient(
    0,
    0,
    width < height ? 0 : width,
    width < height ? height : 0
  );
  ctx.save();
  wash.addColorStop(0, background);
  wash.addColorStop(width < height ? 0.48 : cinematic ? 0.28 : 0.38, background + 'ed');
  wash.addColorStop(
    width < height ? 0.75 : cinematic ? 0.55 : 0.68,
    background + (cinematic ? '18' : '70')
  );
  wash.addColorStop(1, background + '08');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);
  // Long, manually editable titles can span the full width of the upper third.
  if (width >= height) {
    const titleWash = ctx.createLinearGradient(0, 0, 0, height);
    titleWash.addColorStop(0, background + 'ed');
    titleWash.addColorStop(0.3, background + 'd9');
    titleWash.addColorStop(cinematic ? 0.42 : 0.5, background + '00');
    ctx.fillStyle = titleWash;
    ctx.fillRect(0, 0, width, height);
  }
  if (width < height && variant && variant !== 'architecture') {
    // The cover's portrait countdown sits below the title area; retain contrast across moving motifs.
    const counterWash = ctx.createLinearGradient(0, height * 0.69, 0, height * 0.86);
    counterWash.addColorStop(0, background + '00');
    counterWash.addColorStop(0.28, background + 'ed');
    counterWash.addColorStop(0.72, background + 'ed');
    counterWash.addColorStop(1, background + '00');
    ctx.fillStyle = counterWash;
    ctx.fillRect(0, height * 0.69, width, height * 0.17);
  }
  ctx.restore();
}

export async function paintIntroSnapshot(
  ctx: CanvasRenderingContext2D,
  frame: FrameNode,
  theme: StudioThemeSnapshot,
  media: Record<string, string>
) {
  const intro = frame.intro;
  if (!intro || intro.mode === 'static') return;
  const { width, height } = frame.transform;
  if (intro.mode === 'spatial') {
    let scene: ReturnType<typeof createSpatialIntro> | undefined;
    try {
      scene = createSpatialIntro(width, height, theme, intro.scene);
      scene.render(
        (intro.snapshotAt ?? intro.epochMs ?? 0) - (intro.epochMs ?? 0),
        intro.intensity
      );
      ctx.drawImage(scene.canvas, 0, 0, width, height);
    } catch {
      /* A graphics failure leaves the theme background intact. */
    } finally {
      scene?.dispose();
    }
  } else if (intro.assetId && media[intro.assetId]) {
    const source = media[intro.assetId];
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Intro video timed out')), 15_000);
        video.onloadeddata = () => {
          clearTimeout(timeout);
          resolve();
        };
        video.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Intro video unavailable'));
        };
        video.src = source;
      });
      const duration = video.duration;
      const elapsed = ((intro.snapshotAt ?? intro.epochMs ?? 0) - (intro.epochMs ?? 0)) / 1000;
      const target =
        Number.isFinite(duration) && duration > 0
          ? ((elapsed % duration) + duration) % duration
          : 0;
      if (target > 0)
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Intro video seek timed out')), 10_000);
          video.onseeked = () => {
            clearTimeout(timeout);
            resolve();
          };
          video.currentTime = target;
        });
      const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
      ctx.drawImage(
        video,
        (width - video.videoWidth * scale) / 2,
        (height - video.videoHeight * scale) / 2,
        video.videoWidth * scale,
        video.videoHeight * scale
      );
    } catch {
      /* Keep a usable snapshot even if a video cannot be decoded. */
    } finally {
      video.onloadeddata = null;
      video.onseeked = null;
      video.onerror = null;
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  }
  paintIntroWash(ctx, width, height, theme, intro.scene);
}
