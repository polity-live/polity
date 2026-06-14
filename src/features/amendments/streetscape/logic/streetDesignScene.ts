import type {
  CorridorGeometry,
  PathCorridorGeometry,
  StreetDesignCameraPose,
  StreetDesignInteractionMode,
  StreetDesignLocalPoint,
  StreetDesignObject,
  StreetDesignObjectType,
  StreetDesignOsmLayerVisibility,
  StreetDesignStateV1,
} from '../types';
import { getStreetDesignComparisonLayers } from './streetDesignDiff';
import { getStreetDesignObjectDefinition } from './streetDesignObjectRegistry';
import { createCorridorGeometry } from './streetDesignPlacement';
import { projectGeoPointToLocal } from './streetDesignProjection';

export interface StreetDesignSceneMountOptions {
  canvas: HTMLCanvasElement;
  design: StreetDesignStateV1;
  placementPreview: CorridorGeometry | PathCorridorGeometry | null;
  placementPreviewType: StreetDesignObjectType | null;
  placementStart: StreetDesignLocalPoint | null;
  selectedObjectId: string | null;
  selectedOsmWayId: string | null;
  interactionMode: StreetDesignInteractionMode;
  readOnly: boolean;
  initialCameraPose: StreetDesignCameraPose | null;
  onPointerDown: (point: StreetDesignLocalPoint) => void;
  onPointerMove: (point: StreetDesignLocalPoint) => void;
  onObjectSelect: (objectId: string | null) => void;
  onOsmWaySelect: (osmWayId: string | null) => void;
  onCameraPoseChange: (pose: StreetDesignCameraPose) => void;
}

type ThreeModule = typeof import('three');
type Object3D = import('three').Object3D;
type Group = import('three').Group;
type RenderableCorridorGeometry = CorridorGeometry | PathCorridorGeometry;

const DEFAULT_OSM_LAYER_VISIBILITY: StreetDesignOsmLayerVisibility = {
  road: true,
  building: true,
  green: true,
  water: true,
};

export function toShapePoint(point: StreetDesignLocalPoint) {
  return {
    x: point.x,
    y: -point.z,
  };
}

function toGroundVector(THREE: ThreeModule, point: StreetDesignLocalPoint, y: number) {
  return new THREE.Vector3(point.x, y, point.z);
}

function makeShape(THREE: ThreeModule, points: StreetDesignLocalPoint[]) {
  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    const shapePoint = toShapePoint(point);
    if (index === 0) {
      shape.moveTo(shapePoint.x, shapePoint.y);
    } else {
      shape.lineTo(shapePoint.x, shapePoint.y);
    }
  });
  shape.closePath();
  return shape;
}

function setObjectId(object: Object3D, objectId: string) {
  object.userData.objectId = objectId;
  object.children.forEach(child => setObjectId(child, objectId));
}

function setOsmWayId(object: Object3D, osmWayId: string) {
  object.userData.osmWayId = osmWayId;
  object.children.forEach(child => setOsmWayId(child, osmWayId));
}

function getIntersectionUserDataValue(intersections: import('three').Intersection[], key: string) {
  return intersections.find(hit => hit.object.userData[key])?.object.userData[key] as
    | string
    | undefined;
}

function addFlatPolygon(args: {
  THREE: ThreeModule;
  group: Group;
  points: StreetDesignLocalPoint[];
  color: string;
  opacity?: number;
  y?: number;
  objectId?: string;
  osmWayId?: string;
}) {
  const { THREE, group, points, color, opacity = 1, y = 0.02, objectId, osmWayId } = args;
  if (points.length < 3) return null;

  const geometry = new THREE.ShapeGeometry(makeShape(THREE, points));
  const material = new THREE.MeshStandardMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    roughness: 0.85,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;

  if (objectId) {
    setObjectId(mesh, objectId);
  }

  if (osmWayId) {
    setOsmWayId(mesh, osmWayId);
  }

  group.add(mesh);
  return mesh;
}

function addCorridorMesh(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry;
  color: string;
  opacity?: number;
  y?: number;
  objectId?: string;
  osmWayId?: string;
}) {
  return addFlatPolygon({
    THREE: args.THREE,
    group: args.group,
    points: args.geometry.polygon,
    color: args.color,
    opacity: args.opacity,
    y: args.y,
    objectId: args.objectId,
    osmWayId: args.osmWayId,
  });
}

