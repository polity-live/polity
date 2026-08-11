/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCorridorCityDesignObject,
  createCorridorGeometry,
  createPathCorridorCityDesignObject,
  createPointCityDesignObject,
} from '../cityDesignPlacement';
import { cityDesignObjectRegistry } from '../cityDesignObjectRegistry';
import { createEmptyCityDesignState } from '../../state/cityDesignReducer';
import type {
  CityDesignObject,
  CityDesignObjectType,
  CityDesignOsmFeature,
  CityDesignStateV1,
} from '../../types';
import {
  mountCityDesignScene,
  type CityDesignSceneController,
  type CityDesignSceneMountOptions,
} from '../cityDesignScene';

type CityDesignObjectDefinition = (typeof cityDesignObjectRegistry)[CityDesignObjectType];
type PathCorridorGeometry = Extract<CityDesignObject['geometry'], { kind: 'path_corridor' }>;
type CorridorGeometry = Extract<CityDesignObject['geometry'], { kind: 'corridor' }>;

const sceneDoubles = vi.hoisted(() => ({
  controls: [] as {
    target: import('three').Vector3;
    update: ReturnType<typeof vi.fn>;
    emitChange: () => void;
    dispose: ReturnType<typeof vi.fn>;
    mouseButtons: Record<string, number>;
    touches: Record<string, number>;
  }[],
  renderers: [] as {
    render: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    setSize: ReturnType<typeof vi.fn>;
  }[],
  useGridMaterialArray: false,
  useMeshMaterialArrays: false,
  useNestedShadowChild: false,
}));

vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof import('three')>();

  class TestWebGlRenderer {
    readonly domElement: HTMLCanvasElement;
    readonly shadowMap: { enabled?: boolean; type?: unknown } = {};
    readonly render = vi.fn();
    readonly dispose = vi.fn();
    readonly setClearColor = vi.fn();
    readonly setSize: ReturnType<typeof vi.fn>;
    outputColorSpace: unknown;
    toneMapping: unknown;
    toneMappingExposure = 1;
    private pixelRatio = 1;

    constructor({ canvas }: { canvas: HTMLCanvasElement }) {
      this.domElement = canvas;
      this.setSize = vi.fn((width: number, height: number) => {
        canvas.width = Math.floor(width * this.pixelRatio);
        canvas.height = Math.floor(height * this.pixelRatio);
      });
      sceneDoubles.renderers.push(this);
    }

    setPixelRatio(pixelRatio: number) {
      this.pixelRatio = pixelRatio;
    }

    getPixelRatio() {
      return this.pixelRatio;
    }
  }

  class TestGridHelper extends actual.GridHelper {
    constructor(...args: ConstructorParameters<typeof actual.GridHelper>) {
      super(...args);
      if (sceneDoubles.useGridMaterialArray && !Array.isArray(this.material)) {
        (this as unknown as { material: import('three').Material[] }).material = [
          this.material,
          this.material.clone(),
        ];
      }
    }
  }

  class TestMesh extends actual.Mesh {
    constructor(
      geometry?: import('three').BufferGeometry,
      material?: import('three').Material | import('three').Material[]
    ) {
      super(geometry, material);
      if (sceneDoubles.useMeshMaterialArrays && material && !Array.isArray(material)) {
        this.material = [material, material.clone()];
      }
      if (sceneDoubles.useNestedShadowChild) this.add(new actual.Object3D());
    }
  }

  return {
    ...actual,
    GridHelper: TestGridHelper,
    Mesh: TestMesh,
    WebGLRenderer: TestWebGlRenderer,
  };
});

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => {
  class TestOrbitControls {
    readonly target: import('three').Vector3;
    readonly update = vi.fn(() => false);
    readonly dispose = vi.fn();
    mouseButtons: Record<string, number> = {};
    touches: Record<string, number> = {};
    enableDamping = false;
    dampingFactor = 0;
    enableZoom = false;
    enableRotate = false;
    enablePan = false;
    screenSpacePanning = false;
    minDistance = 0;
    maxDistance = 0;
    maxPolarAngle = 0;
    private readonly listeners = new Map<string, Set<() => void>>();

    constructor(camera: import('three').PerspectiveCamera) {
      this.target = camera.position.clone().set(0, 0, 0);
      sceneDoubles.controls.push(this);
    }

    addEventListener(type: string, listener: () => void) {
      const listeners = this.listeners.get(type) ?? new Set();
      listeners.add(listener);
      this.listeners.set(type, listeners);
    }

    removeEventListener(type: string, listener: () => void) {
      this.listeners.get(type)?.delete(listener);
    }

    emitChange() {
      this.listeners.get('change')?.forEach(listener => listener());
    }
  }

  return { OrbitControls: TestOrbitControls };
});

let animationFrames: FrameRequestCallback[];
let controller: CityDesignSceneController | null;

beforeEach(() => {
  animationFrames = [];
  controller = null;
  sceneDoubles.controls.length = 0;
  sceneDoubles.renderers.length = 0;
  sceneDoubles.useGridMaterialArray = false;
  sceneDoubles.useMeshMaterialArrays = false;
  sceneDoubles.useNestedShadowChild = false;
  vi.stubGlobal('devicePixelRatio', 3);
  vi.stubGlobal('ResizeObserver', undefined);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    animationFrames.push(callback);
    return animationFrames.length;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
});

afterEach(() => {
  controller?.dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function createCanvas() {
  const canvas = document.createElement('canvas');
  Object.defineProperties(canvas, {
    clientWidth: { configurable: true, value: 640 },
    clientHeight: { configurable: true, value: 360 },
  });
  canvas.getBoundingClientRect = vi.fn(() => ({
    bottom: 360,
    height: 360,
    left: 0,
    right: 640,
    top: 0,
    width: 640,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }));
  canvas.setPointerCapture = vi.fn();
  canvas.releasePointerCapture = vi.fn();
  canvas.hasPointerCapture = vi.fn(() => false);
  document.body.append(canvas);
  return canvas;
}

function createOptions(
  overrides: Partial<CityDesignSceneMountOptions> = {}
): CityDesignSceneMountOptions {
  return {
    canvas: createCanvas(),
    design: createEmptyCityDesignState(),
    placementPreview: null,
    placementPreviewType: null,
    placementStart: null,
    selectedObjectId: null,
    selectedOsmWayId: null,
    selectedChangeRequestId: null,
    hiddenObjectIds: [],
    hiddenObjectCategories: [],
    changeRequests: [],
    changeRequestColorMode: 'natural',
    focusObjectId: null,
    focusOsmWayId: null,
    interactionMode: 'camera',
    readOnly: false,
    initialCameraPose: null,
    onPointerDown: vi.fn(),
    onPointerMove: vi.fn(),
    onPointerHover: vi.fn(),
    onObjectSelect: vi.fn(),
    onOsmWaySelect: vi.fn(),
    onObjectRotate: vi.fn(),
    onCameraPoseChange: vi.fn(),
    ...overrides,
  };
}

function flushFrame(timestamp = 16) {
  const callback = animationFrames.shift();
  expect(callback).toBeTypeOf('function');
  callback?.(timestamp);
}

function pointerEvent(
  type: string,
  overrides: Partial<{
    button: number;
    buttons: number;
    clientX: number;
    clientY: number;
    pointerId: number;
    pointerType: string;
    shiftKey: boolean;
  }> = {}
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: overrides.button ?? 0,
    buttons: overrides.buttons ?? 1,
    cancelable: true,
    clientX: overrides.clientX ?? 320,
    clientY: overrides.clientY ?? 180,
    shiftKey: overrides.shiftKey ?? false,
  });
  Object.defineProperties(event, {
    pointerId: { value: overrides.pointerId ?? 1 },
    pointerType: { value: overrides.pointerType ?? 'mouse' },
  });
  return event as unknown as PointerEvent;
}

