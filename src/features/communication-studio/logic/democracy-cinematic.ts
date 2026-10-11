import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { activePalette, type StudioThemeSnapshot } from './theme';
import { introPhase } from './event-intro';

export function positionCinematicCamera(
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
  angle: number,
  motion: number
) {
  const radius = (width < height ? 29 : 25) + Math.sin(angle * 6) * motion * 1.6;
  camera.position.set(
    Math.sin(angle) * radius,
    2.3 + Math.sin(angle * 3) * motion,
    Math.cos(angle) * radius
  );
  const shift = width < height ? 0 : 2.5;
  camera.lookAt(
    Math.sin(angle) * 10 - Math.cos(angle) * shift,
    width < height ? 4.4 : 1.8,
    Math.cos(angle) * 10 + Math.sin(angle) * shift
  );
  camera.updateMatrixWorld();
}

/** A continuous camera orbit through six physical tableaux, rather than six icon slides. */
export function createCinematicDemocracy(
  width: number,
  height: number,
  theme: StudioThemeSnapshot,
  names: readonly string[]
) {
  const palette = activePalette(theme),
    canvas = document.createElement('canvas');
  const scale = Math.min(1, 1920 / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Intro canvas unavailable');
  const webglCanvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas: webglCanvas,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(canvas.width, canvas.height, false);
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const night = new THREE.Color(palette.brand).multiplyScalar(0.055);
  renderer.setClearColor(night);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(night, 0.025);
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
  const composer = new EffectComposer(renderer);
  const imagePass = new RenderPass(scene, camera);
  const lensPass = new BokehPass(scene, camera, { focus: 14, aperture: 0.0003, maxblur: 0.012 });
  const outputPass = new OutputPass();
  composer.addPass(imagePass);
  composer.addPass(lensPass);
  composer.addPass(outputPass);
  composer.setSize(canvas.width, canvas.height);
  const focus = lensPass.materialBokeh.uniforms['focus'];
  const focalPoint = new THREE.Vector3();
  const geometries: THREE.BufferGeometry[] = [];
  const geometry = <T extends THREE.BufferGeometry>(value: T) => {
    geometries.push(value);
    return value;
  };
  const box = geometry(new THREE.BoxGeometry(1, 1, 1));
  const sphere = geometry(new THREE.SphereGeometry(1, 24, 16));
  const cylinder = geometry(new THREE.CylinderGeometry(1, 1, 1, 24));
  const cone = geometry(new THREE.ConeGeometry(1, 1, 16));
  // Deterministic fine grain gives the sculpted objects a tactile surface on every output.
  const grainPixels = new Uint8Array(64 * 64 * 4);
  for (let i = 0; i < grainPixels.length; i += 4) {
    const seed = Math.sin(i * 17.13) * 43758.5453;
    const value = 150 + Math.floor((seed - Math.floor(seed)) * 80);
    grainPixels.set([value, value, value, 255], i);
  }
  const grain = new THREE.DataTexture(grainPixels, 64, 64);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(8, 8);
  grain.needsUpdate = true;
  const materials = {
    stone: new THREE.MeshStandardMaterial({
      color: palette.brand,
      roughness: 0.4,
      metalness: 0.25,
    }),
    ivory: new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.65, metalness: 0 }),
    paper: new THREE.MeshStandardMaterial({ color: palette.highlight, roughness: 0.75 }),
    brass: new THREE.MeshStandardMaterial({
      color: palette.accent,
      roughness: 0.27,
      metalness: 0.65,
    }),
    ink: new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.brand).multiplyScalar(0.18),
      roughness: 0.25,
    }),
    screen: new THREE.MeshStandardMaterial({
      color: palette.brand,
      emissive: palette.brand,
      emissiveIntensity: 0.4,
      roughness: 0.2,
    }),
    luminous: new THREE.MeshBasicMaterial({
      color: palette.highlight,
      transparent: true,
      opacity: 0.45,
    }),
  };
  for (const finish of [materials.stone, materials.ivory, materials.paper, materials.brass]) {
    finish.bumpMap = grain;
    finish.bumpScale = 0.025;
  }
  type Finish = keyof typeof materials;
  const mesh = (
    parent: THREE.Object3D,
    shape: THREE.BufferGeometry,
    finish: Finish,
    position: number[],
    size: number[]
  ) => {
    const result = new THREE.Mesh(shape, materials[finish]);
    result.position.set(position[0], position[1], position[2]);
    result.scale.set(size[0], size[1], size[2]);
    result.castShadow = result.receiveShadow = finish !== 'luminous';
    parent.add(result);
    return result;
  };
  const block = (parent: THREE.Object3D, finish: Finish, position: number[], size: number[]) =>
    mesh(parent, box, finish, position, size);
  const orb = (parent: THREE.Object3D, finish: Finish, position: number[], size: number[]) =>
    mesh(parent, sphere, finish, position, size);
  const link = (
    parent: THREE.Object3D,
    from: THREE.Vector3,
    to: THREE.Vector3,
    finish: Finish,
    radius = 0.018
  ) => {
    const line = mesh(
      parent,
      cylinder,
      finish,
      from.clone().add(to).multiplyScalar(0.5).toArray(),
      [radius, from.distanceTo(to), radius]
    );
    line.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      to.clone().sub(from).normalize()
    );
  };
  const featherWings: THREE.Group[] = [],
    birds: THREE.Group[] = [],
    ballots: THREE.Group[] = [];
  function dove(parent: THREE.Object3D, position: number[], size = 1) {
    const bird = new THREE.Group();
    bird.position.set(position[0], position[1], position[2]);
    bird.scale.setScalar(size);
    parent.add(bird);
    birds.push(bird);
    orb(bird, 'ivory', [0, 0, 0], [0.9, 0.36, 0.38]);
    orb(bird, 'ivory', [0.72, 0.32, 0], [0.36, 0.39, 0.3]);
    orb(bird, 'ivory', [1, 0.55, 0], [0.25, 0.24, 0.22]);
    orb(bird, 'ink', [1.13, 0.61, 0.205], [0.027, 0.027, 0.025]);
    const beak = mesh(bird, cone, 'brass', [1.3, 0.51, 0], [0.065, 0.23, 0.065]);
    beak.rotation.z = -Math.PI / 2;
    for (let i = 0; i < 5; i++) {
      const tail = orb(bird, 'ivory', [-1.07, 0.05, (i - 2) * 0.14], [0.65, 0.08, 0.13]);
      tail.rotation.y = (i - 2) * 0.16;
      tail.rotation.z = -0.16;
    }
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(-0.12, 0.2, side * 0.18);
      wing.rotation.x = side * 0.3;
      bird.add(wing);
      featherWings.push(wing);
      orb(wing, 'ivory', [-0.15, 0.5, side * 0.3], [0.5, 0.65, 0.13]);
      for (let i = 0; i < 8; i++) {
        const feather = orb(
          wing,
          'ivory',
          [-0.6 + i * 0.12, 0.85 + i * 0.035, side * (0.42 + i * 0.09)],
          [0.15, 0.72 - i * 0.045, 0.075]
        );
        feather.rotation.z = 0.38 - i * 0.05;
        feather.rotation.x = side * 0.25;
      }
    }
    link(bird, new THREE.Vector3(1.43, 0.42, 0), new THREE.Vector3(1.8, 0.07, 0.1), 'brass', 0.018);
    for (let i = 0; i < 5; i++) {
      const leaf = orb(
        bird,
        'brass',
        [1.48 + i * 0.055, 0.33 - i * 0.045, 0.04],
        [0.11, 0.035, 0.05]
      );
      leaf.rotation.z = i % 2 ? -0.7 : 0.4;
    }
    return bird;
  }
  function person(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    finish: Finish = 'paper'
  ) {
    orb(parent, finish, [x, y + 0.85, z], [0.17, 0.2, 0.17]);
    mesh(parent, cylinder, finish, [x, y + 0.35, z], [0.22, 0.65, 0.22]);
  }
  function page(parent: THREE.Object3D, x: number, y: number, z: number) {
    const sheet = new THREE.Group();
    sheet.position.set(x, y, z);
    parent.add(sheet);
    block(sheet, 'paper', [0, 0, 0], [1.25, 1.7, 0.025]);
    for (let i = 0; i < 9; i++)
      block(
        sheet,
        'ink',
        [i % 3 === 0 ? -0.06 : 0, 0.64 - i * 0.14, 0.022],
        [i % 3 === 0 ? 0.86 : 1, 0.018, 0.009]
      );
    return sheet;
  }
  function computer(parent: THREE.Object3D, x: number, y: number, z: number) {
    const device = new THREE.Group();
    device.position.set(x, y, z);
    parent.add(device);
    block(device, 'ink', [0, 0.7, 0], [2.5, 1.6, 0.22]);
    block(device, 'screen', [0, 0.7, 0.12], [2.27, 1.37, 0.035]);
    for (let i = 0; i < 5; i++)
      block(
        device,
        'luminous',
        [-0.25 + i * 0.07, 0.98 - i * 0.14, 0.15],
        [1.3 - i * 0.12, 0.018, 0.01]
      );
    block(device, 'brass', [0, -0.35, -0.06], [0.19, 0.65, 0.2]);
    block(device, 'ink', [0, -0.68, 0.25], [1.6, 0.08, 0.9]);
    const keyboard = block(device, 'ink', [0, -0.65, 1.05], [1.8, 0.07, 0.6]);
    keyboard.rotation.x = 0.07;
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 12; col++)
        block(device, 'brass', [(col - 5.5) * 0.13, -0.6, 0.86 + row * 0.14], [0.1, 0.012, 0.09]);
  }
  names.forEach((name, i) => {
    const stage = new THREE.Group(),
      angle = (i * Math.PI) / 3;
    stage.name = name;
    stage.position.set(Math.sin(angle) * 12, 0, Math.cos(angle) * 12);
    stage.rotation.y = angle;
    scene.add(stage);
    mesh(stage, cylinder, 'stone', [0, -2.15, 0], [4.3, 0.25, 3.1]);
    if (i === 0) {
      dove(stage, [0, 0.7, 0], 1.4);
      for (let j = 0; j < 7; j++)
        block(stage, 'brass', [(j - 3) * 0.65, -1.4, -1.8], [0.015, 4, 0.025]);
    }
    if (i === 1) {
      for (let j = 0; j < 9; j++) {
        const a = (j * Math.PI * 2) / 9;
        person(stage, Math.cos(a) * 2.3, -1.9, Math.sin(a) * 1.4);
      }
      for (let j = 0; j < 3; j++) {
        const sheet = page(stage, (j - 1) * 1.4, 0.7, -0.8 - j * 0.2);
        sheet.rotation.y = (j - 1) * 0.24;
        sheet.rotation.z = (j - 1) * -0.08;
      }
      block(stage, 'stone', [0, -0.9, 0], [3.5, 0.2, 1.8]);
    }
    if (i === 2) {
      block(stage, 'stone', [0, -0.8, 0], [2.25, 2, 1.6]);
      block(stage, 'brass', [0, 0.24, 0], [2.4, 0.16, 1.72]);
      block(stage, 'ink', [0, 0.335, 0], [1.45, 0.025, 0.13]);
      const sheet = page(stage, 0, 1.4, 0);
      sheet.rotation.x = -0.17;
      ballots.push(sheet);
      for (let j = 0; j < 3; j++) person(stage, -2.6 + j * 0.45, -1.9, -1.5);
    }
    if (i === 3) {
      for (let j = 0; j < 8; j++) {
        const note = new THREE.Group();
        note.position.set(-0.6 + j * 0.06, 0.15 + j * 0.09, 1 - j * 0.1);
        note.rotation.set(-0.35, 0.1 + j * 0.012, -0.08);
        stage.add(note);
        block(note, 'paper', [0, 0, 0], [3.1, 1.35, 0.028]);
        block(note, 'ink', [0, 0, 0.02], [2.84, 1.09, 0.014]);
        orb(note, 'brass', [0, 0, 0.04], [0.32, 0.43, 0.008]);
        for (const x of [-1, 1])
          for (let line = 0; line < 4; line++)
            block(note, 'paper', [x * 0.95, 0.28 - line * 0.18, 0.04], [0.35, 0.02, 0.006]);
      }
      for (let j = 0; j < 5; j++)
        mesh(stage, cylinder, 'paper', [(j - 2) * 0.6, -1.2, -1.8], [0.12, 1.65, 0.12]);
      block(stage, 'stone', [0, -2.05, -1.8], [3.4, 0.2, 1.2]);
      block(stage, 'brass', [0, -0.28, -1.8], [3.5, 0.18, 1.3]);
    }
    if (i === 4) {
      computer(stage, 0, 0, 0);
      for (let j = 0; j < 7; j++) {
        const a = (j * Math.PI * 2) / 7,
          x = Math.cos(a) * 3,
          z = Math.sin(a) * 2;
        person(stage, x, -1.9, z);
        link(stage, new THREE.Vector3(x, -1.95, z), new THREE.Vector3(0, -1.95, 0), 'brass', 0.018);
      }
    }
    if (i === 5) {
      dove(stage, [0, 1.2, 0], 0.9);
      computer(stage, 1.8, -0.8, -0.6);
      page(stage, -2, 0.2, -0.7).rotation.y = 0.25;
      for (let j = 0; j < 4; j++) person(stage, (j - 1.5) * 0.8, -1.9, 1.1);
    }
  });
  const floor = mesh(scene, cylinder, 'ink', [0, -2.6, 0], [38, 0.3, 38]);
  floor.name = 'civic-ground';
  const timelineGeometry = geometry(new THREE.TorusGeometry(12, 0.018, 6, 192));
  const timeline = new THREE.Mesh(timelineGeometry, materials.brass);
  timeline.rotation.x = Math.PI / 2;
  timeline.position.y = -2.38;
  scene.add(timeline);
  // Passing foreground fins, light ribbons and distant pillars provide physical parallax.
  for (let i = 0; i < 36; i++) {
    const a = ((i + 0.5) * Math.PI) / 18;
    const column = block(scene, 'stone', [Math.sin(a) * 19, 1, Math.cos(a) * 19], [0.22, 9, 0.45]);
    column.rotation.y = a;
    block(scene, 'luminous', [Math.sin(a) * 19.1, 1, Math.cos(a) * 19.1], [0.025, 7, 0.028]);
  }
  const dustGeometry = geometry(new THREE.BufferGeometry()),
    positions = new Float32Array(600);
  for (let i = 0; i < positions.length; i++) {
    const n = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    positions[i] = (n - Math.floor(n) - 0.5) * (i % 3 === 1 ? 12 : 50);
  }
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dustMaterial = new THREE.PointsMaterial({
    color: palette.highlight,
    size: 0.025,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  });
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  scene.add(dust);
  scene.add(new THREE.HemisphereLight(palette.highlight, palette.brand, 0.45));
  const key = new THREE.DirectionalLight('#FFFFFF', 3.1);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, {
    left: -20,
    right: 20,
    top: 12,
    bottom: -12,
    near: 1,
    far: 65,
  });
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.03;
  scene.add(key);
  const rim = new THREE.PointLight(palette.accent, 160, 26);
  scene.add(rim);
  const fill = new THREE.PointLight(palette.highlight, 90, 20);
  scene.add(fill);
  let lost = false,
    disposed = false;
  const onLost = (event: Event) => {
    event.preventDefault();
    lost = true;
  };
  const onRestored = () => {
    lost = false;
  };
  webglCanvas.addEventListener('webglcontextlost', onLost);
  webglCanvas.addEventListener('webglcontextrestored', onRestored);
  return {
    canvas,
    webglCanvas,
    render(elapsed: number, intensity: number) {
      if (lost || disposed) return false;
      const angle = introPhase(intensity === 0 ? 0 : elapsed) * Math.PI * 2,
        motion = Math.max(0, Math.min(1, intensity));
      // The route and every moving object are periodic; returning to zero is a physical continuation.
      positionCinematicCamera(camera, width, height, angle, motion);
      key.position.set(Math.sin(angle + 0.5) * 24, 9, Math.cos(angle + 0.5) * 24);
      rim.position.set(Math.sin(angle - 0.4) * 15, 2, Math.cos(angle - 0.4) * 15);
      fill.position.set(Math.sin(angle) * 22, 5, Math.cos(angle) * 22);
      featherWings.forEach((wing, i) => {
        wing.rotation.x = (i % 2 ? 1 : -1) * (0.3 + Math.sin(angle * 12) * 0.3 * motion);
      });
      birds.forEach((bird, i) => {
        bird.position.y = (i === 0 ? 0.7 : 1.2) + Math.sin(angle * 6) * motion * 0.18;
        bird.rotation.y = Math.sin(angle * 3) * motion * 0.14;
      });
      ballots.forEach(sheet => {
        sheet.position.y = 1.4 + Math.sin(angle * 6) * motion * 0.45;
        sheet.rotation.z = Math.sin(angle * 6) * motion * 0.06;
      });
      dust.rotation.y = Math.sin(angle) * 0.04;
      focalPoint.set(Math.sin(angle) * 12, 0.4, Math.cos(angle) * 12);
      focus.value = camera.position.distanceTo(focalPoint);
      composer.render(0);
      ctx.globalAlpha = 1;
      ctx.drawImage(webglCanvas, 0, 0);
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      webglCanvas.removeEventListener('webglcontextlost', onLost);
      webglCanvas.removeEventListener('webglcontextrestored', onRestored);
      geometries.forEach(g => g.dispose());
      Object.values(materials).forEach(m => m.dispose());
      dustMaterial.dispose();
      grain.dispose();
      key.shadow.dispose();
      imagePass.dispose();
      lensPass.dispose();
      outputPass.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