function addCorridorOutline(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry;
  color: string;
  y?: number;
  objectId?: string;
}) {
  const { THREE, group, geometry, color, y = 0.16, objectId } = args;
  const vertices = geometry.polygon.map(point => toGroundVector(THREE, point, y));
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
  const line = new THREE.LineLoop(
    lineGeometry,
    new THREE.LineBasicMaterial({ color, linewidth: 2 })
  );

  if (objectId) {
    setObjectId(line, objectId);
  }

  group.add(line);
}

function getCorridorCenterline(geometry: RenderableCorridorGeometry) {
  return geometry.kind === 'path_corridor'
    ? geometry.roundedCenterline
    : [geometry.start, geometry.end];
}

function normalizeDirection(start: StreetDesignLocalPoint, end: StreetDesignLocalPoint) {
  const length = Math.hypot(end.x - start.x, end.z - start.z);
  if (length <= 0) return { x: 0, z: 1 };

  return {
    x: (end.x - start.x) / length,
    z: (end.z - start.z) / length,
  };
}

function offsetPointFromDirection(
  point: StreetDesignLocalPoint,
  direction: StreetDesignLocalPoint,
  offset: number
) {
  return {
    x: point.x - direction.z * offset,
    z: point.z + direction.x * offset,
  };
}

function getCenterlineSample(centerline: StreetDesignLocalPoint[], distance: number) {
  if (centerline.length === 0) {
    return {
      point: { x: 0, z: 0 },
      direction: { x: 0, z: 1 },
    };
  }

  let remainingDistance = distance;
  for (let index = 0; index < centerline.length - 1; index += 1) {
    const start = centerline[index];
    const end = centerline[index + 1];
    if (!start || !end) continue;
    const segmentLength = Math.hypot(end.x - start.x, end.z - start.z);
    if (segmentLength <= 0) continue;

    if (remainingDistance <= segmentLength) {
      const ratio = remainingDistance / segmentLength;
      return {
        point: {
          x: start.x + (end.x - start.x) * ratio,
          z: start.z + (end.z - start.z) * ratio,
        },
        direction: normalizeDirection(start, end),
      };
    }

    remainingDistance -= segmentLength;
  }

  const lastPoint = centerline[centerline.length - 1] ?? { x: 0, z: 0 };
  const previousPoint = centerline[centerline.length - 2] ?? lastPoint;
  return {
    point: lastPoint,
    direction: normalizeDirection(previousPoint, lastPoint),
  };
}

function getCorridorSamples(geometry: RenderableCorridorGeometry, spacing: number) {
  const centerline = getCorridorCenterline(geometry);
  const safeSpacing = Math.max(spacing, 0.1);
  const samples: {
    point: StreetDesignLocalPoint;
    direction: StreetDesignLocalPoint;
  }[] = [];

  for (let offset = 0; offset <= geometry.length + 0.001; offset += safeSpacing) {
    samples.push(getCenterlineSample(centerline, Math.min(offset, geometry.length)));
  }

  if (samples.length === 0) {
    samples.push(getCenterlineSample(centerline, 0));
  }

  return samples;
}

function addPolygonOutline(args: {
  THREE: ThreeModule;
  group: Group;
  points: StreetDesignLocalPoint[];
  color: string;
  y?: number;
  osmWayId?: string;
}) {
  const { THREE, group, points, color, y = 0.18, osmWayId } = args;
  if (points.length < 3) return;

  const vertices = points.map(point => toGroundVector(THREE, point, y));
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
  const line = new THREE.LineLoop(
    lineGeometry,
    new THREE.LineBasicMaterial({ color, linewidth: 2 })
  );

  if (osmWayId) {
    setOsmWayId(line, osmWayId);
  }

  group.add(line);
}

function addStreetMarkings(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry;
  color?: string;
  y?: number;
  objectId?: string;
  osmWayId?: string;
}) {
  const { THREE, group, geometry, color = '#f8fafc', y = 0.14, objectId, osmWayId } = args;
  const dashLength = 2.4;
  const gapLength = 3.2;
  const width = 0.16;
  const centerline = getCorridorCenterline(geometry);
  const length = geometry.length;

  if (length < dashLength || centerline.length < 2) return;

  for (let offset = gapLength / 2; offset < length - 0.4; offset += dashLength + gapLength) {
    const dashEndOffset = Math.min(offset + dashLength, length);
    const start = getCenterlineSample(centerline, offset).point;
    const end = getCenterlineSample(centerline, dashEndOffset).point;

    addCorridorMesh({
      THREE,
      group,
      geometry: createCorridorGeometry(start, end, width),
      color,
      opacity: 0.95,
      y,
      objectId,
      osmWayId,
    });
  }
}