function createObjectMatrix(): CityDesignObject[] {
  const entries = Object.entries(cityDesignObjectRegistry) as [
    CityDesignObjectType,
    CityDesignObjectDefinition,
  ][];

  const objects = entries.map(([type, definition], index) => {
    const x = (index % 10) * 7 - 30;
    const z = Math.floor(index / 10) * 7 - 14;
    if (definition.geometryKind === 'point') {
      return createPointCityDesignObject({ id: `${type}-${index}`, type, point: { x, z } });
    }
    return createCorridorCityDesignObject({
      id: `${type}-${index}`,
      type,
      start: { x, z },
      end: { x: x + 5, z: z + 2 },
      width: definition.defaultWidth ?? 2,
    });
  });

  objects.push(
    createPathCorridorCityDesignObject({
      id: 'tree-row',
      type: 'tree',
      points: [
        { x: -10, z: 20 },
        { x: 0, z: 24 },
        { x: 10, z: 20 },
      ],
      width: 2,
    })
  );
  const addPointVariant = (
    type: CityDesignObjectType,
    id: string,
    properties: Record<string, string | number | boolean>
  ) => {
    objects.push(
      createPointCityDesignObject({
        id,
        type,
        point: { x: objects.length - 40, z: 28 },
        overrides: { properties },
      })
    );
  };
  const addCorridorVariant = (
    type: CityDesignObjectType,
    id: string,
    properties: Record<string, string | number | boolean>,
    length = 8,
    width = 3
  ) => {
    objects.push(
      createCorridorCityDesignObject({
        id,
        type,
        start: { x: objects.length - 55, z: 34 },
        end: { x: objects.length - 55 + length, z: 36 },
        width,
        overrides: { properties },
      })
    );
  };

  for (const species of [
    'conifer',
    'fruit',
    'columnar_poplar',
    'ornamental_cherry',
    'flowering_plum',
    'custom_species',
  ]) {
    addPointVariant('tree', `tree-${species}`, { species });
  }
  addPointVariant('traffic_signal', 'signal-bicycle', { signalType: 'bicycle' });
  addPointVariant('traffic_signal', 'signal-pedestrian', { signalType: 'pedestrian' });
  addPointVariant('traffic_sign', 'sign-stop', { signType: 'stop' });
  addPointVariant('traffic_sign', 'sign-custom', { signType: 'custom' });
  addPointVariant('bus_stop', 'bus-stop-no-shelter', { shelter: false });
  addPointVariant('fountain', 'fountain-splash', { waterType: 'splash' });
  addPointVariant('fountain', 'fountain-decorative', { waterType: 'decorative' });

  addCorridorVariant('water_area', 'water-seating-edge', { edge: 'sitzkante' });
  addCorridorVariant('water_area', 'water-framed-edge', { edge: 'gefasst' });
  addCorridorVariant('parking_area', 'parking-angled', { orientation: 'angled' });
  addCorridorVariant('parking_area', 'parking-perpendicular', { orientation: 'perpendicular' });
  addCorridorVariant('sidewalk', 'sidewalk-accessible', {
    pathType: 'accessible',
    tactilePaving: true,
  });
  addCorridorVariant('sidewalk', 'sidewalk-promenade', { pathType: 'promenade' });
  addCorridorVariant('bike_lane', 'bike-protected', { protection: 'protected' });
  addCorridorVariant('bike_lane', 'bike-raised', { protection: 'raised' });
  addCorridorVariant('rail_track', 'rail-heavy', { railType: 'rail' });
  addCorridorVariant('rail_track', 'rail-light', { railType: 'light_rail' });
  addCorridorVariant(
    'station_platform',
    'platform-rail-elevated',
    { deckElevationMeters: 1.2, platformType: 'rail_platform', shelter: true },
    22,
    4
  );
  addCorridorVariant(
    'station_platform',
    'platform-bus-no-shelter',
    { deckElevationMeters: 0, platformType: 'bus_platform', shelter: false },
    12,
    4
  );
  addCorridorVariant('crossing', 'crossing-raised', { crossingType: 'raised' });
  addCorridorVariant('crossing', 'crossing-refuge', { crossingType: 'refuge' });
  addCorridorVariant('crossing', 'crossing-signalized', { crossingType: 'signalized' });
  addCorridorVariant('stairs', 'stairs-down', {
    deckElevationMeters: 2,
    incline: 'down',
    steps: 9,
  });
  addCorridorVariant('sports_pitch', 'sports-basketball', { sport: 'basketball' }, 12, 7);
  addCorridorVariant('street', 'street-living', { roadClass: 'living_street' });
  addCorridorVariant('street', 'street-pedestrian', { roadClass: 'pedestrian' });
  addCorridorVariant('street', 'street-construction-class', { roadClass: 'construction' });
  addCorridorVariant('street', 'street-construction-status', { status: 'construction' });
  addCorridorVariant('car_lane', 'lane-bus', { laneUse: 'bus', direction: 'two_way' });
  addCorridorVariant('car_lane', 'lane-taxi', { laneUse: 'taxi', direction: 'one_way' });
  addCorridorVariant('car_lane', 'lane-emergency', {
    laneUse: 'emergency',
    direction: 'reversible',
  });
  addCorridorVariant('traffic_calming', 'calming-hump', { calmingType: 'hump' });
  addCorridorVariant('traffic_calming', 'calming-narrowing', { calmingType: 'narrowing' });
  addCorridorVariant('traffic_calming', 'calming-chicane', { calmingType: 'chicane' });
  addCorridorVariant('construction_area', 'construction-closed', { status: 'closed' });
  addCorridorVariant(
    'street',
    'street-manual-bridge',
    { deckElevationMeters: 4, structureKind: 'bridge' },
    24,
    6
  );
  addCorridorVariant(
    'street',
    'street-embankment',
    { deckElevationMeters: 3, structureKind: 'embankment' },
    20,
    5
  );
  objects.push(
    createPathCorridorCityDesignObject({
      id: 'bush-row',
      type: 'bush',
      points: [
        { x: -18, z: 42 },
        { x: -8, z: 44 },
      ],
      width: 1.5,
    })
  );
  addPointVariant('tree', 'tree-nan-properties', {
    canopyDiameter: Number.NaN,
    height: Number.NaN,
  });
  addCorridorVariant('flower_bed', 'flower-bed-medium', {}, 8, 2);
  addCorridorVariant('flower_bed', 'flower-bed-narrow', {}, 8, 1);
  addCorridorVariant('flower_bed', 'flower-bed-wide', {}, 8, 4);
  addCorridorVariant('grass_strip', 'grass-narrow', {}, 8, 1);
  addCorridorVariant(
    'station_platform',
    'platform-default-kind',
    { platformType: 'tram_stop', shelter: true },
    10,
    3
  );
  addCorridorVariant(
    'station_platform',
    'platform-bus-elevated',
    { deckElevationMeters: 1.2, platformType: 'bus_platform', shelter: true },
    16,
    4
  );
  addCorridorVariant(
    'station_platform',
    'platform-too-short-for-shelter',
    { platformType: 'tram_stop', shelter: true },
    1,
    3
  );
  addCorridorVariant('bike_lane', 'bike-unknown-protection', { protection: 'unknown' }, 9, 2);
  addCorridorVariant('sidewalk', 'sidewalk-unknown-kind', { pathType: 'unknown' }, 9, 2);
  addCorridorVariant('water_area', 'water-unknown-kind', { waterType: 'unknown' }, 9, 3);
  addCorridorVariant('construction_area', 'construction-unknown-status', { status: 'unknown' });
  const polygonSource = createCorridorCityDesignObject({
    id: 'selected-polygon',
    type: 'public_space',
    start: { x: 18, z: 42 },
    end: { x: 28, z: 44 },
    width: 5,
  });
  objects.push({
    ...polygonSource,
    geometry: {
      kind: 'polygon',
      points: polygonSource.geometry.kind === 'corridor' ? polygonSource.geometry.polygon : [],
      area: 40,
    },
  });
  return objects;
}

