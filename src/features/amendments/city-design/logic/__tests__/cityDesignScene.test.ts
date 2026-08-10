import { describe, expect, it, vi } from 'vitest';
import type { CityDesignOsmWay } from '../../types';
import { createCorridorGeometry } from '../cityDesignPlacement';
import {
  createLaneArrowPolygon,
  createCityDesignRenderScheduler,
  getCityDesignElevationRampLength,
  getCityDesignElevationRampSegments,
  getCityDesignPointerLayer,
  normalizeCityDesignPointerPoint,
  getCityDesignOsmFeatureRenderY,
  getCityDesignOsmRenderPriority,
  getCityDesignOsmWaterRenderY,
  getCityDesignTreeRenderProfile,
  getCityDesignTreeRenderKind,
  toShapePoint,
} from '../cityDesignScene';

function osmWay(overrides: Partial<CityDesignOsmWay>): CityDesignOsmWay {
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
  kind?: CityDesignOsmWay['kind'];
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

describe('cityDesignScene coordinate mapping', () => {
  it('resolves and normalizes pointer positions across comparison layers', () => {
    expect(getCityDesignPointerLayer('split', -20)).toBe('original');
    expect(getCityDesignPointerLayer('split', 20)).toBe('design');
    expect(getCityDesignPointerLayer('original', 20)).toBe('original');
    expect(getCityDesignPointerLayer('overlay', -20)).toBe('design');
    expect(normalizeCityDesignPointerPoint({ x: -47, z: 8 }, 'split', 'original')).toEqual({
      x: 5,
      z: 8,
    });
    expect(normalizeCityDesignPointerPoint({ x: 57, z: 8 }, 'split', 'design')).toEqual({
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
    expect(
      createLaneArrowPolygon({
        center: { x: 1, z: 2 },
        direction: { x: 0, z: 0 },
        length: 4,
        width: 1,
      })[0]
    ).toMatchObject({ x: 1, z: 4 });
  });

  it('renders green OSM areas below mobility layers and buildings', () => {
    expect(getCityDesignOsmRenderPriority('green')).toBeLessThan(
      getCityDesignOsmRenderPriority('road')
    );
    expect(getCityDesignOsmRenderPriority('water')).toBeLessThan(
      getCityDesignOsmRenderPriority('sidewalk')
    );
    expect(getCityDesignOsmRenderPriority('road')).toBeLessThan(
      getCityDesignOsmRenderPriority('building')
    );
    expect(getCityDesignOsmRenderPriority('building')).toBeLessThan(
      getCityDesignOsmRenderPriority('tree')
    );
  });

  it('normalizes tree species into render kinds with default fallback', () => {
    expect(getCityDesignTreeRenderKind('deciduous')).toBe('deciduous');
    expect(getCityDesignTreeRenderKind('conifer')).toBe('conifer');
    expect(getCityDesignTreeRenderKind('fruit')).toBe('fruit');
    expect(getCityDesignTreeRenderKind('columnar_poplar')).toBe('columnar_poplar');
    expect(getCityDesignTreeRenderKind('ornamental_cherry')).toBe('ornamental_cherry');
    expect(getCityDesignTreeRenderKind('flowering_plum')).toBe('flowering_plum');
    expect(getCityDesignTreeRenderKind('stadtbaum')).toBe('deciduous');
    expect(getCityDesignTreeRenderKind('obstbaum')).toBe('fruit');
    expect(getCityDesignTreeRenderKind('zierkirsche')).toBe('ornamental_cherry');
    expect(getCityDesignTreeRenderKind('pflaume')).toBe('flowering_plum');
    expect(getCityDesignTreeRenderKind('custom_species')).toBe('deciduous');
    expect(getCityDesignTreeRenderKind(undefined)).toBe('deciduous');
  });

  it('uses distinct tree render profiles for known species and a deciduous custom fallback', () => {
    expect(getCityDesignTreeRenderProfile('deciduous')).toMatchObject({
      canopyShape: 'rounded_lobes',
      hasFruitMarkers: false,
      kind: 'deciduous',
    });
    expect(getCityDesignTreeRenderProfile('conifer')).toMatchObject({
      canopyShape: 'stacked_cones',
      kind: 'conifer',
    });
    expect(getCityDesignTreeRenderProfile('fruit')).toMatchObject({
      canopyShape: 'rounded_lobes',
      hasFruitMarkers: true,
      kind: 'fruit',
    });
    expect(getCityDesignTreeRenderProfile('columnar_poplar')).toMatchObject({
      canopyShape: 'columnar_lobes',
      kind: 'columnar_poplar',
    });
    expect(getCityDesignTreeRenderProfile('ornamental_cherry')).toMatchObject({
      canopyColors: expect.arrayContaining(['#ffc2dc']),
      canopyShape: 'rounded_lobes',
      kind: 'ornamental_cherry',
    });
    expect(getCityDesignTreeRenderProfile('flowering_plum')).toMatchObject({
      canopyColors: expect.arrayContaining(['#fff7f0']),
      canopyShape: 'rounded_lobes',
      kind: 'flowering_plum',
    });
    expect(getCityDesignTreeRenderProfile('custom_species')).toMatchObject({
      canopyShape: 'rounded_lobes',
      hasFruitMarkers: false,
      kind: 'deciduous',
    });
  });

  it('places elevated OSM rail and road decks above water render level', () => {
    const railY = getCityDesignOsmFeatureRenderY(
      osmWay({
        id: 'rail-viaduct',
        kind: 'rail',
        deckElevationMeters: 7.5,
        level: 'bridge',
        structureKind: 'viaduct',
      })
    );
    const roadY = getCityDesignOsmFeatureRenderY(
      osmWay({
        id: 'road-bridge',
        kind: 'road',
        deckElevationMeters: 3.6,
        level: 'bridge',
        structureKind: 'bridge',
      })
    );
    const waterY = getCityDesignOsmWaterRenderY(
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
      getCityDesignOsmFeatureRenderY(
        osmWay({
          kind: 'rail',
          deckElevationMeters: -2.4,
          level: 'tunnel',
          structureKind: 'tunnel',
        }),
        0.07
      )
    ).toBeCloseTo(-0.18);
    expect(getCityDesignOsmFeatureRenderY(osmWay({ kind: 'road' }), 0.052)).toBe(0.052);
    expect(
      getCityDesignOsmFeatureRenderY(osmWay({ kind: 'road', deckElevationMeters: 0 }), 0.052)
    ).toBe(0.052);
  });

  it('creates internal bridge ramps where a bridge road meets surface level', () => {
    const ramps = getCityDesignElevationRampSegments([
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
    const ramps = getCityDesignElevationRampSegments([
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

  it('prefers a same-kind lower connection over a nearer cross-kind connection', () => {
    const source = rampFeature({
      id: 'source-road',
      start: { x: 0, z: 0 },
      end: { x: 20, z: 0 },
      surfaceY: 4,
      structureKind: 'bridge',
    });
    const nearerRail = rampFeature({
      id: 'nearer-rail',
      kind: 'rail',
      start: { x: 20.2, z: 0 },
      end: { x: 35, z: 0 },
      surfaceY: 0.07,
    });
    const sameKindRoad = rampFeature({
      id: 'same-kind-road',
      start: { x: 21, z: 0 },
      end: { x: 40, z: 0 },
      surfaceY: 0.052,
    });

    const endRamp = getCityDesignElevationRampSegments([source, nearerRail, sameKindRoad]).find(
      ramp => ramp.sourceId === source.id && ramp.endpoint === 'end'
    );

    expect(endRamp?.endY).toBe(0.052);
  });

  it('keeps connected viaduct rails continuously elevated', () => {
    const ramps = getCityDesignElevationRampSegments([
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
    const ramps = getCityDesignElevationRampSegments([
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
    expect(getCityDesignElevationRampLength(0.5)).toBe(10);
    expect(getCityDesignElevationRampLength(20)).toBe(32);
    expect(getCityDesignElevationRampLength(3.6)).toBeCloseTo(16.2);
    expect(getCityDesignElevationRampLength(3.6, true)).toBe(10);
  });

  it('safely rejects malformed persisted elevation centerlines', () => {
    expect(
      getCityDesignElevationRampSegments([
        {
          id: 'malformed-bridge',
          kind: 'road',
          geometry: {
            kind: 'path_corridor',
            points: [],
            roundedCenterline: [],
            polygon: [],
            length: 0,
            width: 2,
            area: 0,
            cornerRadius: 0,
          },
          surfaceY: 3,
          structureKind: 'bridge',
        },
      ])
    ).toEqual([]);
  });

  it('contains one-point ramps and refuses ramps toward a higher disconnected deck', () => {
    const onePointBridge = {
      id: 'one-point-bridge',
      kind: 'road' as const,
      geometry: {
        kind: 'path_corridor' as const,
        points: [{ x: 0, z: 0 }],
        roundedCenterline: [{ x: 0, z: 0 }],
        polygon: [],
        length: 10,
        width: 2,
        area: 20,
        cornerRadius: 0,
      },
      surfaceY: 3,
      structureKind: 'bridge',
    };
    expect(getCityDesignElevationRampSegments([onePointBridge])).toEqual([]);

    const bridge = rampFeature({
      id: 'lower-bridge',
      start: { x: 0, z: 0 },
      end: { x: 20, z: 0 },
      surfaceY: 3,
      structureKind: 'bridge',
    });
    const higherConnection = rampFeature({
      id: 'higher-deck',
      start: { x: 20, z: 0 },
      end: { x: 40, z: 0 },
      surfaceY: 5,
      structureKind: 'bridge',
    });
    const ramps = getCityDesignElevationRampSegments([bridge, higherConnection]);
    expect(ramps.some(ramp => ramp.sourceId === bridge.id && ramp.endpoint === 'end')).toBe(false);
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
    const scheduler = createCityDesignRenderScheduler(renderFrame, frameApi);

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
    const scheduler = createCityDesignRenderScheduler(vi.fn(), frameApi);

    scheduler.requestRender();
    scheduler.dispose();
    scheduler.requestRender();

    expect(frameApi.cancelAnimationFrame).toHaveBeenCalledWith(11);
    expect(frameApi.requestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it('does not render a stale callback after disposal and tolerates disposal without a frame', () => {
    let callback: FrameRequestCallback | undefined;
    const frameApi = {
      requestAnimationFrame: vi.fn((nextCallback: FrameRequestCallback) => {
        callback = nextCallback;
        return 13;
      }),
      cancelAnimationFrame: vi.fn(),
    };
    const renderFrame = vi.fn();
    const scheduler = createCityDesignRenderScheduler(renderFrame, frameApi);

    scheduler.requestRender();
    scheduler.dispose();
    callback?.(20);

    expect(renderFrame).not.toHaveBeenCalled();

    const idleScheduler = createCityDesignRenderScheduler(vi.fn(), frameApi);
    idleScheduler.dispose();
    expect(frameApi.cancelAnimationFrame).toHaveBeenCalledTimes(1);
  });
});
