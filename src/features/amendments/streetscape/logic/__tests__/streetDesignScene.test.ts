import { describe, expect, it, vi } from 'vitest';
import type { StreetDesignOsmWay } from '../../types';
import { createCorridorGeometry } from '../streetDesignPlacement';
import {
  createLaneArrowPolygon,
  createStreetDesignRenderScheduler,
  getStreetDesignElevationRampLength,
  getStreetDesignElevationRampSegments,
  getStreetDesignPointerLayer,
  normalizeStreetDesignPointerPoint,
  getStreetDesignOsmFeatureRenderY,
  getStreetDesignOsmRenderPriority,
  getStreetDesignOsmWaterRenderY,
  getStreetDesignTreeRenderProfile,
  getStreetDesignTreeRenderKind,
  toShapePoint,
} from '../streetDesignScene';

function osmWay(overrides: Partial<StreetDesignOsmWay>): StreetDesignOsmWay {
  return {
    id: 'osm-feature',
    kind: 'road',
    geometryKind: 'line',
    points: [],
    ...overrides,
  };
}

function rampFeature(args: {
  id: string;
  kind?: StreetDesignOsmWay['kind'];
  start: { x: number; z: number };
  end: { x: number; z: number };
  surfaceY: number;
  structureKind?: string;
}) {
  return {
    id: args.id,
    kind: args.kind ?? 'road',
    geometry: createCorridorGeometry(args.start, args.end, args.kind === 'rail' ? 1.6 : 4.8),
    surfaceY: args.surfaceY,
    structureKind: args.structureKind,
  };
}

