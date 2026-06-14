import { describe, expect, it } from 'vitest';
import { createCorridorGeometry } from '../streetDesignPlacement';
import { toShapePoint } from '../streetDesignScene';

describe('streetDesignScene coordinate mapping', () => {
  it('maps local z to negative shape y so rotated ShapeGeometry lands on the same ground z', () => {
    expect(toShapePoint({ x: 4, z: 7 })).toEqual({ x: 4, y: -7 });
    expect(toShapePoint({ x: -3, z: -5 })).toEqual({ x: -3, y: 5 });
  });

  it('keeps corridor shape points on the same side as the local polygon points after rotation', () => {
    const corridor = createCorridorGeometry({ x: 0, z: 0 }, { x: 10, z: 0 }, 2);
    const shapePoints = corridor.polygon.map(toShapePoint);

    expect(corridor.polygon.map(point => point.z)).toEqual([1, 1, -1, -1]);
    expect(shapePoints.map(point => point.y)).toEqual([-1, -1, 1, 1]);
  });
});