function addPointObject(args: {
  THREE: ThreeModule;
  group: Group;
  object: StreetDesignObject;
  selected: boolean;
  point?: StreetDesignLocalPoint;
  rotation?: number;
}) {
  const { THREE, group, object, selected } = args;
  const point = args.point ?? (object.geometry.kind === 'point' ? object.geometry.point : null);
  if (!point) return;

  const definition = getStreetDesignObjectDefinition(object.type);
  const root = new THREE.Group();
  root.position.set(point.x, 0, point.z);
  root.rotation.y =
    args.rotation ?? (object.geometry.kind === 'point' ? object.geometry.rotation : 0);

  if (definition.renderKind === 'tree') {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.16, 1.5, 8),
      new THREE.MeshStandardMaterial({ color: '#6f4d31' })
    );
    trunk.position.y = 0.75;
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 18, 12),
      new THREE.MeshStandardMaterial({ color: definition.color, roughness: 0.8 })
    );
    canopy.position.y = 1.8;
    root.add(trunk, canopy);
  } else if (definition.renderKind === 'bush') {
    const bush = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 16, 10),
      new THREE.MeshStandardMaterial({ color: definition.color, roughness: 0.9 })
    );
    bush.scale.y = 0.65;
    bush.position.y = 0.42;
    root.add(bush);
  } else {
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.18, 0.42),
      new THREE.MeshStandardMaterial({ color: definition.color, roughness: 0.55 })
    );
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.5, 0.14),
      new THREE.MeshStandardMaterial({ color: definition.color, roughness: 0.55 })
    );
    seat.position.y = 0.55;
    back.position.set(0, 0.78, -0.22);
    root.add(seat, back);
  }

  if (selected) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.12, 0.025, 8, 36),
      new THREE.MeshBasicMaterial({ color: '#facc15' })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.04;
    root.add(ring);
  }

  setObjectId(root, object.id);
  group.add(root);
}

function addPlantRowObject(args: {
  THREE: ThreeModule;
  group: Group;
  object: StreetDesignObject;
  selected: boolean;
}) {
  const { THREE, group, object, selected } = args;
  if (object.geometry.kind !== 'path_corridor') return;

  const definition = getStreetDesignObjectDefinition(object.type);
  const defaultSpacing = numberProperty(definition.defaultProperties.spacing, 2);
  const spacing = Math.max(numberProperty(object.properties.spacing, defaultSpacing), 0.1);
  const samples = getCorridorSamples(object.geometry, spacing);

  samples.forEach(sample => {
    addPointObject({
      THREE,
      group,
      object,
      selected: false,
      point: sample.point,
      rotation: Math.atan2(sample.direction.x, sample.direction.z),
    });
  });

  if (selected) {
    addCorridorOutline({
      THREE,
      group,
      geometry: object.geometry,
      color: '#facc15',
      objectId: object.id,
    });
  }
}

function numberProperty(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringProperty(value: unknown, fallback: string) {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function addBuildingObject(args: {
  THREE: ThreeModule;
  group: Group;
  object: StreetDesignObject;
  selected: boolean;
  opacity?: number;
}) {
  const { THREE, group, object, selected, opacity = 1 } = args;
  if (object.geometry.kind !== 'corridor' && object.geometry.kind !== 'path_corridor') return;

  const definition = getStreetDesignObjectDefinition(object.type);
  const height = Math.max(numberProperty(object.properties.height, 9), 1);
  const color = stringProperty(object.properties.color, definition.color);

  addExtrudedPolygon({
    THREE,
    group,
    points: object.geometry.polygon,
    height,
    color,
    opacity,
    objectId: object.id,
  });

  if (selected) {
    addCorridorOutline({
      THREE,
      group,
      geometry: object.geometry,
      color: '#facc15',
      y: height + 0.22,
      objectId: object.id,
    });
  }
}

function addExtrudedPolygon(args: {
  THREE: ThreeModule;
  group: Group;
  points: StreetDesignLocalPoint[];
  height: number;
  color: string;
  opacity?: number;
  objectId?: string;
  osmWayId?: string;
}) {
  const { THREE, group, points, height, color, opacity = 1, objectId, osmWayId } = args;
  if (points.length < 3) return null;

  const shape = makeShape(THREE, points);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
  });
  const material = new THREE.MeshStandardMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    roughness: 0.72,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.04;
  if (objectId) {
    setObjectId(mesh, objectId);
  }
  if (osmWayId) {
    setOsmWayId(mesh, osmWayId);
  }
  group.add(mesh);
  return mesh;
}

