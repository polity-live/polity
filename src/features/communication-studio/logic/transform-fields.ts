import { z } from 'zod';

// Canonical documents and semantic rendering must accept the same geometry.
const finite = z.number().finite();
export const studioTransformFields = {
  x: finite.min(-1_000_000).max(1_000_000),
  y: finite.min(-1_000_000).max(1_000_000),
  width: finite.min(1).max(100_000),
  height: finite.min(1).max(100_000),
  rotation: finite.min(-360_000).max(360_000).default(0),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
};