function createOsmFeatureMatrix(): CityDesignOsmFeature[] {
  const origin = createEmptyCityDesignState().origin;
  const point = (east: number, north: number) => ({
    lat: origin.lat + north * 0.00001,
    lon: origin.lon + east * 0.00001,
  });
  const line = (offset: number) => [point(offset, -4), point(offset + 5, 0), point(offset + 9, 3)];
  const polygon = (offset: number) => [
    point(offset, 0),
    point(offset + 4, 0),
    point(offset + 4, 4),
    point(offset, 4),
  ];
  const features: CityDesignOsmFeature[] = [];
  const addPoint = (
    id: string,
    kind: CityDesignOsmFeature['kind'],
    subkind?: string,
    mappedObjectType?: CityDesignObjectType
  ) => {
    features.push({
      id,
      kind,
      geometryKind: 'point',
      point: point(features.length, features.length % 5),
      subkind,
      mappedObjectType,
    });
  };
  const addLine = (
    id: string,
    kind: CityDesignOsmFeature['kind'],
    overrides: Partial<CityDesignOsmFeature> = {}
  ) => {
    features.push({
      id,
      kind,
      geometryKind: 'line',
      points: line(features.length - 25),
      ...overrides,
    });
  };
  const addPolygon = (
    id: string,
    kind: CityDesignOsmFeature['kind'],
    overrides: Partial<CityDesignOsmFeature> = {}
  ) => {
    features.push({
      id,
      kind,
      geometryKind: 'polygon',
      points: polygon(features.length - 25),
      ...overrides,
    });
  };

  addPoint('tree', 'tree');
  addPoint('mapped-bush', 'street_furniture', undefined, 'bush');
  addPoint('water-point', 'water');
  addPoint('transit-point', 'transit');
  addPoint('traffic-crossing-point', 'traffic', 'crossing');
  addPoint('traffic-calming-point', 'traffic', 'traffic_calming');
  addPoint('traffic-signal-point', 'traffic');
  addPoint('barrier-gate-point', 'barrier', 'gate');
  addPoint('barrier-bollard-point', 'barrier');
  addPoint('utility-hydrant-point', 'utility', 'fire_hydrant');
  addPoint('utility-post-point', 'utility', 'post_box');
  addPoint('utility-recycling-point', 'utility', 'recycling');
  addPoint('utility-waste-point', 'utility', 'waste_basket');
  addPoint('utility-fallback-point', 'utility');
  addPoint('lamp-point', 'street_furniture', 'street_lamp');
  addPoint('bicycle-parking-point', 'street_furniture', 'bicycle_parking');
  addPoint('bench-point', 'street_furniture');
  addPoint('fallback-point', 'civic_area');
  addLine('tree-row', 'tree_row', { widthMeters: 1.8 });
  addLine('tree-row-default-width', 'tree_row');
  addLine('rail-surface', 'rail');
  addLine('rail-tunnel', 'rail', { level: 'tunnel', structureKind: 'tunnel' });
  addLine('rail-bridge', 'rail', {
    deckElevationMeters: 5,
    level: 'bridge',
    structureKind: 'viaduct',
  });
  addLine('rail-bridge-with-ramps', 'rail', {
    deckElevationMeters: 3,
    level: 'bridge',
    points: [point(200, 0), point(235, 0), point(270, 2)],
    structureKind: 'bridge',
  });
  addLine('short-rail-bridge', 'rail', {
    deckElevationMeters: 3,
    level: 'bridge',
    points: [point(280, 0), point(290, 0)],
    structureKind: 'bridge',
  });
  addLine('barrier-wall', 'barrier', { subkind: 'wall' });
  addLine('barrier-hedge', 'barrier', { subkind: 'hedge', renderColor: '#123456' });
  addLine('barrier-hedge-default', 'barrier', { subkind: 'hedge' });
  addLine('barrier-wall-colored', 'barrier', { subkind: 'wall', renderColor: '#654321' });
  addLine('barrier-kerb', 'barrier', { subkind: 'kerb' });
  addLine('traffic-crossing', 'traffic', { subkind: 'crossing' });
  addLine('traffic-calming', 'traffic', { subkind: 'traffic_calming' });
  addLine('transit-line', 'transit');
  addLine('furniture-line', 'street_furniture');
  addLine('utility-line', 'utility', { renderColor: '#abcdef' });
  addLine('road', 'road');
  addLine('road-construction', 'road', { subkind: 'construction' });
  addLine('road-track', 'road', { subkind: 'track' });
  addLine('road-tunnel', 'road', { level: 'tunnel', structureKind: 'tunnel' });
  addLine('road-bridge', 'road', {
    deckElevationMeters: 4,
    level: 'bridge',
    structureKind: 'bridge',
  });
  addLine('road-low-bridge', 'road', { level: 'bridge', structureKind: 'bridge' });
  addLine('sidewalk', 'sidewalk', { offsetMeters: 1.2 });
  addLine('sidewalk-steps', 'sidewalk', {
    deckElevationMeters: 2,
    incline: 'down',
    stepCount: 8,
    subkind: 'steps',
  });
  addLine('sidewalk-default-steps', 'sidewalk', { subkind: 'steps' });
  addLine('sidewalk-bridleway', 'sidewalk', { subkind: 'bridleway' });
  addLine('bike-line', 'bike_lane');
  addLine('parking-line', 'parking');
  addLine('loading-line', 'parking', { subkind: 'loading_zone' });
  addLine('water-line', 'water');
  addLine('water-line-intermittent', 'water', { subkind: 'intermittent' });
  addPolygon('barrier-polygon', 'barrier');
  addPolygon('traffic-polygon', 'traffic');
  addPolygon('transit-polygon', 'transit');
  addPolygon('sports', 'sports');
  addPolygon('playground', 'playground');
  addPolygon('construction', 'construction');
  addPolygon('landuse', 'landuse_context');
  addPolygon('civic', 'civic_area');
  addPolygon('sidewalk-polygon', 'sidewalk');
  addPolygon('sidewalk-bridleway-polygon', 'sidewalk', { subkind: 'bridleway' });
  addPolygon('bike-polygon', 'bike_lane');
  addPolygon('parking-polygon', 'parking');
  addPolygon('loading-polygon', 'parking', { subkind: 'loading_zone' });
  addPolygon('building', 'building', { height: 12, renderColor: '#998877' });
  addPolygon('building-defaults', 'building');
  addPolygon('building-tiny-edges', 'building', {
    height: 3,
    points: [point(320, 0), point(321, 0), point(320.5, 0.5)],
  });
  addPolygon('building-many-windows', 'building', {
    height: 20,
    points: [point(340, 0), point(440, 0), point(440, 100), point(340, 100)],
  });
  addPolygon('water', 'water');
  addPolygon('water-intermittent', 'water', { subkind: 'intermittent' });
  addPolygon('wetland', 'water', { subkind: 'wetland' });
  addPolygon('green', 'green');
  addPolygon('scrub', 'green', { subkind: 'scrub' });
  addPolygon('heath', 'green', { subkind: 'heath' });
  addPolygon('flower-bed', 'green', { subkind: 'flower_bed' });
  addPolygon('orchard', 'green', { subkind: 'orchard' });
  addPolygon('vineyard', 'green', { subkind: 'vineyard', renderColor: '#445566' });
  const shortPolygon = [point(80, 0), point(81, 1)];
  for (const [id, kind] of [
    ['short-barrier', 'barrier'],
    ['short-traffic', 'traffic'],
    ['short-sports', 'sports'],
    ['short-playground', 'playground'],
    ['short-construction', 'construction'],
    ['short-landuse', 'landuse_context'],
    ['short-civic', 'civic_area'],
    ['short-sidewalk', 'sidewalk'],
    ['short-bike', 'bike_lane'],
    ['short-parking', 'parking'],
    ['short-building', 'building'],
    ['short-water', 'water'],
    ['short-green', 'green'],
  ] as const) {
    addPolygon(id, kind, { points: shortPolygon });
  }
  const elevatedLine = (north: number) => [
    point(120, north),
    point(145, north),
    point(170, north + 2),
  ];
  addLine('bike-bridge', 'bike_lane', {
    deckElevationMeters: 2.5,
    level: 'bridge',
    points: elevatedLine(0),
    structureKind: 'bridge',
  });
  addLine('sidewalk-bridge', 'sidewalk', {
    deckElevationMeters: 2.5,
    level: 'bridge',
    points: elevatedLine(15),
    structureKind: 'bridge',
  });
  addLine('parking-bridge', 'parking', {
    deckElevationMeters: 2.5,
    level: 'bridge',
    points: elevatedLine(30),
    structureKind: 'bridge',
  });
  addLine('short-bike-bridge', 'bike_lane', {
    deckElevationMeters: 2.5,
    level: 'bridge',
    points: [point(190, 45), point(191, 45)],
    structureKind: 'bridge',
  });
  addLine('long-road-viaduct', 'road', {
    deckElevationMeters: 4,
    level: 'bridge',
    points: [point(200, 60), point(260, 60), point(320, 62)],
    structureKind: 'viaduct',
  });
  const oneSidedStart = point(400, 80);
  const oneSidedEnd = point(440, 80);
  addLine('one-sided-end-ramp', 'road', {
    deckElevationMeters: 3,
    level: 'bridge',
    points: [oneSidedStart, oneSidedEnd],
    structureKind: 'bridge',
  });
  addLine('one-sided-end-ramp-continuation', 'road', {
    deckElevationMeters: 3,
    level: 'bridge',
    points: [oneSidedStart, point(370, 80)],
    structureKind: 'bridge',
  });
  addLine('one-sided-end-ramp-lower', 'road', {
    points: [oneSidedEnd, point(470, 80)],
  });
  const reverseStart = point(400, 100);
  const reverseEnd = point(440, 100);
  addLine('one-sided-start-ramp', 'road', {
    deckElevationMeters: 3,
    level: 'bridge',
    points: [reverseStart, reverseEnd],
    structureKind: 'bridge',
  });
  addLine('one-sided-start-ramp-lower', 'road', {
    points: [point(370, 100), reverseStart],
  });
  addLine('one-sided-start-ramp-continuation', 'road', {
    deckElevationMeters: 3,
    level: 'bridge',
    points: [reverseEnd, point(470, 100)],
    structureKind: 'bridge',
  });
  return features;
}

