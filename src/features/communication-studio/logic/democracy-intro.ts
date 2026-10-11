import * as THREE from 'three';
import { activePalette, type StudioThemeSnapshot } from './theme';
import { introPhase } from './event-intro';
import { createCinematicDemocracy, positionCinematicCamera } from './democracy-cinematic';

export const democracyChapters = [
  'peace',
  'debate',
  'participation',
  'resources',
  'digital',
  'future',
] as const;

type Ink = 'brand' | 'highlight' | 'accent' | 'white';
interface Motif {
  shape: THREE.Shape;
  ink: Ink;
  depth: number;
  wing?: boolean;
}

/** Original vector artwork arranged in layers along the illustrated camera journey. */
function artwork(chapter: number): Motif[] {
  const result: Motif[] = [];
  const polygon = (points: number[][], ink: Ink, depth = 0.15, wing = false) => {
    const shape = new THREE.Shape();
    points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
    shape.closePath();
    result.push({ shape, ink, depth, wing });
  };
  const rect = (x: number, y: number, w: number, h: number, ink: Ink, depth = 0.15) =>
    polygon(
      [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ],
      ink,
      depth
    );
  const circle = (x: number, y: number, r: number, ink: Ink, depth = 0.2) => {
    const shape = new THREE.Shape();
    shape.absarc(x, y, r, 0, Math.PI * 2, false);
    result.push({ shape, ink, depth });
  };
  const person = (x: number, y: number, ink: Ink) => {
    circle(x, y + 0.8, 0.22, ink, 0.35);
    polygon(
      [
        [x - 0.35, y],
        [x - 0.28, y + 0.5],
        [x + 0.28, y + 0.5],
        [x + 0.35, y],
      ],
      ink,
      0.35
    );
  };
  const paper = (x: number, y: number) => {
    rect(x, y, 1.2, 1.6, 'highlight');
    for (let i = 0; i < 4; i++) rect(x + 0.15, y + 0.25 + i * 0.3, 0.9, 0.04, 'brand', 0.17);
  };
  const dove = (x: number, y: number, size = 1) => {
    const transform = (points: number[][]) => points.map(([a, b]) => [x + a * size, y + b * size]);
    // Swept wings, rounded breast, head and fan tail; the branch stays distinct from the silhouette.
    const body = new THREE.Shape();
    body.moveTo(x - 1.6 * size, y - 0.35 * size);
    body.bezierCurveTo(
      x - 0.7 * size,
      y - 0.5 * size,
      x + 0.45 * size,
      y - 0.8 * size,
      x + 0.9 * size,
      y + 0.15 * size
    );
    body.bezierCurveTo(
      x + 1.35 * size,
      y + 0.05 * size,
      x + 1.45 * size,
      y + 0.65 * size,
      x + 0.95 * size,
      y + 0.65 * size
    );
    body.bezierCurveTo(
      x + 0.5 * size,
      y + 0.7 * size,
      x + 0.2 * size,
      y + 0.1 * size,
      x - 0.3 * size,
      y + 0.15 * size
    );
    body.lineTo(x - 1.7 * size, y + 0.1 * size);
    body.closePath();
    result.push({ shape: body, ink: 'white', depth: 0.32 });
    polygon(
      transform([
        [-0.4, 0],
        [-1.4, 1.5],
        [-0.85, 1.3],
        [-0.7, 1.75],
        [-0.2, 1.5],
        [0.4, 0.1],
      ]),
      'white',
      0.12,
      true
    );
    polygon(
      transform([
        [0, 0.1],
        [0.2, 1.7],
        [0.5, 1.4],
        [0.8, 1.6],
        [1.1, 1.1],
        [0.7, 0],
      ]),
      'white',
      0.1,
      true
    );
    polygon(
      transform([
        [1.22, 0.35],
        [1.65, 0.25],
        [1.2, 0.18],
      ]),
      'accent'
    );
    rect(x + 1.35 * size, y - 0.2 * size, 0.04 * size, 0.5 * size, 'accent');
    for (let i = 0; i < 3; i++)
      polygon(
        transform([
          [1.37, -0.1 + i * 0.15],
          [1.7, 0.02 + i * 0.15],
          [1.6, 0.17 + i * 0.15],
        ]),
        'accent'
      );
    circle(x + 1.1 * size, y + 0.4 * size, 0.035 * size, 'brand');
  };
  const computer = (x: number, y: number) => {
    rect(x, y, 2.7, 1.8, 'brand', 0.4);
    rect(x + 0.13, y + 0.14, 2.44, 1.52, 'highlight', 0.43);
    rect(x + 1.2, y - 0.6, 0.3, 0.6, 'accent', 0.3);
    rect(x + 0.6, y - 0.65, 1.5, 0.12, 'accent', 0.3);
    for (let i = 0; i < 3; i++)
      rect(x + 0.35, y + 0.4 + i * 0.3, 1.1 + i * 0.3, 0.07, 'accent', 0.45);
  };
  if (chapter === 0) dove(0, 0, 1.25);
  if (chapter === 1) {
    paper(-1, 0);
    paper(0.5, 0.4);
    // A civic gathering and printed pages evoke public history without asserting a particular event.
    for (let i = 0; i < 5; i++) person((i - 2) * 0.85, -1.8, i % 2 ? 'highlight' : 'accent');
    rect(-2.6, 1.95, 5.2, 0.1, 'accent');
  }
  if (chapter === 2) {
    rect(-1.4, -1.6, 2.8, 2, 'brand', 0.9);
    rect(-1.55, 0.4, 3.1, 0.22, 'accent', 0.95);
    rect(-0.7, 0.49, 1.4, 0.08, 'brand', 1);
    paper(-0.6, 0.9);
    polygon(
      [
        [-0.35, 1.5],
        [-0.1, 1.25],
        [0.5, 1.95],
        [0.42, 2.05],
        [-0.1, 1.5],
        [-0.27, 1.66],
      ],
      'accent',
      0.2
    );
  }
  if (chapter === 3) {
    for (let i = 0; i < 3; i++) {
      rect(-2 + i * 0.25, 0.6 + i * 0.28, 2.9, 1.15, 'highlight', 0.2 + i * 0.05);
      rect(-1.8 + i * 0.25, 0.75 + i * 0.28, 2.5, 0.82, 'brand', 0.23 + i * 0.05);
      circle(-0.55 + i * 0.25, 1.15 + i * 0.28, 0.3, 'accent', 0.26 + i * 0.05);
    }
    polygon(
      [
        [-2, -0.8],
        [0, 0.1],
        [2, -0.8],
      ],
      'highlight',
      0.3
    );
    for (let i = 0; i < 4; i++) rect(-1.5 + i * 0.85, -2, 0.3, 1.1, 'highlight', 0.4);
    rect(-2, -2.15, 4, 0.15, 'accent', 0.5);
    for (let i = 0; i < 3; i++) rect(2.4 + i * 0.35, -2, 0.18, 0.5 + i * 0.5, 'accent');
  }
  if (chapter === 4) {
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5,
        x = Math.cos(a) * 3,
        y = Math.sin(a) * 1.8;
      polygon(
        [
          [0, 0.3],
          [x, y + 0.5],
          [x + 0.025, y + 0.525],
          [0.025, 0.325],
        ],
        'accent',
        0.08
      );
    }
    computer(-1.35, -0.5);
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      person(Math.cos(a) * 3, Math.sin(a) * 1.8, 'accent');
    }
  }
  if (chapter === 5) {
    dove(0, 0.8, 0.8);
    computer(1.3, -1.7);
    paper(-3, -1.5);
    circle(0, -1.1, 0.6, 'accent');
    for (let i = 0; i < 3; i++) person(-1 + i, -2.6, 'highlight');
  }
  return result;
}

function outputCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1920 / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Intro canvas unavailable');
  return { canvas, ctx };
}

/** Layered original engravings in a continuous perspective journey; no slide cuts or icon cards. */
export function createIllustratedDemocracy(
  width: number,
  height: number,
  theme: StudioThemeSnapshot
) {
  const { canvas, ctx } = outputCanvas(width, height),
    palette = activePalette(theme);
  const colors = { ...palette, white: '#FFFFFF' };
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100),
    point = new THREE.Vector3();
  const chapters = democracyChapters.map((_, i) => ({
    angle: (i * Math.PI) / 3,
    motifs: artwork(i).map(m => ({ ...m, points: m.shape.getPoints(24) })),
  }));
  const dust = Array.from({ length: 90 }, (_, i) => {
    const n = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return {
      x: (n - Math.floor(n) - 0.5) * 40,
      y: Math.sin(i * 3.7) * 6,
      z: Math.cos(i * 7.1) * 23,
    };
  });
  const project = (x: number, y: number, z: number) => {
    point.set(x, y, z).project(camera);
    return point;
  };
  let disposed = false;
  return {
    canvas,
    render(elapsed: number, intensity: number) {
      if (disposed) return false;
      const angle = introPhase(intensity === 0 ? 0 : elapsed) * Math.PI * 2,
        motion = Math.max(0, Math.min(1, intensity)),
        w = canvas.width,
        h = canvas.height;
      positionCinematicCamera(camera, width, height, angle, motion);
      ctx.globalAlpha = 1;
      const backdrop = ctx.createLinearGradient(0, 0, w, h);
      backdrop.addColorStop(0, palette.brand);
      backdrop.addColorStop(1, '#030605');
      ctx.fillStyle = backdrop;
      ctx.fillRect(0, 0, w, h);
      // Original printwork is spread through space, so foreground and background travel at different speeds.
      const order = chapters
        .map((chapter, i) => ({ chapter, i, distance: Math.cos(angle - chapter.angle) }))
        .sort((a, b) => a.distance - b.distance);
      for (const { chapter, distance } of order) {
        if (distance < 0.1) continue;
        const sin = Math.sin(chapter.angle),
          cos = Math.cos(chapter.angle);
        ctx.globalAlpha = Math.min(1, Math.max(0.06, distance * distance));
        for (const m of chapter.motifs) {
          ctx.beginPath();
          m.points.forEach((p, i) => {
            const wing = m.wing ? 1 + Math.sin(angle * 12) * motion * 0.16 : 1;
            const x = p.x,
              y = p.y * wing + Math.sin(angle * 6) * motion * m.depth * 0.15,
              z = m.depth * 2;
            const projected = project(
              sin * 12 + cos * x + sin * z,
              y,
              cos * 12 - sin * x + cos * z
            );
            const px = ((projected.x + 1) * w) / 2,
              py = ((1 - projected.y) * h) / 2;
            if (i) ctx.lineTo(px, py);
            else ctx.moveTo(px, py);
          });
          ctx.closePath();
          ctx.fillStyle = colors[m.ink];
          ctx.strokeStyle = palette.brand;
          ctx.lineWidth = 0.8;
          ctx.shadowColor = '#00000080';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetX = 3;
          ctx.shadowOffsetY = 6;
          ctx.fill();
          ctx.shadowColor = 'transparent';
          ctx.stroke();
        }
      }
      // The timeline is a physical horizon passing beneath the engravings, rather than a presentation progress bar.
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const a = angle - 0.85 + (i * 1.7) / 120,
          p = project(Math.sin(a) * 12, -2.7, Math.cos(a) * 12);
        const x = ((p.x + 1) * w) / 2,
          y = ((1 - p.y) * h) / 2;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = palette.highlight;
      for (const grain of dust) {
        const p = project(grain.x, grain.y + Math.sin(angle) * 0.2, grain.z);
        if (p.z < 1 && p.z > -1) {
          ctx.globalAlpha = 0.12;
          ctx.fillRect(((p.x + 1) * w) / 2, ((1 - p.y) * h) / 2, 1, 1);
        }
      }
      ctx.globalAlpha = 1;
      return true;
    },
    dispose() {
      disposed = true;
      canvas.width = 1;
      canvas.height = 1;
    },
  };
}

export function createSculpturalDemocracy(
  width: number,
  height: number,
  theme: StudioThemeSnapshot
) {
  return createCinematicDemocracy(width, height, theme, democracyChapters);
}