function addFlowerBedDetails(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry;
  objectId: string;
  animatedObjects: Object3D[];
  y?: number;
}) {
  const { THREE, group, geometry, objectId, animatedObjects, y = 0.1 } = args;
  const flowerColors = ['#f472b6', '#fb7185', '#facc15', '#a78bfa', '#f97316'];
  const samples = getCorridorSamples(
    geometry,
    Math.max(0.8, Math.min(1.25, geometry.width * 0.6))
  ).slice(0, 140);
  const lateralOffsets =
    geometry.width >= 2.2 ? [-geometry.width * 0.22, geometry.width * 0.22] : [0];

  samples.forEach((sample, sampleIndex) => {
    lateralOffsets.forEach((lateralOffset, offsetIndex) => {
      const point = offsetPointFromDirection(sample.point, sample.direction, lateralOffset);
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.024, 0.24, 5),
        new THREE.MeshStandardMaterial({ color: '#2f7d45', roughness: 0.9 })
      );
      stem.position.set(point.x, y + 0.12, point.z);

      const bloom = new THREE.Mesh(
        new THREE.SphereGeometry(0.095, 8, 6),
        new THREE.MeshStandardMaterial({
          color: flowerColors[(sampleIndex + offsetIndex) % flowerColors.length],
          roughness: 0.7,
        })
      );
      bloom.position.set(point.x, y + 0.28, point.z);
      bloom.scale.set(1, 0.72, 1);
      bloom.userData.baseY = bloom.position.y;
      bloom.userData.phase = sampleIndex * 0.55 + offsetIndex;

      setObjectId(stem, objectId);
      setObjectId(bloom, objectId);
      animatedObjects.push(bloom);
      group.add(stem, bloom);
    });
  });
}

function addPlacementStartMarker(args: {
  THREE: ThreeModule;
  group: Group;
  point: StreetDesignLocalPoint;
}) {
  const { THREE, group, point } = args;
  const marker = new THREE.Group();
  marker.position.set(point.x, 0.04, point.z);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.75, 0.035, 8, 32),
    new THREE.MeshBasicMaterial({ color: '#facc15' })
  );
  ring.rotation.x = Math.PI / 2;

  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 8),
    new THREE.MeshBasicMaterial({ color: '#facc15' })
  );
  dot.position.y = 0.16;

  marker.add(ring, dot);
  group.add(marker);
}

function addDesignObject(args: {
  THREE: ThreeModule;
  group: Group;
  object: StreetDesignObject;
  selected: boolean;
  showStreetMarkings: boolean;
  animatedObjects?: Object3D[];
  opacity?: number;
  y?: number;
}) {
  const {
    THREE,
    group,
    object,
    selected,
    showStreetMarkings,
    animatedObjects = [],
    opacity = 1,
    y = 0.05,
  } = args;
  const definition = getStreetDesignObjectDefinition(object.type);

  if (
    object.geometry.kind === 'path_corridor' &&
    (definition.renderKind === 'tree' || definition.renderKind === 'bush')
  ) {
    addPlantRowObject({ THREE, group, object, selected });
    return;
  }

  if (object.geometry.kind === 'point') {
    addPointObject({ THREE, group, object, selected });
    return;
  }

  if (definition.renderKind === 'building') {
    addBuildingObject({ THREE, group, object, selected, opacity });
    return;
  }

  if (object.geometry.kind === 'corridor' || object.geometry.kind === 'path_corridor') {
    addCorridorMesh({
      THREE,
      group,
      geometry: object.geometry,
      color: definition.color,
      opacity,
      y,
      objectId: object.id,
    });

    if (object.type === 'flower_bed') {
      addFlowerBedDetails({
        THREE,
        group,
        geometry: object.geometry,
        objectId: object.id,
        animatedObjects,
        y: y + 0.03,
      });
    }

    if (showStreetMarkings && (definition.renderKind === 'road' || object.type === 'car_lane')) {
      addStreetMarkings({
        THREE,
        group,
        geometry: object.geometry,
        objectId: object.id,
        y: y + 0.07,
      });
    }

    if (selected) {
      addCorridorOutline({
        THREE,
        group,
        geometry: object.geometry,
        color: '#facc15',
        objectId: object.id,
      });
    }
  }
}