describe('mountCityDesignScene', () => {
  it('mounts, updates and disposes the browser controller deterministically', async () => {
    sceneDoubles.useNestedShadowChild = true;
    const design = {
      ...createEmptyCityDesignState(),
      objects: [
        createPointCityDesignObject({
          id: 'nested-shadow-tree',
          type: 'tree',
          point: { x: 0, z: 0 },
        }),
      ],
    };
    const options = createOptions({
      design,
      initialCameraPose: {
        position: { x: 8, y: 60, z: 70 },
        target: { x: 2, y: 0, z: 3 },
      },
    });
    controller = await mountCityDesignScene(options);

    expect(sceneDoubles.renderers).toHaveLength(1);
    expect(sceneDoubles.controls).toHaveLength(1);
    expect(sceneDoubles.controls[0]?.mouseButtons.LEFT).not.toBe(-1);
    sceneDoubles.controls[0]?.emitChange();
    flushFrame();
    expect(sceneDoubles.renderers[0]?.render).toHaveBeenCalledOnce();
    expect(options.onCameraPoseChange).toHaveBeenCalledOnce();

    for (const key of ['ArrowLeft', 'a', 'ArrowRight', 'd', 'ArrowUp', 'w', 'ArrowDown', 's']) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key }));
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '-', code: 'Minus' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '+', code: 'Equal' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }));
    document.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space' }));
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA' }));
    const preventedEvent = new KeyboardEvent('keydown', { cancelable: true, key: 'ArrowLeft' });
    preventedEvent.preventDefault();
    document.dispatchEvent(preventedEvent);
    const input = document.createElement('input');
    document.body.append(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowLeft' }));
    window.dispatchEvent(new Event('blur'));
    expect(options.onPointerHover).toHaveBeenCalledWith(null, 'design');

    options.canvas.dispatchEvent(pointerEvent('pointerdown', { button: 4, buttons: 0 }));

    controller.updateInteractionMode({ interactionMode: 'place', readOnly: false });
    options.canvas.dispatchEvent(pointerEvent('pointerdown'));
    options.canvas.dispatchEvent(pointerEvent('pointermove', { buttons: 0 }));
    expect(options.onPointerDown).toHaveBeenCalledOnce();
    expect(options.onPointerMove).toHaveBeenCalledOnce();

    controller.updateSelection({
      selectedObjectId: null,
      selectedOsmWayId: null,
      selectedChangeRequestId: null,
      focusObjectId: null,
      focusOsmWayId: null,
      interactionMode: 'select',
      readOnly: false,
    });
    options.canvas.dispatchEvent(pointerEvent('pointerdown'));
    expect(options.onObjectSelect).toHaveBeenCalledWith(null);
    expect(options.onOsmWaySelect).toHaveBeenCalledWith(null);

    const preview = createCorridorGeometry({ x: 0, z: 0 }, { x: 8, z: 2 }, 2);
    controller.updatePlacementPreview({
      placementPreview: preview,
      placementPreviewType: 'bike_lane',
      placementStart: { x: 0, z: 0 },
    });
    flushFrame();
    controller.updatePlacementPreview({
      placementPreview: preview,
      placementPreviewType: null,
      placementStart: null,
    });
    flushFrame();
    controller.updateChangeRequests({
      changeRequests: [],
      selectedChangeRequestId: null,
      changeRequestColorMode: 'tinted',
    });
    controller.focusObject('missing-object');
    controller.focusOsmWay('missing-osm-way');

    const replacementHover = vi.fn();
    controller.updateHandlers({
      onPointerDown: vi.fn(),
      onPointerMove: vi.fn(),
      onPointerHover: replacementHover,
      onObjectSelect: vi.fn(),
      onOsmWaySelect: vi.fn(),
      onObjectRotate: vi.fn(),
      onCameraPoseChange: vi.fn(),
    });
    options.canvas.dispatchEvent(pointerEvent('pointerleave', { buttons: 0 }));
    expect(replacementHover).toHaveBeenCalledWith(null, 'design');

    controller.dispose();
    controller = null;
    expect(sceneDoubles.renderers[0]?.dispose).toHaveBeenCalledOnce();
    expect(sceneDoubles.controls[0]?.dispose).toHaveBeenCalledOnce();
  });

  it('reacts to ResizeObserver and array-backed grid materials', async () => {
    let resizeCallback: (() => void) | undefined;
    const disconnect = vi.fn();
    const observe = vi.fn();
    class TestResizeObserver {
      constructor(callback: () => void) {
        resizeCallback = callback;
      }
      disconnect = disconnect;
      observe = observe;
    }
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    sceneDoubles.useGridMaterialArray = true;
    const options = createOptions();
    controller = await mountCityDesignScene(options);

    expect(observe).toHaveBeenCalledWith(options.canvas);
    resizeCallback?.();
    Object.defineProperty(options.canvas, 'clientWidth', { configurable: true, value: 800 });
    window.dispatchEvent(new Event('resize'));
    flushFrame();
    expect(sceneDoubles.renderers[0]?.setSize).toHaveBeenLastCalledWith(800, 360, false);

    controller.dispose();
    controller = null;
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('renders every registered object kind and rebuilds filtered comparison layers', async () => {
    const performanceNow = vi.spyOn(performance, 'now').mockReturnValue(0);
    const design: CityDesignStateV1 = {
      ...createEmptyCityDesignState(),
      comparisonMode: 'split',
      objects: createObjectMatrix(),
    };
    const buildingId = design.objects.find(object => object.type === 'building')?.id ?? null;
    const pointId = design.objects.find(object => object.geometry.kind === 'point')?.id ?? null;
    const options = createOptions({
      design,
      interactionMode: 'select',
      selectedObjectId: 'street-manual-bridge',
      focusObjectId: 'selected-polygon',
    });

    controller = await mountCityDesignScene(options);
    flushFrame();
    const renderedScene = sceneDoubles.renderers[0]?.render.mock.calls[0]?.[0] as
      import('three').Scene | undefined;
    const animated: import('three').Object3D[] = [];
    renderedScene?.traverse(object => {
      if (object.userData.motion) animated.push(object);
    });
    const ripples = animated.filter(object => object.userData.motion === 'waterRipple');
    expect(ripples.length).toBeGreaterThan(1);
    const rippleWithArrayMaterial = ripples[0] as import('three').Mesh | undefined;
    if (rippleWithArrayMaterial && !Array.isArray(rippleWithArrayMaterial.material)) {
      rippleWithArrayMaterial.material = [rippleWithArrayMaterial.material];
      delete rippleWithArrayMaterial.userData.baseY;
      delete rippleWithArrayMaterial.userData.phase;
    }
    if (ripples[1]) delete ripples[1].userData.baseOpacity;
    const waterGlint = animated.find(object => object.userData.motion === 'waterGlint') as
      import('three').Mesh | undefined;
    if (waterGlint && !Array.isArray(waterGlint.material)) {
      waterGlint.material = [waterGlint.material];
    }
    const animatedTree = animated.find(object => object.userData.motion === 'tree');
    if (animatedTree) {
      delete animatedTree.userData.baseY;
      delete animatedTree.userData.phase;
    }
    flushFrame();
    performanceNow.mockReturnValue(10_000);
    flushFrame();
    expect(sceneDoubles.renderers[0]?.render).toHaveBeenCalledTimes(3);

    controller.updateDesign({
      design: { ...design, comparisonMode: 'original', objects: [...design.objects] },
      hiddenObjectIds: [design.objects[1]?.id ?? 'missing'],
      hiddenObjectCategories: ['greenery'],
    });
    controller.updateDesign({
      design: { ...design, comparisonMode: 'new_design', showStreetMarkings: false },
      hiddenObjectIds: [],
      hiddenObjectCategories: [],
    });
    controller.updateDesign({
      design: { ...design, comparisonMode: 'new_design', showStreetMarkings: false },
      hiddenObjectIds: [design.objects[1]?.id ?? 'missing'],
      hiddenObjectCategories: [],
    });
    for (const selectedObjectId of [
      'tree-row',
      'selected-polygon',
      buildingId,
      pointId,
      'street-manual-bridge',
      null,
    ]) {
      controller.updateSelection({
        selectedObjectId,
        selectedOsmWayId: null,
        selectedChangeRequestId: selectedObjectId === null ? 'changed-cr' : null,
        focusObjectId: selectedObjectId,
        focusOsmWayId: null,
        interactionMode: 'select',
        readOnly: false,
      });
    }
    expect(animationFrames.length).toBeGreaterThan(0);
  });

  it('evaluates every independent design rebuild input', async () => {
    let design = createEmptyCityDesignState();
    const options = createOptions({ design });
    controller = await mountCityDesignScene(options);
    const update = (
      nextDesign: CityDesignStateV1,
      hiddenObjectIds: string[] = [],
      hiddenObjectCategories: CityDesignSceneMountOptions['hiddenObjectCategories'] = []
    ) => {
      design = nextDesign;
      controller?.updateDesign({ design, hiddenObjectCategories, hiddenObjectIds });
    };

    update({
      ...design,
      osmSnapshot: {
        bbox: { south: 52.51, west: 13.39, north: 52.53, east: 13.42 },
        fetchedAt: 1,
        features: [],
      },
    });
    update({ ...design, origin: { ...design.origin, lat: design.origin.lat + 0.001 } });
    update({
      ...design,
      osmLayerVisibility: {
        ...createEmptyCityDesignState().osmLayerVisibility,
        ...design.osmLayerVisibility,
        road: false,
      } as CityDesignStateV1['osmLayerVisibility'],
    });
    update({ ...design, hiddenOsmWayIds: ['way-a'] });
    update({ ...design, hiddenOsmFeatureIds: ['way-b'] });
    update({ ...design, comparisonMode: 'split' });
    update({ ...design, showStreetMarkings: false });
    update({ ...design, objects: [...design.objects] });
    update({ ...design, showStreetMarkings: true });
    update({ ...design, comparisonMode: 'overlay' });
    update(design, ['object-a']);
    update(design, ['object-a'], ['greenery']);
    const stableHiddenObjectIds = ['object-a'];
    const stableHiddenObjectCategories: CityDesignSceneMountOptions['hiddenObjectCategories'] = [
      'greenery',
    ];
    const osmOnlyDesign = {
      ...design,
      showStreetMarkings: undefined,
      osmSnapshot: {
        bbox: { south: 52.51, west: 13.39, north: 52.53, east: 13.42 },
        fetchedAt: 2,
        features: [],
      },
    };
    controller.updateDesign({
      design: osmOnlyDesign,
      hiddenObjectIds: stableHiddenObjectIds,
      hiddenObjectCategories: stableHiddenObjectCategories,
    });
    controller.updateDesign({
      design: { ...osmOnlyDesign, origin: { ...osmOnlyDesign.origin } },
      hiddenObjectIds: stableHiddenObjectIds,
      hiddenObjectCategories: stableHiddenObjectCategories,
    });
    controller.updateInteractionMode({ interactionMode: 'camera', readOnly: false });

    expect(animationFrames.length).toBeGreaterThan(0);
  });

  it('contains degenerate persisted object geometries at their rendering boundaries', async () => {
    const emptyTreeRow = createPathCorridorCityDesignObject({
      id: 'empty-tree-row',
      type: 'tree',
      points: [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
      ],
      width: 1,
    });
    const sparseCenterline = Object.assign([{ x: 2, z: 2 }], { length: 2 }) as {
      x: number;
      z: number;
    }[];
    const sparseTreeRow: CityDesignObject = {
      ...emptyTreeRow,
      id: 'sparse-tree-row',
      geometry: {
        ...(emptyTreeRow.geometry as PathCorridorGeometry),
        kind: 'path_corridor',
        length: 4,
        points: sparseCenterline,
        polygon: [],
        roundedCenterline: sparseCenterline,
      },
    };
    const reverseSparseCenterline = Object.assign([], {
      1: { x: 3, z: 3 },
      length: 2,
    }) as { x: number; z: number }[];
    const reverseSparseTreeRow: CityDesignObject = {
      ...emptyTreeRow,
      id: 'reverse-sparse-tree-row',
      geometry: {
        ...(emptyTreeRow.geometry as PathCorridorGeometry),
        kind: 'path_corridor',
        length: 4,
        points: reverseSparseCenterline,
        polygon: [],
        roundedCenterline: reverseSparseCenterline,
      },
    };
    const duplicateTreeRow: CityDesignObject = {
      ...emptyTreeRow,
      id: 'duplicate-tree-row',
      geometry: {
        ...(emptyTreeRow.geometry as PathCorridorGeometry),
        kind: 'path_corridor',
        length: 4,
        points: [
          { x: 4, z: 4 },
          { x: 4, z: 4 },
        ],
        polygon: [],
        roundedCenterline: [
          { x: 4, z: 4 },
          { x: 4, z: 4 },
        ],
      },
    };
    const emptyPathTree: CityDesignObject = {
      ...emptyTreeRow,
      geometry: {
        ...(emptyTreeRow.geometry as PathCorridorGeometry),
        kind: 'path_corridor',
        length: 0,
        points: [],
        polygon: [],
        roundedCenterline: [],
      },
    };
    const emptyWater: CityDesignObject = {
      ...emptyPathTree,
      id: 'empty-water',
      type: 'water_area',
    };
    const emptySidewalk: CityDesignObject = {
      ...emptyPathTree,
      id: 'empty-sidewalk',
      type: 'sidewalk',
    };
    const buildingSource = createCorridorCityDesignObject({
      id: 'empty-building',
      type: 'building',
      start: { x: 5, z: 5 },
      end: { x: 10, z: 5 },
      width: 4,
    });
    const emptyBuilding: CityDesignObject = {
      ...buildingSource,
      geometry: { ...(buildingSource.geometry as CorridorGeometry), polygon: [] },
    };
    const polygonBuilding: CityDesignObject = {
      ...buildingSource,
      id: 'polygon-building',
      geometry: { kind: 'polygon', points: [], area: 0 },
    };
    const sportsSource = createCorridorCityDesignObject({
      id: 'empty-sports',
      type: 'sports_pitch',
      start: { x: -5, z: -5 },
      end: { x: -4.8, z: -5 },
      width: 0.1,
    });
    const emptySports: CityDesignObject = {
      ...sportsSource,
      geometry: { ...(sportsSource.geometry as CorridorGeometry), polygon: [] },
    };
    const emptyPolygon: CityDesignObject = {
      ...sportsSource,
      id: 'empty-polygon',
      type: 'public_space',
      geometry: { kind: 'polygon', points: [], area: 0 },
    };
    const emptyPlayground: CityDesignObject = {
      ...sportsSource,
      id: 'empty-playground',
      type: 'playground',
      geometry: { ...(sportsSource.geometry as CorridorGeometry), polygon: [] },
    };
    const shortLane = createCorridorCityDesignObject({
      id: 'short-lane',
      type: 'car_lane',
      start: { x: 0, z: -8 },
      end: { x: 0.4, z: -8 },
      width: 2,
    });
    const zeroLengthBridge = createCorridorCityDesignObject({
      id: 'zero-length-bridge',
      type: 'street',
      start: { x: 12, z: 12 },
      end: { x: 12, z: 12 },
      width: 4,
      overrides: {
        properties: { deckElevationMeters: 3, structureKind: 'bridge' },
      },
    });
    const design: CityDesignStateV1 = {
      ...createEmptyCityDesignState(),
      objects: [
        emptyPathTree,
        emptyWater,
        emptySidewalk,
        sparseTreeRow,
        reverseSparseTreeRow,
        duplicateTreeRow,
        emptyBuilding,
        polygonBuilding,
        emptySports,
        emptyPolygon,
        emptyPlayground,
        shortLane,
        zeroLengthBridge,
      ],
    };

    controller = await mountCityDesignScene(
      createOptions({ design, interactionMode: 'select', selectedObjectId: 'empty-building' })
    );
    flushFrame();

    expect(sceneDoubles.renderers[0]?.render).toHaveBeenCalledOnce();
  });

  it('renders defensive corridor boundaries and optional design defaults', async () => {
    const selectedStreet = createCorridorCityDesignObject({
      id: 'selected-flat-street',
      type: 'street',
      start: { x: 0, z: 0 },
      end: { x: 12, z: 0 },
      width: 4,
    });
    const shortPlatform = createCorridorCityDesignObject({
      id: 'short-platform',
      type: 'station_platform',
      start: { x: 20, z: 0 },
      end: { x: 21, z: 0 },
      width: 3,
      overrides: { properties: { platformType: 'tram_stop', shelter: true } },
    });
    const emptyPlatformSource = createPathCorridorCityDesignObject({
      id: 'empty-platform',
      type: 'station_platform',
      points: [
        { x: 24, z: 0 },
        { x: 28, z: 0 },
      ],
      width: 3,
      overrides: { properties: { platformType: 'tram_stop', shelter: true } },
    });
    const emptyPlatform: CityDesignObject = {
      ...emptyPlatformSource,
      geometry: {
        ...(emptyPlatformSource.geometry as PathCorridorGeometry),
        kind: 'path_corridor',
        length: 4,
        points: [],
        polygon: [],
        roundedCenterline: [],
      },
    };
    const emptyRailSource = createPathCorridorCityDesignObject({
      id: 'empty-rail',
      type: 'rail_track',
      points: [
        { x: 30, z: 0 },
        { x: 34, z: 0 },
      ],
      width: 1.6,
    });
    const emptyRail: CityDesignObject = {
      ...emptyRailSource,
      geometry: {
        ...(emptyRailSource.geometry as PathCorridorGeometry),
        kind: 'path_corridor',
        length: 4,
        points: [],
        polygon: [],
        roundedCenterline: [],
      },
    };
    const malformedBridgeSource = createPathCorridorCityDesignObject({
      id: 'malformed-duplicate-bridge',
      type: 'street',
      points: [
        { x: 40, z: 0 },
        { x: 41, z: 0 },
      ],
      width: 4,
      overrides: { properties: { deckElevationMeters: 3, structureKind: 'bridge' } },
    });
    const malformedBridge: CityDesignObject = {
      ...malformedBridgeSource,
      geometry: {
        ...(malformedBridgeSource.geometry as PathCorridorGeometry),
        kind: 'path_corridor',
        length: 10,
        points: [
          { x: 40, z: 0 },
          { x: 40, z: 0 },
        ],
        roundedCenterline: [
          { x: 40, z: 0 },
          { x: 40, z: 0 },
        ],
      },
    };
    const windingBridge = createPathCorridorCityDesignObject({
      id: 'winding-bridge',
      type: 'street',
      points: [
        { x: 50, z: 0 },
        { x: 52, z: 1 },
        { x: 50, z: 0 },
        { x: 62, z: 0 },
      ],
      width: 4,
      overrides: { properties: { deckElevationMeters: 3, structureKind: 'bridge' } },
    });
    const tinyBridge = createCorridorCityDesignObject({
      id: 'tiny-road-bridge',
      type: 'street',
      start: { x: 70, z: 0 },
      end: { x: 71, z: 0 },
      width: 4,
      overrides: { properties: { deckElevationMeters: 3, structureKind: 'bridge' } },
    });
    const design = {
      ...createEmptyCityDesignState(),
      showStreetMarkings: undefined as unknown as boolean,
      objects: [
        selectedStreet,
        shortPlatform,
        emptyPlatform,
        emptyRail,
        malformedBridge,
        windingBridge,
        tinyBridge,
      ],
    };

    controller = await mountCityDesignScene(
      createOptions({ design, interactionMode: 'select', selectedObjectId: selectedStreet.id })
    );
    flushFrame();

    expect(sceneDoubles.renderers[0]?.render).toHaveBeenCalledOnce();
  });

  it('uses fallback camera axes when camera and target overlap', async () => {
    const options = createOptions({
      initialCameraPose: {
        position: { x: 0, y: 0, z: 0 },
        target: { x: 0, y: 0, z: 0 },
      },
    });
    controller = await mountCityDesignScene(options);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }));
    expect(sceneDoubles.controls[0]?.update).toHaveBeenCalled();
  });

  it('coalesces touch gestures and honors read-only placement', async () => {
    const options = createOptions({ interactionMode: 'place' });
    controller = await mountCityDesignScene(options);
    const canvas = options.canvas;

    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 4, pointerType: 'touch' }));
    canvas.dispatchEvent(
      pointerEvent('pointermove', {
        clientX: 350,
        pointerId: 4,
        pointerType: 'touch',
      })
    );
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 4, pointerType: 'touch' }));
    expect(options.onPointerDown).not.toHaveBeenCalled();

    canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 5, pointerType: 'touch' }));
    canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 5, pointerType: 'touch' }));
    expect(options.onPointerDown).toHaveBeenCalledOnce();

    const pointerMoveCallsBeforeReadOnly = vi.mocked(options.onPointerMove).mock.calls.length;
    controller.updateInteractionMode({ interactionMode: 'place', readOnly: true });
    canvas.dispatchEvent(pointerEvent('pointerdown'));
    canvas.dispatchEvent(pointerEvent('pointermove'));
    expect(options.onPointerDown).toHaveBeenCalledOnce();
    expect(options.onPointerMove).toHaveBeenCalledTimes(pointerMoveCallsBeforeReadOnly);
  });

  it('routes raycast selection, rotation, cancellation and navigation gestures', async () => {
    const object = createPointCityDesignObject({
      id: 'selected-tree',
      type: 'tree',
      point: { x: 0, z: 0 },
    });
    const design: CityDesignStateV1 = {
      ...createEmptyCityDesignState(),
      objects: [object],
      osmSnapshot: {
        bbox: { south: 52.51, west: 13.39, north: 52.53, east: 13.42 },
        fetchedAt: 1,
        features: [createOsmFeatureMatrix()[0] as CityDesignOsmFeature],
      },
    };
    const options = createOptions({
      design,
      interactionMode: 'select',
      selectedObjectId: object.id,
    });
    controller = await mountCityDesignScene(options);
    const THREE = await import('three');
    const raycast = vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects');
    vi.spyOn(THREE.Ray.prototype, 'intersectPlane').mockImplementation((_plane, target) => {
      target.set(-10, 0, 0);
      return target;
    });
    const hit = (userData: Record<string, string>) =>
      [{ object: { userData } }] as unknown as import('three').Intersection[];

    const rotateHit = hit({ rotateHandleObjectId: object.id });
    raycast.mockReturnValueOnce(rotateHit).mockReturnValueOnce(rotateHit);
    vi.mocked(options.canvas.hasPointerCapture).mockReturnValue(true);
    options.canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 350 }));
    options.canvas.dispatchEvent(pointerEvent('pointerup', { clientX: 390 }));
    expect(options.onObjectRotate).toHaveBeenCalledWith(object.id, expect.any(Number));
    expect(options.canvas.releasePointerCapture).toHaveBeenCalled();

    raycast.mockReset();
    raycast.mockReturnValueOnce([]).mockReturnValueOnce(hit({ objectId: object.id }));
    options.canvas.dispatchEvent(pointerEvent('pointerdown'));
    expect(options.onObjectSelect).toHaveBeenCalledWith(object.id);

    raycast.mockReset();
    raycast
      .mockReturnValueOnce([])
      .mockReturnValueOnce([])
      .mockReturnValueOnce(hit({ osmWayId: 'tree' }));
    options.canvas.dispatchEvent(pointerEvent('pointerdown'));
    expect(options.onOsmWaySelect).toHaveBeenCalledWith('tree');

    raycast.mockReset();
    raycast.mockReturnValue(rotateHit);
    controller.updateInteractionMode({ interactionMode: 'select', readOnly: true });
    options.canvas.dispatchEvent(pointerEvent('pointerdown'));
    expect(options.onObjectRotate).toHaveBeenCalledOnce();

    options.canvas.dispatchEvent(pointerEvent('pointercancel'));
    options.canvas.dispatchEvent(
      pointerEvent('pointercancel', { pointerId: 7, pointerType: 'touch' })
    );
    options.canvas.dispatchEvent(pointerEvent('pointerleave', { pointerType: 'touch' }));
    options.canvas.dispatchEvent(
      pointerEvent('pointermove', { buttons: 1, shiftKey: true, clientX: 360 })
    );
    options.canvas.dispatchEvent(pointerEvent('pointermove', { button: 2, buttons: 2 }));
    const contextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    options.canvas.dispatchEvent(contextMenu);
    expect(contextMenu.defaultPrevented).toBe(true);
  });

  it('routes split-layer, keyboard-navigation and multi-touch edge states', async () => {
    const object = createPointCityDesignObject({
      id: 'input-tree',
      type: 'tree',
      point: { x: 0, z: 0 },
    });
    const osmFeature = createOsmFeatureMatrix().find(feature => feature.id === 'road');
    const design: CityDesignStateV1 = {
      ...createEmptyCityDesignState(),
      comparisonMode: 'split',
      objects: [object],
      osmSnapshot: {
        bbox: { south: 52.51, west: 13.39, north: 52.53, east: 13.42 },
        fetchedAt: 1,
        features: osmFeature ? [osmFeature] : [],
      },
    };
    const options = createOptions({
      design,
      interactionMode: 'select',
      selectedObjectId: object.id,
    });
    controller = await mountCityDesignScene(options);
    const THREE = await import('three');
    const raycast = vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects');
    vi.spyOn(THREE.Ray.prototype, 'intersectPlane').mockImplementation((_plane, target) => {
      target.set(-10, 0, 0);
      return target;
    });
    const hit = (userData: Record<string, string>) =>
      [{ object: { userData } }] as unknown as import('three').Intersection[];

    controller.updateInteractionMode({ interactionMode: 'place', readOnly: false });
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
    options.canvas.dispatchEvent(pointerEvent('pointermove', { buttons: 1 }));
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' }));
    options.canvas.dispatchEvent(pointerEvent('pointermove', { buttons: 1, shiftKey: true }));
    options.canvas.dispatchEvent(pointerEvent('pointermove', { buttons: 2 }));
    options.canvas.dispatchEvent(pointerEvent('pointermove', { buttons: 4 }));
    controller.updateInteractionMode({ interactionMode: 'select', readOnly: false });
    window.dispatchEvent(new Event('blur'));
    controller.focusOsmWay('missing-osm-way');

    raycast.mockReturnValue(hit({ rotateHandleObjectId: 'missing-object' }));
    options.canvas.dispatchEvent(pointerEvent('pointerdown'));

    controller.updatePlacementPreview({
      placementPreview: null,
      placementPreviewType: null,
      placementStart: { x: 1, z: 1 },
    });
    raycast.mockReturnValue([]);
    options.canvas.dispatchEvent(pointerEvent('pointerdown'));
    expect(options.onObjectSelect).toHaveBeenCalledWith(null);
    controller.updatePlacementPreview({
      placementPreview: null,
      placementPreviewType: null,
      placementStart: null,
    });

    raycast.mockReset();
    raycast
      .mockReturnValueOnce([])
      .mockReturnValueOnce([])
      .mockReturnValueOnce(hit({ osmWayId: 'road' }));
    options.canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 1 }));
    expect(options.onOsmWaySelect).toHaveBeenCalledWith('road');

    raycast.mockReset();
    raycast.mockReturnValue([]);
    options.canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 1 }));

    options.canvas.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 20, pointerType: 'touch' })
    );
    options.canvas.dispatchEvent(
      pointerEvent('pointermove', {
        clientX: 350,
        pointerId: 20,
        pointerType: 'touch',
      })
    );
    options.canvas.dispatchEvent(
      pointerEvent('pointerup', { pointerId: 20, pointerType: 'touch' })
    );

    options.canvas.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 21, pointerType: 'touch' })
    );
    options.canvas.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 22, pointerType: 'touch' })
    );
    options.canvas.dispatchEvent(
      pointerEvent('pointermove', { pointerId: 21, pointerType: 'touch' })
    );
    options.canvas.dispatchEvent(
      pointerEvent('pointerup', { pointerId: 21, pointerType: 'touch' })
    );
    options.canvas.dispatchEvent(
      pointerEvent('pointercancel', { pointerId: 22, pointerType: 'touch' })
    );

    options.canvas.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 23, pointerType: 'touch' })
    );
    options.canvas.dispatchEvent(
      pointerEvent('pointermove', { pointerId: 99, pointerType: 'touch' })
    );
    options.canvas.dispatchEvent(
      pointerEvent('pointerup', { pointerId: 23, pointerType: 'touch' })
    );
    options.canvas.dispatchEvent(
      pointerEvent('pointercancel', { pointerId: 99, pointerType: 'touch' })
    );

    options.canvas.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 30, pointerType: 'touch' })
    );
    options.canvas.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 31, pointerType: 'touch' })
    );
    options.canvas.dispatchEvent(
      pointerEvent('pointercancel', { pointerId: 31, pointerType: 'touch' })
    );
    options.canvas.dispatchEvent(
      pointerEvent('pointercancel', { pointerId: 30, pointerType: 'touch' })
    );

    raycast.mockReturnValue([]);
    options.canvas.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 32, pointerType: 'touch' })
    );
    options.canvas.dispatchEvent(
      pointerEvent('pointerup', { pointerId: 32, pointerType: 'touch' })
    );

    raycast.mockReturnValue(hit({ rotateHandleObjectId: object.id }));
    options.canvas.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 24, pointerType: 'touch' })
    );
    vi.mocked(options.canvas.hasPointerCapture).mockReturnValue(false);
    options.canvas.dispatchEvent(
      pointerEvent('pointerup', { clientX: 370, pointerId: 24, pointerType: 'touch' })
    );

    expect(sceneDoubles.controls[0]?.update).toHaveBeenCalled();
  });

  it('renders add, remove and update change-request overlays in both color modes', async () => {
    const point = createPointCityDesignObject({
      id: 'cr-point',
      type: 'tree',
      point: { x: -4, z: 2 },
    });
    const building = createCorridorCityDesignObject({
      id: 'cr-building',
      type: 'building',
      start: { x: 0, z: 0 },
      end: { x: 8, z: 2 },
      width: 5,
    });
    const corridor = createCorridorCityDesignObject({
      id: 'cr-bike-lane',
      type: 'bike_lane',
      start: { x: -8, z: -2 },
      end: { x: 2, z: -2 },
      width: 2,
    });
    const polygon: CityDesignObject = {
      ...corridor,
      id: 'cr-polygon',
      geometry: {
        kind: 'polygon',
        points: corridor.geometry.kind === 'corridor' ? corridor.geometry.polygon : [],
        area: 20,
      },
    };
    const changeRequests = [
      {
        id: 'cr-add-point',
        change_type: 'add',
        new_properties: { object: point },
      },
      {
        id: 'cr-remove-building',
        change_type: 'remove',
        original_properties: { object: building },
      },
      {
        id: 'cr-update-corridor',
        change_type: 'update',
        original_properties: { object: corridor },
        new_properties: { object: polygon },
      },
    ];
    const options = createOptions({
      changeRequestColorMode: undefined,
      changeRequests,
      selectedChangeRequestId: 'cr-add-point',
    });
    controller = await mountCityDesignScene(options);

    for (const selectedChangeRequestId of ['cr-remove-building', 'cr-update-corridor', null]) {
      controller.updateChangeRequests({
        changeRequestColorMode: 'tinted',
        changeRequests,
        selectedChangeRequestId,
      });
    }
    expect(animationFrames.length).toBeGreaterThan(0);
  });

  it('clones and styles array-backed materials in change-request overlays', async () => {
    sceneDoubles.useMeshMaterialArrays = true;
    const tree = createPointCityDesignObject({
      id: 'array-material-tree',
      type: 'tree',
      point: { x: 0, z: 0 },
    });
    const options = createOptions({
      changeRequestColorMode: 'tinted',
      changeRequests: [
        {
          id: 'array-material-cr',
          change_type: 'add',
          new_properties: { object: tree },
        },
      ],
      selectedChangeRequestId: null,
    });

    controller = await mountCityDesignScene(options);
    flushFrame();

    expect(sceneDoubles.renderers[0]?.render).toHaveBeenCalledOnce();
  });

  it('renders the complete OSM feature matrix including selected overlays', async () => {
    const features = createOsmFeatureMatrix();
    const design: CityDesignStateV1 = {
      ...createEmptyCityDesignState(),
      osmSnapshot: {
        bbox: { south: 52.51, west: 13.39, north: 52.53, east: 13.42 },
        fetchedAt: 1,
        features,
      },
    };
    const options = createOptions({
      design,
      focusOsmWayId: 'tree',
      selectedOsmWayId: 'tree',
    });
    controller = await mountCityDesignScene(options);
    flushFrame();

    for (const selectedOsmWayId of [
      'tree-row',
      'rail-bridge',
      'barrier-wall',
      'traffic-crossing',
      'sports',
      'road-bridge',
      'sidewalk-polygon',
      'sidewalk-steps',
      'building',
      'water-line',
      'water',
      'green',
    ]) {
      controller.updateSelection({
        selectedObjectId: null,
        selectedOsmWayId,
        selectedChangeRequestId: null,
        focusObjectId: null,
        focusOsmWayId: null,
        interactionMode: 'select',
        readOnly: false,
      });
    }

    controller.updateDesign({
      design: {
        ...design,
        hiddenOsmFeatureIds: ['green'],
        showStreetMarkings: false,
      },
      hiddenObjectIds: [],
      hiddenObjectCategories: [],
    });
    expect(sceneDoubles.renderers[0]?.render).toHaveBeenCalled();
    expect(animationFrames.length).toBeGreaterThan(0);
  });
});