describe('streetDesignScene coordinate mapping', () => {
  it('resolves and normalizes pointer positions across comparison layers', () => {
    expect(getStreetDesignPointerLayer('split', -20)).toBe('original');
    expect(getStreetDesignPointerLayer('split', 20)).toBe('design');
    expect(getStreetDesignPointerLayer('original', 20)).toBe('original');
    expect(getStreetDesignPointerLayer('overlay', -20)).toBe('design');
    expect(normalizeStreetDesignPointerPoint({ x: -47, z: 8 }, 'split', 'original')).toEqual({
      x: 5,
      z: 8,
    });
    expect(normalizeStreetDesignPointerPoint({ x: 57, z: 8 }, 'split', 'design')).toEqual({
      x: 5,
      z: 8,
    });
  });

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

  it('creates lane arrows with the tip facing the placement direction', () => {
    const eastArrow = createLaneArrowPolygon({
      center: { x: 0, z: 0 },
      direction: { x: 1, z: 0 },
      length: 4,
      width: 1,
    });
    const northArrow = createLaneArrowPolygon({
      center: { x: 0, z: 0 },
      direction: { x: 0, z: -1 },
      length: 4,
      width: 1,
    });

    expect(eastArrow[0]).toMatchObject({ x: 2, z: 0 });
    expect(eastArrow).toHaveLength(7);
    expect(Math.max(...eastArrow.slice(1).map(point => point.x))).toBeLessThan(eastArrow[0].x);
    expect(Math.abs(eastArrow[2].z)).toBeLessThan(Math.abs(eastArrow[1].z));
    expect(northArrow[0]).toMatchObject({ x: 0, z: -2 });
    expect(Math.min(...northArrow.slice(1).map(point => point.z))).toBeGreaterThan(northArrow[0].z);
  });

  it('renders green OSM areas below mobility layers and buildings', () => {
    expect(getStreetDesignOsmRenderPriority('green')).toBeLessThan(
      getStreetDesignOsmRenderPriority('road')
    );
    expect(getStreetDesignOsmRenderPriority('water')).toBeLessThan(
      getStreetDesignOsmRenderPriority('sidewalk')
    );
    expect(getStreetDesignOsmRenderPriority('road')).toBeLessThan(
      getStreetDesignOsmRenderPriority('building')
    );
    expect(getStreetDesignOsmRenderPriority('building')).toBeLessThan(
      getStreetDesignOsmRenderPriority('tree')
    );
  });

  it('normalizes tree species into render kinds with default fallback', () => {
    expect(getStreetDesignTreeRenderKind('deciduous')).toBe('deciduous');
    expect(getStreetDesignTreeRenderKind('conifer')).toBe('conifer');
    expect(getStreetDesignTreeRenderKind('fruit')).toBe('fruit');
    expect(getStreetDesignTreeRenderKind('columnar_poplar')).toBe('columnar_poplar');
    expect(getStreetDesignTreeRenderKind('ornamental_cherry')).toBe('ornamental_cherry');
    expect(getStreetDesignTreeRenderKind('flowering_plum')).toBe('flowering_plum');
    expect(getStreetDesignTreeRenderKind('stadtbaum')).toBe('deciduous');
    expect(getStreetDesignTreeRenderKind('obstbaum')).toBe('fruit');
    expect(getStreetDesignTreeRenderKind('zierkirsche')).toBe('ornamental_cherry');
    expect(getStreetDesignTreeRenderKind('pflaume')).toBe('flowering_plum');
    expect(getStreetDesignTreeRenderKind('custom_species')).toBe('deciduous');
  });

  it('uses distinct tree render profiles for known species and a deciduous custom fallback', () => {
    expect(getStreetDesignTreeRenderProfile('deciduous')).toMatchObject({
      canopyShape: 'rounded_lobes',
      hasFruitMarkers: false,
      kind: 'deciduous',
    });
    expect(getStreetDesignTreeRenderProfile('conifer')).toMatchObject({
      canopyShape: 'stacked_cones',
      kind: 'conifer',
    });
    expect(getStreetDesignTreeRenderProfile('fruit')).toMatchObject({
      canopyShape: 'rounded_lobes',
      hasFruitMarkers: true,
      kind: 'fruit',
    });
    expect(getStreetDesignTreeRenderProfile('columnar_poplar')).toMatchObject({
      canopyShape: 'columnar_lobes',
      kind: 'columnar_poplar',
    });
    expect(getStreetDesignTreeRenderProfile('ornamental_cherry')).toMatchObject({
      canopyColors: expect.arrayContaining(['#ffc2dc']),
      canopyShape: 'rounded_lobes',
      kind: 'ornamental_cherry',
    });
    expect(getStreetDesignTreeRenderProfile('flowering_plum')).toMatchObject({
      canopyColors: expect.arrayContaining(['#fff7f0']),
      canopyShape: 'rounded_lobes',
      kind: 'flowering_plum',
    });
    expect(getStreetDesignTreeRenderProfile('custom_species')).toMatchObject({
      canopyShape: 'rounded_lobes',
      hasFruitMarkers: false,
      kind: 'deciduous',
    });
  });

  it('places elevated OSM rail and road decks above water render level', () => {
    const railY = getStreetDesignOsmFeatureRenderY(
      osmWay({
        id: 'rail-viaduct',
        kind: 'rail',
        deckElevationMeters: 7.5,
        level: 'bridge',
        structureKind: 'viaduct',
      })
    );
    const roadY = getStreetDesignOsmFeatureRenderY(
      osmWay({
        id: 'road-bridge',
        kind: 'road',
        deckElevationMeters: 3.6,
        level: 'bridge',
        structureKind: 'bridge',
      })
    );
    const waterY = getStreetDesignOsmWaterRenderY(
      osmWay({
        id: 'river',
        kind: 'water',
        geometryKind: 'polygon',
        baseElevationMeters: -0.08,
        deckElevationMeters: -0.08,
      })
    );

    expect(railY).toBe(7.5);
    expect(roadY).toBe(3.6);
    expect(waterY).toBeCloseTo(-0.04);
    expect(railY).toBeGreaterThan(waterY);
    expect(roadY).toBeGreaterThan(waterY);
  });

  it('lowers tunnels and preserves flat snapshot fallback heights', () => {
    expect(
      getStreetDesignOsmFeatureRenderY(
        osmWay({
          kind: 'rail',
          deckElevationMeters: -2.4,
          level: 'tunnel',
          structureKind: 'tunnel',
        }),
        0.07
      )
    ).toBeCloseTo(-0.18);
    expect(getStreetDesignOsmFeatureRenderY(osmWay({ kind: 'road' }), 0.052)).toBe(0.052);
  });

  it('creates internal bridge ramps where a bridge road meets surface level', () => {
    const ramps = getStreetDesignElevationRampSegments([
      rampFeature({
        id: 'bridge',
        start: { x: 0, z: 0 },
        end: { x: 10, z: 0 },
        surfaceY: 3.6,
        structureKind: 'bridge',
      }),
      rampFeature({
        id: 'surface',
        start: { x: 10, z: 0 },
        end: { x: 35, z: 0 },
        surfaceY: 0.052,
      }),
    ]);

    expect(ramps).toHaveLength(2);
    expect(ramps.map(ramp => ramp.endpoint).sort()).toEqual(['end', 'start']);
    const startRamp = ramps.find(ramp => ramp.endpoint === 'start');
    const endRamp = ramps.find(ramp => ramp.endpoint === 'end');
    expect(ramps.find(ramp => ramp.endpoint === 'start')).toMatchObject({
      sourceId: 'bridge',
      startY: 0.05,
      endY: 3.6,
      fallback: true,
    });
    expect(ramps.find(ramp => ramp.endpoint === 'end')).toMatchObject({
      sourceId: 'bridge',
      startY: 3.6,
      endY: 0.052,
      fallback: false,
    });
    expect(startRamp?.geometry.length).toBeCloseTo(5);
    expect(endRamp?.geometry.length).toBeCloseTo(5);
    if (startRamp?.geometry.kind === 'corridor' && endRamp?.geometry.kind === 'corridor') {
      expect(startRamp.geometry.start.x).toBeCloseTo(0);
      expect(startRamp.geometry.end.x).toBeCloseTo(5);
      expect(endRamp.geometry.start.x).toBeCloseTo(5);
      expect(endRamp.geometry.end.x).toBeCloseTo(10);
    }
  });

  it('does not ramp down when the next feature continues at the same elevated deck height', () => {
    const ramps = getStreetDesignElevationRampSegments([
      rampFeature({
        id: 'bridge',
        start: { x: 0, z: 0 },
        end: { x: 10, z: 0 },
        surfaceY: 3.6,
        structureKind: 'bridge',
      }),
      rampFeature({
        id: 'elevated',
        start: { x: 10, z: 0 },
        end: { x: 35, z: 0 },
        surfaceY: 3.65,
        structureKind: 'bridge',
      }),
    ]);

    expect(
      ramps.filter(ramp => ramp.sourceId === 'bridge' && ramp.endpoint === 'end')
    ).toHaveLength(0);
  });

  it('keeps connected viaduct rails continuously elevated', () => {
    const ramps = getStreetDesignElevationRampSegments([
      rampFeature({
        id: 'viaduct-a',
        kind: 'rail',
        start: { x: 0, z: 0 },
        end: { x: 10, z: 0 },
        surfaceY: 7.5,
        structureKind: 'viaduct',
      }),
      rampFeature({
        id: 'viaduct-b',
        kind: 'rail',
        start: { x: 10, z: 0 },
        end: { x: 35, z: 0 },
        surfaceY: 7.52,
        structureKind: 'viaduct',
      }),
    ]);

    expect(
      ramps.filter(ramp => ramp.sourceId === 'viaduct-a' && ramp.endpoint === 'end')
    ).toHaveLength(0);
  });

  it('creates fallback ramps inside isolated bridge spans and clamps ramp length', () => {
    const ramps = getStreetDesignElevationRampSegments([
      rampFeature({
        id: 'isolated-bridge',
        start: { x: 0, z: 0 },
        end: { x: 10, z: 0 },
        surfaceY: 3.6,
        structureKind: 'bridge',
      }),
    ]);

    expect(ramps).toHaveLength(2);
    expect(ramps.every(ramp => ramp.fallback)).toBe(true);
    expect(ramps[0]?.geometry.length).toBe(5);
    expect(getStreetDesignElevationRampLength(0.5)).toBe(10);
    expect(getStreetDesignElevationRampLength(20)).toBe(32);
    expect(getStreetDesignElevationRampLength(3.6)).toBeCloseTo(16.2);
    expect(getStreetDesignElevationRampLength(3.6, true)).toBe(10);
  });

  it('coalesces render requests into one animation frame', () => {
    const callbacks: FrameRequestCallback[] = [];
    const frameApi = {
      requestAnimationFrame: (nextCallback: FrameRequestCallback) => {
        callbacks.push(nextCallback);
        return 7;
      },
      cancelAnimationFrame: vi.fn(),
    };
    const renderFrame = vi.fn();
    const scheduler = createStreetDesignRenderScheduler(renderFrame, frameApi);

    scheduler.requestRender();
    scheduler.requestRender();

    expect(callbacks).toHaveLength(1);
    expect(renderFrame).not.toHaveBeenCalled();

    callbacks[0]?.(16);

    expect(renderFrame).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending render request on dispose', () => {
    const frameApi = {
      requestAnimationFrame: vi.fn(() => 11),
      cancelAnimationFrame: vi.fn(),
    };
    const scheduler = createStreetDesignRenderScheduler(vi.fn(), frameApi);

    scheduler.requestRender();
    scheduler.dispose();
    scheduler.requestRender();

    expect(frameApi.cancelAnimationFrame).toHaveBeenCalledWith(11);
    expect(frameApi.requestAnimationFrame).toHaveBeenCalledTimes(1);
  });
});