function addOsmWays(args: {
  THREE: ThreeModule;
  group: Group;
  design: StreetDesignStateV1;
  selectedOsmWayId: string | null;
}) {
  const { THREE, group, design, selectedOsmWayId } = args;
  const snapshot = design.osmSnapshot;
  if (!snapshot) return;

  const layerVisibility = {
    ...DEFAULT_OSM_LAYER_VISIBILITY,
    ...(design.osmLayerVisibility ?? {}),
  };
  const hiddenOsmWayIds = new Set(design.hiddenOsmWayIds ?? []);
  const showStreetMarkings = design.showStreetMarkings ?? true;

  snapshot.ways.forEach(way => {
    if (!layerVisibility[way.kind] || hiddenOsmWayIds.has(way.id)) return;

    const localPoints = way.points.map(point => projectGeoPointToLocal(point, design.origin));
    const isSelected = way.id === selectedOsmWayId;

    if (way.kind === 'road') {
      for (let index = 0; index < localPoints.length - 1; index += 1) {
        const geometry = createCorridorGeometry(localPoints[index], localPoints[index + 1], 4.8);
        addCorridorMesh({
          THREE,
          group,
          geometry,
          color: '#7a8288',
          opacity: 0.8,
          y: 0.01,
          osmWayId: way.id,
        });
        if (showStreetMarkings) {
          addStreetMarkings({
            THREE,
            group,
            geometry,
            y: 0.08,
            osmWayId: way.id,
          });
        }
        if (isSelected) {
          addCorridorOutline({
            THREE,
            group,
            geometry,
            color: '#facc15',
            y: 0.2,
            objectId: undefined,
          });
        }
      }
      return;
    }

    if (way.kind === 'building') {
      const height = Math.max(way.height ?? 8, 3);
      addExtrudedPolygon({
        THREE,
        group,
        points: localPoints,
        height,
        color: '#b6aa9b',
        osmWayId: way.id,
      });
      if (isSelected) {
        addPolygonOutline({
          THREE,
          group,
          points: localPoints,
          color: '#facc15',
          y: height + 0.24,
          osmWayId: way.id,
        });
      }
      return;
    }

    addFlatPolygon({
      THREE,
      group,
      points: localPoints,
      color: way.kind === 'water' ? '#72a6d8' : '#9dbb78',
      opacity: 0.75,
      y: 0.015,
      osmWayId: way.id,
    });
    if (isSelected) {
      addPolygonOutline({
        THREE,
        group,
        points: localPoints,
        color: '#facc15',
        osmWayId: way.id,
      });
    }
  });
}

function createSceneGroups(THREE: ThreeModule, scene: import('three').Scene) {
  const originalGroup = new THREE.Group();
  const designGroup = new THREE.Group();
  scene.add(originalGroup, designGroup);
  return { originalGroup, designGroup };
}

export async function mountStreetDesignScene(options: StreetDesignSceneMountOptions) {
  const THREE = await import('three');
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
  const canvas = options.canvas;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.setClearColor(0xf7f5ef, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf7f5ef, 90, 220);

  const camera = new THREE.PerspectiveCamera(
    45,
    Math.max(canvas.clientWidth / Math.max(canvas.clientHeight, 1), 1),
    0.1,
    500
  );
  camera.position.set(0, 75, 85);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enableZoom = true;
  controls.enableRotate = options.interactionMode === 'camera';
  controls.enablePan = options.interactionMode === 'camera';
  controls.minDistance = 18;
  controls.maxDistance = 210;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.target.set(0, 0, 0);
  if (options.initialCameraPose) {
    camera.position.set(
      options.initialCameraPose.position.x,
      options.initialCameraPose.position.y,
      options.initialCameraPose.position.z
    );
    controls.target.set(
      options.initialCameraPose.target.x,
      options.initialCameraPose.target.y,
      options.initialCameraPose.target.z
    );
  }
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };
  controls.update();

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(35, 80, 25);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshStandardMaterial({ color: '#ede8dc', roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  const grid = new THREE.GridHelper(220, 44, 0xd0c7b9, 0xe0d8cb);
  grid.position.y = 0;
  scene.add(grid);

  const layers = getStreetDesignComparisonLayers(options.design.comparisonMode);
  const { originalGroup, designGroup } = createSceneGroups(THREE, scene);
  const animatedObjects: Object3D[] = [];

  if (layers.split) {
    originalGroup.position.x = -52;
    designGroup.position.x = 52;
  }

  if (layers.showOriginal) {
    addOsmWays({
      THREE,
      group: originalGroup,
      design: options.design,
      selectedOsmWayId: options.selectedOsmWayId,
    });
  }

  if (layers.showDesign) {
    const designOpacity = layers.showOverlay ? 0.72 : 1;
    options.design.objects.forEach(object => {
      addDesignObject({
        THREE,
        group: designGroup,
        object,
        selected: object.id === options.selectedObjectId,
        showStreetMarkings: options.design.showStreetMarkings ?? true,
        animatedObjects,
        opacity: designOpacity,
        y: layers.showOverlay ? 0.08 : 0.05,
      });
    });
  }

  if (options.placementStart) {
    addPlacementStartMarker({
      THREE,
      group: designGroup,
      point: options.placementStart,
    });
  }

  if (options.placementPreview) {
    const previewColor = options.placementPreviewType
      ? getStreetDesignObjectDefinition(options.placementPreviewType).color
      : '#facc15';

    addCorridorMesh({
      THREE,
      group: designGroup,
      geometry: options.placementPreview,
      color: previewColor,
      opacity: 0.45,
      y: 0.12,
    });
    addCorridorOutline({
      THREE,
      group: designGroup,
      geometry: options.placementPreview,
      color: '#facc15',
      y: 0.18,
    });
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const pointerPoint = new THREE.Vector3();

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== Math.floor(width * renderer.getPixelRatio())) {
      renderer.setSize(width, height, false);
      camera.aspect = Math.max(width / Math.max(height, 1), 1);
      camera.updateProjectionMatrix();
    }
  }

  function updatePointer(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    raycaster.ray.intersectPlane(groundPlane, pointerPoint);
    return {
      x: pointerPoint.x,
      z: pointerPoint.z,
    };
  }

  function handlePointerDown(event: PointerEvent) {
    if (options.interactionMode === 'camera') {
      return;
    }

    const point = updatePointer(event);

    const designPoint = {
      x: point.x - designGroup.position.x,
      z: point.z - designGroup.position.z,
    };

    if (!options.readOnly && options.placementStart) {
      options.onPointerDown(designPoint);
      return;
    }

    if (layers.split && point.x < 0) {
      const originalIntersections = raycaster.intersectObjects(originalGroup.children, true);
      const osmWayId = getIntersectionUserDataValue(originalIntersections, 'osmWayId');
      options.onObjectSelect(null);
      options.onOsmWaySelect(osmWayId ?? null);
      return;
    }

    const intersections = raycaster.intersectObjects(designGroup.children, true);
    const hitObjectId = getIntersectionUserDataValue(intersections, 'objectId');

    if (hitObjectId) {
      options.onObjectSelect(hitObjectId);
      options.onOsmWaySelect(null);
      return;
    }

    const originalIntersections = raycaster.intersectObjects(originalGroup.children, true);
    const osmWayId = getIntersectionUserDataValue(originalIntersections, 'osmWayId');

    if (osmWayId) {
      options.onObjectSelect(null);
      options.onOsmWaySelect(osmWayId);
      return;
    }

    if (!options.readOnly) {
      options.onPointerDown(designPoint);
    } else {
      options.onObjectSelect(null);
      options.onOsmWaySelect(null);
    }
  }

  function handlePointerMove(event: PointerEvent) {
    if (!options.readOnly && options.interactionMode === 'place') {
      const point = updatePointer(event);
      options.onPointerMove({
        x: point.x - designGroup.position.x,
        z: point.z - designGroup.position.z,
      });
    }
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
  }

  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('contextmenu', handleContextMenu);

  let animationFrame = 0;
  function render() {
    resize();
    controls.update();
    const elapsedSeconds = performance.now() / 1000;
    animatedObjects.forEach((object, index) => {
      const baseY =
        typeof object.userData.baseY === 'number' ? object.userData.baseY : object.position.y;
      const phase = typeof object.userData.phase === 'number' ? object.userData.phase : index;
      object.position.y = baseY + Math.sin(elapsedSeconds * 2.1 + phase) * 0.035;
      object.rotation.y += 0.012;
    });
    options.onCameraPoseChange({
      position: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      },
      target: {
        x: controls.target.x,
        y: controls.target.y,
        z: controls.target.z,
      },
    });
    renderer.render(scene, camera);
    animationFrame = window.requestAnimationFrame(render);
  }
  render();

  return () => {
    window.cancelAnimationFrame(animationFrame);
    canvas.removeEventListener('pointerdown', handlePointerDown);
    canvas.removeEventListener('pointermove', handlePointerMove);
    canvas.removeEventListener('contextmenu', handleContextMenu);
    controls.dispose();
    renderer.dispose();
  };
}
