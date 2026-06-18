import type {
  CorridorGeometry,
  PathCorridorGeometry,
  StreetDesignCameraPose,
  StreetDesignInteractionMode,
  StreetDesignLocalPoint,
  StreetDesignObject,
  StreetDesignObjectCategory,
  StreetDesignObjectType,
  StreetDesignOsmLayerVisibility,
  StreetDesignOsmWay,
  StreetDesignStateV1,
} from '../types';
import { getStreetDesignComparisonLayers } from './streetDesignDiff';
import { getStreetDesignObjectDefinition } from './streetDesignObjectRegistry';
import {
  createCorridorGeometry,
  getStreetDesignGeometryCenter,
  getStreetDesignGeometryRotationDeg,
} from './streetDesignPlacement';
import { projectGeoPointToLocal } from './streetDesignProjection';

export interface StreetDesignSceneMountOptions {
  canvas: HTMLCanvasElement;
  design: StreetDesignStateV1;
  placementPreview: CorridorGeometry | PathCorridorGeometry | null;
  placementPreviewType: StreetDesignObjectType | null;
  placementStart: StreetDesignLocalPoint | null;
  selectedObjectId: string | null;
  selectedOsmWayId: string | null;
  hiddenObjectIds: string[];
  hiddenObjectCategories: StreetDesignObjectCategory[];
  focusObjectId: string | null;
  focusOsmWayId: string | null;
  interactionMode: StreetDesignInteractionMode;
  readOnly: boolean;
  initialCameraPose: StreetDesignCameraPose | null;
  onPointerDown: (point: StreetDesignLocalPoint) => void;
  onPointerMove: (point: StreetDesignLocalPoint) => void;
  onObjectSelect: (objectId: string | null) => void;
  onOsmWaySelect: (osmWayId: string | null) => void;
  onObjectRotate: (objectId: string, rotationDeg: number) => void;
  onCameraPoseChange: (pose: StreetDesignCameraPose) => void;
}

type ThreeModule = typeof import('three');
type Object3D = import('three').Object3D;
type Group = import('three').Group;
type ThreeMaterial = import('three').Material;
type RenderableCorridorGeometry = CorridorGeometry | PathCorridorGeometry;

const DEFAULT_OSM_LAYER_VISIBILITY: StreetDesignOsmLayerVisibility = {
  road: true,
  building: true,
  green: true,
  water: true,
};

function seededUnit(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function seededRange(seed: number, min: number, max: number) {
  return min + seededUnit(seed) * (max - min);
}

function setSceneShadows(object: Object3D, castShadow: boolean, receiveShadow: boolean) {
  object.castShadow = castShadow;
  object.receiveShadow = receiveShadow;
  object.children.forEach(child => setSceneShadows(child, castShadow, receiveShadow));
}

function getSingleMaterial(object: Object3D) {
  const material = (object as { material?: ThreeMaterial | ThreeMaterial[] }).material;
  return material && !Array.isArray(material) ? material : null;
}

function setIdentities(args: { object: Object3D; objectId?: string; osmWayId?: string }) {
  const { object, objectId, osmWayId } = args;
  if (objectId) setObjectId(object, objectId);
  if (osmWayId) setOsmWayId(object, osmWayId);
}

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

function setRotateHandleObjectId(object: Object3D, objectId: string) {
  object.userData.rotateHandleObjectId = objectId;
  object.children.forEach(child => setRotateHandleObjectId(child, objectId));
}

function getIntersectionUserDataValue(intersections: import('three').Intersection[], key: string) {
  return intersections.find(hit => hit.object.userData[key])?.object.userData[key] as
    | string
    | undefined;
}

function addPickPolygon(args: {
  THREE: ThreeModule;
  group: Group;
  points: StreetDesignLocalPoint[];
  objectId?: string;
  osmWayId?: string;
  y?: number;
}) {
  const { THREE, group, points, objectId, osmWayId, y = 0.2 } = args;
  if (points.length < 3) return;

  const geometry = new THREE.ShapeGeometry(makeShape(THREE, points));
  const material = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.001,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;

  if (objectId) setObjectId(mesh, objectId);
  if (osmWayId) setOsmWayId(mesh, osmWayId);

  group.add(mesh);
}

function addExtrudedPickVolume(args: {
  THREE: ThreeModule;
  group: Group;
  points: StreetDesignLocalPoint[];
  height: number;
  objectId?: string;
  osmWayId?: string;
}) {
  const { THREE, group, points, height, objectId, osmWayId } = args;
  if (points.length < 3) return;

  const geometry = new THREE.ExtrudeGeometry(makeShape(THREE, points), {
    depth: Math.max(height, 0.8) + 0.4,
    bevelEnabled: false,
  });
  const material = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.001,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;

  if (objectId) setObjectId(mesh, objectId);
  if (osmWayId) setOsmWayId(mesh, osmWayId);

  group.add(mesh);
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
    roughness: 0.78,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  material.polygonOffset = true;
  material.polygonOffsetFactor = -0.5;
  material.polygonOffsetUnits = -0.5;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.receiveShadow = true;

  setIdentities({ object: mesh, objectId, osmWayId });

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
    const height = Math.max(numberProperty(object.properties.height, 4), 2.2);
    const canopyDiameter = Math.max(numberProperty(object.properties.canopyDiameter, 3), 1.4);
    const trunkHeight = Math.max(height * 0.38, 1.15);
    const canopyRadius = canopyDiameter * 0.5;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(canopyRadius * 0.11, canopyRadius * 0.16, trunkHeight, 9),
      new THREE.MeshStandardMaterial({ color: '#6f4d31', roughness: 0.88 })
    );
    trunk.position.y = trunkHeight / 2;
    setSceneShadows(trunk, true, true);
    root.add(trunk);

    const canopyGeometry = new THREE.SphereGeometry(1, 18, 12);
    const canopyColors = ['#2f6f38', definition.color, '#4f8f42', '#6a9b4f'];
    const canopyBaseY = trunkHeight + canopyRadius * 0.48;
    const lobeOffsets = [
      { x: 0, y: 0.18, z: 0, scale: 1.08 },
      { x: -0.38, y: -0.04, z: 0.12, scale: 0.76 },
      { x: 0.34, y: -0.02, z: -0.1, scale: 0.72 },
      { x: 0.06, y: 0.12, z: 0.38, scale: 0.66 },
    ];
    lobeOffsets.forEach((offset, index) => {
      const canopy = new THREE.Mesh(
        canopyGeometry,
        new THREE.MeshStandardMaterial({
          color: canopyColors[index % canopyColors.length],
          roughness: 0.86,
          metalness: 0,
        })
      );
      canopy.position.set(
        offset.x * canopyRadius,
        canopyBaseY + offset.y * canopyRadius,
        offset.z * canopyRadius
      );
      canopy.scale.set(
        canopyRadius * offset.scale,
        canopyRadius * 0.72 * offset.scale,
        canopyRadius * offset.scale
      );
      setSceneShadows(canopy, true, true);
      root.add(canopy);
    });
  } else if (definition.renderKind === 'bush') {
    const bushGeometry = new THREE.SphereGeometry(1, 14, 9);
    const bushMaterial = new THREE.MeshStandardMaterial({
      color: definition.color,
      roughness: 0.92,
    });
    for (let index = 0; index < 5; index += 1) {
      const bush = new THREE.Mesh(bushGeometry, bushMaterial);
      const angle = index * 1.31;
      const radius = index === 0 ? 0 : 0.34;
      bush.position.set(
        Math.cos(angle) * radius,
        0.42 + (index % 2) * 0.08,
        Math.sin(angle) * radius
      );
      const scale = 0.42 + seededUnit(index + point.x * 0.13 + point.z * 0.07) * 0.22;
      bush.scale.set(scale * 1.22, scale * 0.66, scale);
      setSceneShadows(bush, true, true);
      root.add(bush);
    }
  } else {
    const woodMaterial = new THREE.MeshStandardMaterial({
      color: definition.color,
      roughness: 0.68,
      metalness: 0.02,
    });
    const metalMaterial = new THREE.MeshStandardMaterial({
      color: '#343a40',
      roughness: 0.52,
      metalness: 0.22,
    });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 0.42), woodMaterial);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.14), woodMaterial);
    seat.position.y = 0.55;
    back.position.set(0, 0.78, -0.22);
    setSceneShadows(seat, true, true);
    setSceneShadows(back, true, true);
    root.add(seat, back);

    [-0.52, 0.52].forEach(x => {
      [-0.14, 0.14].forEach(z => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.08), metalMaterial);
        leg.position.set(x, 0.28, z);
        setSceneShadows(leg, true, true);
        root.add(leg);
      });
    });
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
  return root;
}

function addPlantRowObject(args: {
  THREE: ThreeModule;
  group: Group;
  object: StreetDesignObject;
  selected: boolean;
  animatedObjects?: Object3D[];
}) {
  const { THREE, group, object, selected, animatedObjects = [] } = args;
  if (object.geometry.kind !== 'path_corridor') return;

  const definition = getStreetDesignObjectDefinition(object.type);
  const defaultSpacing = numberProperty(definition.defaultProperties.spacing, 2);
  const spacing = Math.max(numberProperty(object.properties.spacing, defaultSpacing), 0.1);
  const samples = getCorridorSamples(object.geometry, spacing);

  samples.forEach(sample => {
    const plant = addPointObject({
      THREE,
      group,
      object,
      selected: false,
      point: sample.point,
      rotation: Math.atan2(sample.direction.x, sample.direction.z),
    });
    if (plant) {
      plant.userData.baseY = plant.position.y;
      plant.userData.phase = sample.point.x * 0.11 + sample.point.z * 0.07;
      plant.userData.motion = definition.renderKind === 'tree' ? 'tree' : 'bush';
      animatedObjects.push(plant);
    }
  });

  addPickPolygon({
    THREE,
    group,
    points: object.geometry.polygon,
    objectId: object.id,
    y: 0.22,
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

function getObjectCenter(object: StreetDesignObject) {
  return getStreetDesignGeometryCenter(object.geometry);
}

function getObjectRadius(object: StreetDesignObject) {
  const center = getObjectCenter(object);
  const points =
    object.geometry.kind === 'point'
      ? [object.geometry.point]
      : object.geometry.kind === 'corridor' || object.geometry.kind === 'path_corridor'
        ? object.geometry.polygon
        : object.geometry.points;
  const radius = points.reduce(
    (maxRadius, point) => Math.max(maxRadius, Math.hypot(point.x - center.x, point.z - center.z)),
    0
  );

  return Math.max(radius, 1.6);
}

function getObjectFocusPoint(design: StreetDesignStateV1, objectId: string | null) {
  if (!objectId) return null;
  const object = design.objects.find(item => item.id === objectId);
  if (!object) return null;

  return {
    center: getObjectCenter(object),
    radius: getObjectRadius(object),
  };
}

function isObjectVisible(
  object: StreetDesignObject,
  hiddenObjectIds: Set<string>,
  hiddenObjectCategories: Set<StreetDesignObjectCategory>
) {
  if (hiddenObjectIds.has(object.id)) return false;
  return !hiddenObjectCategories.has(getStreetDesignObjectDefinition(object.type).category);
}

function getOsmWayLocalPoints(way: StreetDesignOsmWay, design: StreetDesignStateV1) {
  return way.points.map(point => projectGeoPointToLocal(point, design.origin));
}

function getLocalPointsCenter(points: StreetDesignLocalPoint[]) {
  if (points.length === 0) return { x: 0, z: 0 };

  let minX = points[0]?.x ?? 0;
  let maxX = minX;
  let minZ = points[0]?.z ?? 0;
  let maxZ = minZ;

  points.forEach(point => {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  });

  return {
    x: (minX + maxX) / 2,
    z: (minZ + maxZ) / 2,
  };
}

function getOsmWayFocusPoint(design: StreetDesignStateV1, osmWayId: string | null) {
  if (!osmWayId || !design.osmSnapshot) return null;
  const way = design.osmSnapshot.ways.find(item => item.id === osmWayId);
  if (!way) return null;

  return getLocalPointsCenter(getOsmWayLocalPoints(way, design));
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
  addBuildingFacadeDetails({
    THREE,
    group,
    points: object.geometry.polygon,
    height,
    color,
    objectId: object.id,
  });
  addExtrudedPickVolume({
    THREE,
    group,
    points: object.geometry.polygon,
    height,
    objectId: object.id,
  });
  addPickPolygon({
    THREE,
    group,
    points: object.geometry.polygon,
    objectId: object.id,
    y: height + 0.28,
  });

  const edgeShape = makeShape(THREE, object.geometry.polygon);
  const edgeGeometry = new THREE.ExtrudeGeometry(edgeShape, {
    depth: height,
    bevelEnabled: false,
  });
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(edgeGeometry),
    new THREE.LineBasicMaterial({ color: '#f4efe6', transparent: true, opacity: 0.42 })
  );
  edges.rotation.x = -Math.PI / 2;
  edges.position.y = 0.05;
  setObjectId(edges, object.id);
  group.add(edges);

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
  bevel?: boolean;
}) {
  const {
    THREE,
    group,
    points,
    height,
    color,
    opacity = 1,
    objectId,
    osmWayId,
    bevel = true,
  } = args;
  if (points.length < 3) return null;

  const shape = makeShape(THREE, points);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: bevel,
    bevelSize: bevel ? Math.min(0.16, height * 0.018) : 0,
    bevelThickness: bevel ? Math.min(0.1, height * 0.012) : 0,
    bevelSegments: bevel ? 1 : 0,
  });
  const material = new THREE.MeshStandardMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    roughness: 0.66,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.04;
  setSceneShadows(mesh, true, true);
  setIdentities({ object: mesh, objectId, osmWayId });
  group.add(mesh);
  return mesh;
}

function addBuildingFacadeDetails(args: {
  THREE: ThreeModule;
  group: Group;
  points: StreetDesignLocalPoint[];
  height: number;
  color: string;
  objectId?: string;
  osmWayId?: string;
}) {
  const { THREE, group, points, height, color, objectId, osmWayId } = args;
  if (points.length < 3) return;

  const roof = addFlatPolygon({
    THREE,
    group,
    points,
    color,
    opacity: 0.96,
    y: height + 0.12,
    objectId,
    osmWayId,
  });
  if (roof) {
    const material = roof.material;
    if (!Array.isArray(material)) {
      material.color.offsetHSL(0, -0.05, -0.08);
    }
  }

  addPolygonOutline({
    THREE,
    group,
    points,
    color: '#f4efe6',
    y: height + 0.18,
    osmWayId,
  });

  const floors = Math.max(1, Math.min(6, Math.floor(height / 2.8)));
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: '#d7edf4',
    roughness: 0.28,
    metalness: 0.08,
    transparent: true,
    opacity: 0.74,
  });
  const sillMaterial = new THREE.MeshStandardMaterial({
    color: '#f4efe6',
    roughness: 0.78,
  });
  let renderedWindows = 0;

  for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
    const start = points[pointIndex];
    const end = points[(pointIndex + 1) % points.length];
    if (!start || !end) continue;

    const edgeLength = Math.hypot(end.x - start.x, end.z - start.z);
    if (edgeLength < 2.2) continue;

    const direction = normalizeDirection(start, end);
    const normal = { x: -direction.z, z: direction.x };
    const slots = Math.min(7, Math.max(1, Math.floor(edgeLength / 2.35)));
    const rotationY = -Math.atan2(direction.z, direction.x);

    for (let floor = 0; floor < floors; floor += 1) {
      for (let slot = 0; slot < slots; slot += 1) {
        if (renderedWindows >= 72) return;
        const ratio = (slot + 1) / (slots + 1);
        const center = {
          x: start.x + (end.x - start.x) * ratio + normal.x * 0.045,
          z: start.z + (end.z - start.z) * ratio + normal.z * 0.045,
        };
        const window = new THREE.Mesh(
          new THREE.BoxGeometry(Math.min(0.78, edgeLength / (slots * 2.2)), 0.54, 0.035),
          windowMaterial
        );
        window.position.set(center.x, Math.min(height - 0.55, 1.15 + floor * 2.35), center.z);
        window.rotation.y = rotationY;
        setSceneShadows(window, false, false);
        setIdentities({ object: window, objectId, osmWayId });
        group.add(window);

        if (floor === 0 || slot % 2 === 0) {
          const sill = new THREE.Mesh(
            new THREE.BoxGeometry(Math.min(0.88, edgeLength / (slots * 2)), 0.06, 0.045),
            sillMaterial
          );
          sill.position.set(center.x, window.position.y - 0.36, center.z);
          sill.rotation.y = rotationY;
          setIdentities({ object: sill, objectId, osmWayId });
          group.add(sill);
        }

        renderedWindows += 1;
      }
    }
  }
}

function addFlowerBedDetails(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry;
  objectId?: string;
  osmWayId?: string;
  animatedObjects: Object3D[];
  y?: number;
}) {
  const { THREE, group, geometry, objectId, osmWayId, animatedObjects, y = 0.1 } = args;
  const flowerColors = ['#d9467d', '#f59e0b', '#e879f9', '#f8fafc', '#fb7185'];
  const blossomGeometry = new THREE.SphereGeometry(0.045, 7, 5);
  const stemGeometry = new THREE.CylinderGeometry(0.012, 0.016, 0.2, 5);
  const leafGeometry = new THREE.ConeGeometry(0.035, 0.14, 4);
  const blossomMaterials = flowerColors.map(
    color => new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
  );
  const stemMaterial = new THREE.MeshStandardMaterial({ color: '#3f7d3b', roughness: 0.92 });
  const leafMaterial = new THREE.MeshStandardMaterial({ color: '#5d8b43', roughness: 0.94 });
  const samples = getCorridorSamples(
    geometry,
    Math.max(0.9, Math.min(1.35, geometry.width * 0.58))
  ).slice(0, 58);
  const lateralOffsets =
    geometry.width >= 3
      ? [-geometry.width * 0.3, -geometry.width * 0.1, geometry.width * 0.14, geometry.width * 0.32]
      : geometry.width >= 1.5
        ? [-geometry.width * 0.24, 0, geometry.width * 0.24]
        : [0];

  samples.forEach((sample, sampleIndex) => {
    lateralOffsets.forEach((lateralOffset, offsetIndex) => {
      const seed = sampleIndex * 17 + offsetIndex * 31 + geometry.width * 11;
      const point = offsetPointFromDirection(
        sample.point,
        sample.direction,
        lateralOffset + seededRange(seed, -0.18, 0.18)
      );
      const flower = new THREE.Group();
      flower.position.set(
        point.x + sample.direction.x * seededRange(seed + 2, -0.18, 0.18),
        y + 0.08,
        point.z + sample.direction.z * seededRange(seed + 3, -0.18, 0.18)
      );
      flower.rotation.y = sampleIndex * 0.61 + offsetIndex * 1.7 + seededRange(seed + 1, -0.4, 0.4);

      for (let leafIndex = 0; leafIndex < 3; leafIndex += 1) {
        const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
        leaf.position.set((leafIndex - 1) * 0.06, 0.02, seededRange(seed + leafIndex, -0.04, 0.04));
        leaf.rotation.z = leafIndex === 1 ? 0 : leafIndex === 0 ? 0.9 : -0.9;
        leaf.rotation.x = Math.PI / 2;
        setSceneShadows(leaf, true, false);
        flower.add(leaf);
      }

      for (let bloomIndex = 0; bloomIndex < 3; bloomIndex += 1) {
        const stem = new THREE.Mesh(stemGeometry, stemMaterial);
        const angle = bloomIndex * 2.1 + seededRange(seed + bloomIndex * 5, -0.35, 0.35);
        const radius = seededRange(seed + bloomIndex * 7, 0.02, 0.12);
        stem.position.set(Math.cos(angle) * radius, 0.1, Math.sin(angle) * radius);
        stem.rotation.z = seededRange(seed + bloomIndex * 9, -0.18, 0.18);
        setSceneShadows(stem, true, false);
        flower.add(stem);

        const blossom = new THREE.Mesh(
          blossomGeometry,
          blossomMaterials[(sampleIndex + offsetIndex + bloomIndex) % blossomMaterials.length]
        );
        blossom.position.set(
          stem.position.x,
          0.22 + seededRange(seed + bloomIndex, -0.02, 0.03),
          stem.position.z
        );
        blossom.scale.set(1.35, 0.74, 1.05);
        setSceneShadows(blossom, true, false);
        flower.add(blossom);
      }

      flower.userData.baseY = flower.position.y;
      flower.userData.phase = sampleIndex * 0.37 + offsetIndex * 0.91;
      flower.userData.motion = 'flower';

      setIdentities({ object: flower, objectId, osmWayId });
      animatedObjects.push(flower);
      group.add(flower);
    });
  });
}

function addGrassDetails(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry;
  objectId?: string;
  osmWayId?: string;
  animatedObjects: Object3D[];
  y?: number;
}) {
  const { THREE, group, geometry, objectId, osmWayId, animatedObjects, y = 0.12 } = args;
  const samples = getCorridorSamples(geometry, Math.max(1.05, geometry.width * 0.45)).slice(0, 90);
  const lateralOffsets =
    geometry.width >= 2.6
      ? [
          -geometry.width * 0.32,
          -geometry.width * 0.1,
          geometry.width * 0.12,
          geometry.width * 0.32,
        ]
      : geometry.width >= 1.4
        ? [-geometry.width * 0.22, geometry.width * 0.22]
        : [0];
  const bladeGeometry = new THREE.PlaneGeometry(0.035, 0.34);
  const bladeMaterials = ['#6f9e4f', '#8fba62', '#567f3f'].map(
    color => new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.DoubleSide })
  );

  samples.forEach((sample, sampleIndex) => {
    lateralOffsets.forEach((lateralOffset, offsetIndex) => {
      for (let bladeIndex = 0; bladeIndex < 2; bladeIndex += 1) {
        const seed = sampleIndex * 19 + offsetIndex * 43 + bladeIndex * 11;
        const point = offsetPointFromDirection(
          sample.point,
          sample.direction,
          lateralOffset + seededRange(seed, -0.14, 0.14)
        );
        const blade = new THREE.Mesh(
          bladeGeometry,
          bladeMaterials[(sampleIndex + offsetIndex + bladeIndex) % bladeMaterials.length]
        );
        blade.position.set(
          point.x + sample.direction.x * seededRange(seed + 1, -0.16, 0.16),
          y + 0.18,
          point.z + sample.direction.z * seededRange(seed + 2, -0.16, 0.16)
        );
        blade.rotation.y = sampleIndex * 0.7 + offsetIndex + seededRange(seed + 3, -0.8, 0.8);
        blade.rotation.z = seededRange(seed + 4, -0.22, 0.22);
        blade.scale.y = seededRange(seed + 5, 0.7, 1.35);
        blade.userData.baseY = blade.position.y;
        blade.userData.phase = sampleIndex * 0.43 + offsetIndex + bladeIndex * 0.6;
        blade.userData.motion = 'grass';
        setIdentities({ object: blade, objectId, osmWayId });
        animatedObjects.push(blade);
        group.add(blade);
      }
    });
  });
}

function addWaterSurface(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry | { polygon: StreetDesignLocalPoint[] };
  opacity?: number;
  y?: number;
  objectId?: string;
  osmWayId?: string;
}) {
  const { THREE, group, geometry, opacity = 0.72, y = 0.06, objectId, osmWayId } = args;
  addFlatPolygon({
    THREE,
    group,
    points: geometry.polygon,
    color: '#174f68',
    opacity: Math.min(opacity, 0.5),
    y: y - 0.016,
    objectId,
    osmWayId,
  });

  const surface = addFlatPolygon({
    THREE,
    group,
    points: geometry.polygon,
    color: '#2c9ac4',
    opacity,
    y,
    objectId,
    osmWayId,
  });
  if (surface) {
    surface.material = new THREE.MeshPhysicalMaterial({
      color: '#2f9fca',
      transparent: true,
      opacity,
      roughness: 0.18,
      metalness: 0.02,
      clearcoat: 0.85,
      clearcoatRoughness: 0.24,
      side: THREE.DoubleSide,
    });
    surface.receiveShadow = true;
  }
}

function addWaterDetails(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry;
  objectId?: string;
  osmWayId?: string;
  animatedObjects: Object3D[];
  y?: number;
}) {
  const { THREE, group, geometry, objectId, osmWayId, animatedObjects, y = 0.18 } = args;
  const samples = getCorridorSamples(geometry, Math.max(2.2, geometry.width * 0.55)).slice(0, 64);
  const rippleMaterials = ['#c7f4ff', '#e0fbff', '#ffffff'].map(
    (color, index) =>
      new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: index === 2 ? 0.2 : 0.28,
        roughness: 0.18,
        metalness: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
  );
  const glintGeometry = new THREE.CircleGeometry(0.22, 18);
  const glintMaterial = new THREE.MeshBasicMaterial({
    color: '#efffff',
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  samples.forEach((sample, index) => {
    const width = Math.max(0.55, Math.min(geometry.width * 0.34, 2.25));
    const lateralOffset = seededRange(index + geometry.width, -width, width);
    const center = offsetPointFromDirection(sample.point, sample.direction, lateralOffset);
    const waveLength = seededRange(index + 3, 0.85, 1.8);
    const start = {
      x: center.x - sample.direction.x * waveLength,
      z: center.z - sample.direction.z * waveLength,
    };
    const end = {
      x: center.x + sample.direction.x * waveLength,
      z: center.z + sample.direction.z * waveLength,
    };
    const wave = addCorridorMesh({
      THREE,
      group,
      geometry: createCorridorGeometry(start, end, seededRange(index + 8, 0.035, 0.085)),
      color: '#d8f8ff',
      opacity: 0.24,
      y: y + (index % 3) * 0.007,
      objectId,
      osmWayId,
    });
    if (!wave) return;
    wave.material = rippleMaterials[index % rippleMaterials.length].clone();
    wave.userData.baseY = wave.position.y;
    wave.userData.phase = index * 0.48;
    wave.userData.motion = 'waterRipple';
    wave.userData.baseOpacity = index % 3 === 2 ? 0.18 : 0.28;
    setIdentities({ object: wave, objectId, osmWayId });
    animatedObjects.push(wave);

    if (index % 5 === 1) {
      const glint = new THREE.Mesh(glintGeometry, glintMaterial.clone());
      glint.rotation.x = -Math.PI / 2;
      glint.position.set(center.x, y + 0.028, center.z);
      glint.scale.set(seededRange(index + 11, 1.2, 2.2), 0.34, 1);
      glint.userData.baseY = glint.position.y;
      glint.userData.phase = index * 0.73;
      glint.userData.motion = 'waterGlint';
      glint.userData.baseOpacity = 0.14;
      setIdentities({ object: glint, objectId, osmWayId });
      animatedObjects.push(glint);
      group.add(glint);
    }
  });
}

function addParkingMarkings(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry;
  objectId?: string;
  osmWayId?: string;
  y?: number;
}) {
  const { THREE, group, geometry, objectId, osmWayId, y = 0.16 } = args;
  const samples = getCorridorSamples(geometry, 2.6).slice(0, 80);

  samples.forEach(sample => {
    const start = offsetPointFromDirection(sample.point, sample.direction, -geometry.width * 0.42);
    const end = offsetPointFromDirection(sample.point, sample.direction, geometry.width * 0.42);
    addCorridorMesh({
      THREE,
      group,
      geometry: createCorridorGeometry(start, end, 0.08),
      color: '#f8fafc',
      opacity: 0.72,
      y,
      objectId,
      osmWayId,
    });
  });
}

function addSurfaceTexture(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry;
  objectId?: string;
  osmWayId?: string;
  color: string;
  opacity?: number;
  y?: number;
}) {
  const { THREE, group, geometry, objectId, osmWayId, color, opacity = 0.34, y = 0.13 } = args;
  const samples = getCorridorSamples(geometry, Math.max(1.8, geometry.width * 0.75)).slice(0, 86);

  samples.forEach((sample, index) => {
    const seed = index * 13 + geometry.width * 9;
    const offset = seededRange(seed, -geometry.width * 0.38, geometry.width * 0.38);
    const start = offsetPointFromDirection(
      sample.point,
      sample.direction,
      offset - seededRange(seed + 1, 0.24, 0.56)
    );
    const end = offsetPointFromDirection(
      sample.point,
      sample.direction,
      offset + seededRange(seed + 2, 0.24, 0.56)
    );
    addCorridorMesh({
      THREE,
      group,
      geometry: createCorridorGeometry(start, end, seededRange(seed + 3, 0.025, 0.06)),
      color,
      opacity,
      y,
      objectId,
      osmWayId,
    });
  });
}

function addCorridorEdgeStrips(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry;
  color: string;
  opacity?: number;
  y?: number;
  objectId?: string;
  osmWayId?: string;
}) {
  const { THREE, group, geometry, color, opacity = 0.72, y = 0.14, objectId, osmWayId } = args;
  const centerline = getCorridorCenterline(geometry);
  if (centerline.length < 2) return;

  const offsets = [-geometry.width * 0.5 + 0.08, geometry.width * 0.5 - 0.08];
  offsets.forEach(offset => {
    for (let index = 0; index < centerline.length - 1; index += 1) {
      const startPoint = centerline[index];
      const endPoint = centerline[index + 1];
      if (!startPoint || !endPoint) continue;
      const direction = normalizeDirection(startPoint, endPoint);
      const start = offsetPointFromDirection(startPoint, direction, offset);
      const end = offsetPointFromDirection(endPoint, direction, offset);
      addCorridorMesh({
        THREE,
        group,
        geometry: createCorridorGeometry(start, end, 0.08),
        color,
        opacity,
        y,
        objectId,
        osmWayId,
      });
    }
  });
}

function addRoadSurfaceDetails(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry;
  objectId?: string;
  osmWayId?: string;
  y?: number;
}) {
  const { THREE, group, geometry, objectId, osmWayId, y = 0.12 } = args;
  addSurfaceTexture({
    THREE,
    group,
    geometry,
    objectId,
    osmWayId,
    color: '#20272b',
    opacity: 0.22,
    y,
  });
  addSurfaceTexture({
    THREE,
    group,
    geometry,
    objectId,
    osmWayId,
    color: '#6e777c',
    opacity: 0.16,
    y: y + 0.006,
  });
  addCorridorEdgeStrips({
    THREE,
    group,
    geometry,
    objectId,
    osmWayId,
    color: '#d5d0c5',
    opacity: 0.5,
    y: y + 0.012,
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
    addPlantRowObject({ THREE, group, object, selected, animatedObjects });
    return;
  }

  if (object.geometry.kind === 'point') {
    const pointObject = addPointObject({ THREE, group, object, selected });
    if (pointObject && (definition.renderKind === 'tree' || definition.renderKind === 'bush')) {
      pointObject.userData.baseY = pointObject.position.y;
      pointObject.userData.phase = object.geometry.point.x * 0.11 + object.geometry.point.z * 0.07;
      pointObject.userData.motion = definition.renderKind === 'tree' ? 'tree' : 'bush';
      animatedObjects.push(pointObject);
    }
    return;
  }

  if (definition.renderKind === 'building') {
    addBuildingObject({ THREE, group, object, selected, opacity });
    return;
  }

  if (object.geometry.kind === 'corridor' || object.geometry.kind === 'path_corridor') {
    const surfaceColor =
      object.type === 'flower_bed'
        ? '#4e7743'
        : object.type === 'water_area'
          ? '#2f9fca'
          : object.type === 'street' || object.type === 'car_lane'
            ? '#3f474c'
            : object.type === 'parking_area'
              ? '#697482'
              : object.type === 'sidewalk'
                ? '#b9af9f'
                : definition.color;

    if (object.type === 'water_area') {
      addWaterSurface({
        THREE,
        group,
        geometry: object.geometry,
        opacity: Math.min(opacity, 0.76),
        y,
        objectId: object.id,
      });
    } else {
      addCorridorMesh({
        THREE,
        group,
        geometry: object.geometry,
        color: surfaceColor,
        opacity,
        y,
        objectId: object.id,
      });
    }
    addPickPolygon({
      THREE,
      group,
      points: object.geometry.polygon,
      objectId: object.id,
      y: y + 0.2,
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

    if (object.type === 'grass_strip') {
      addGrassDetails({
        THREE,
        group,
        geometry: object.geometry,
        objectId: object.id,
        animatedObjects,
        y: y + 0.02,
      });
    }

    if (object.type === 'water_area') {
      addWaterDetails({
        THREE,
        group,
        geometry: object.geometry,
        objectId: object.id,
        animatedObjects,
        y: y + 0.08,
      });
    }

    if (object.type === 'parking_area') {
      addSurfaceTexture({
        THREE,
        group,
        geometry: object.geometry,
        objectId: object.id,
        color: '#454f59',
        opacity: 0.2,
        y: y + 0.06,
      });
      addParkingMarkings({
        THREE,
        group,
        geometry: object.geometry,
        objectId: object.id,
        y: y + 0.08,
      });
    }

    if (object.type === 'sidewalk' || object.type === 'bike_lane') {
      addSurfaceTexture({
        THREE,
        group,
        geometry: object.geometry,
        objectId: object.id,
        color: object.type === 'bike_lane' ? '#9be8de' : '#e9dfcf',
        opacity: object.type === 'bike_lane' ? 0.28 : 0.34,
        y: y + 0.07,
      });
      addCorridorEdgeStrips({
        THREE,
        group,
        geometry: object.geometry,
        objectId: object.id,
        color: object.type === 'bike_lane' ? '#c7fff5' : '#d4c6b5',
        opacity: 0.42,
        y: y + 0.08,
      });
    }

    if (definition.renderKind === 'road' || object.type === 'car_lane') {
      addRoadSurfaceDetails({
        THREE,
        group,
        geometry: object.geometry,
        objectId: object.id,
        y: y + 0.055,
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
  animatedObjects: Object3D[];
}) {
  const { THREE, group, design, selectedOsmWayId, animatedObjects } = args;
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

    const localPoints = getOsmWayLocalPoints(way, design);
    const isSelected = way.id === selectedOsmWayId;

    if (way.kind === 'road') {
      for (let index = 0; index < localPoints.length - 1; index += 1) {
        const geometry = createCorridorGeometry(localPoints[index], localPoints[index + 1], 4.8);
        addCorridorMesh({
          THREE,
          group,
          geometry,
          color: '#4b545a',
          opacity: 0.8,
          y: 0.01,
          osmWayId: way.id,
        });
        addRoadSurfaceDetails({
          THREE,
          group,
          geometry,
          osmWayId: way.id,
          y: 0.075,
        });
        addPickPolygon({
          THREE,
          group,
          points: geometry.polygon,
          osmWayId: way.id,
          y: 0.18,
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
      addBuildingFacadeDetails({
        THREE,
        group,
        points: localPoints,
        height,
        color: '#b6aa9b',
        osmWayId: way.id,
      });
      addExtrudedPickVolume({
        THREE,
        group,
        points: localPoints,
        height,
        osmWayId: way.id,
      });
      addPickPolygon({
        THREE,
        group,
        points: localPoints,
        osmWayId: way.id,
        y: height + 0.22,
      });
      if (isSelected) {
        addExtrudedPolygon({
          THREE,
          group,
          points: localPoints,
          height: height + 0.08,
          color: '#facc15',
          opacity: 0.16,
          osmWayId: way.id,
        });
        addPolygonOutline({
          THREE,
          group,
          points: localPoints,
          color: '#facc15',
          y: 0.16,
          osmWayId: way.id,
        });
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

    if (way.kind === 'water') {
      addWaterSurface({
        THREE,
        group,
        geometry: { polygon: localPoints },
        opacity: 0.62,
        y: 0.018,
        osmWayId: way.id,
      });
    } else {
      addFlatPolygon({
        THREE,
        group,
        points: localPoints,
        color: '#89a96b',
        opacity: 0.78,
        y: 0.015,
        osmWayId: way.id,
      });
      if (localPoints.length >= 3) {
        const firstPoint = localPoints[0] ?? { x: 0, z: 0 };
        const secondPoint = localPoints[1] ?? firstPoint;
        const roughGeometry = createCorridorGeometry(firstPoint, secondPoint, 1);
        addGrassDetails({
          THREE,
          group,
          geometry: {
            ...roughGeometry,
            polygon: localPoints,
            width: Math.max(2, roughGeometry.width),
          },
          osmWayId: way.id,
          animatedObjects,
          y: 0.04,
        });
      }
    }
    addPickPolygon({
      THREE,
      group,
      points: localPoints,
      osmWayId: way.id,
      y: 0.16,
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

function addRotateHandle(args: { THREE: ThreeModule; group: Group; object: StreetDesignObject }) {
  const { THREE, group, object } = args;
  const center = getObjectCenter(object);
  const radius = getObjectRadius(object) + 2.4;
  const rotationRad = (getStreetDesignGeometryRotationDeg(object.geometry) * Math.PI) / 180;
  const handlePoint = {
    x: center.x + Math.sin(rotationRad) * radius,
    z: center.z + Math.cos(rotationRad) * radius,
  };

  const handle = new THREE.Group();
  handle.position.set(handlePoint.x, 0.48, handlePoint.z);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.045, 8, 28),
    new THREE.MeshBasicMaterial({ color: '#facc15' })
  );
  ring.rotation.x = Math.PI / 2;
  const pickSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 12, 8),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.001 })
  );
  handle.add(ring, pickSphere);
  setRotateHandleObjectId(handle, object.id);

  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
    toGroundVector(THREE, center, 0.12),
    toGroundVector(THREE, handlePoint, 0.12),
  ]);
  const line = new THREE.Line(
    lineGeometry,
    new THREE.LineBasicMaterial({ color: '#facc15', transparent: true, opacity: 0.55 })
  );
  setRotateHandleObjectId(line, object.id);

  group.add(line, handle);
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
  renderer.setClearColor(0x06110d, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x14211a, 110, 245);

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

  scene.add(new THREE.HemisphereLight(0xddefff, 0x4b5c42, 0.9));
  scene.add(new THREE.AmbientLight(0xffffff, 0.32));
  const sun = new THREE.DirectionalLight(0xfff6df, 1.85);
  sun.position.set(44, 92, 34);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.bias = -0.00028;
  const shadowCamera = sun.shadow.camera as import('three').OrthographicCamera;
  shadowCamera.left = -120;
  shadowCamera.right = 120;
  shadowCamera.top = 120;
  shadowCamera.bottom = -120;
  shadowCamera.near = 1;
  shadowCamera.far = 220;
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshStandardMaterial({ color: '#bfc7ad', roughness: 0.94 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(220, 44, 0x8a9484, 0xc9cfbd);
  grid.position.y = 0;
  const gridMaterial = grid.material;
  if (Array.isArray(gridMaterial)) {
    gridMaterial.forEach(material => {
      material.transparent = true;
      material.opacity = 0.14;
    });
  } else {
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.14;
  }
  scene.add(grid);

  const layers = getStreetDesignComparisonLayers(options.design.comparisonMode);
  const { originalGroup, designGroup } = createSceneGroups(THREE, scene);
  const animatedObjects: Object3D[] = [];
  const hiddenObjectIds = new Set(options.hiddenObjectIds);
  const hiddenObjectCategories = new Set(options.hiddenObjectCategories);
  const visibleObjects = options.design.objects.filter(object =>
    isObjectVisible(object, hiddenObjectIds, hiddenObjectCategories)
  );

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
      animatedObjects,
    });
  }

  if (layers.showDesign) {
    const designOpacity = layers.showOverlay ? 0.72 : 1;
    visibleObjects.forEach(object => {
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

    const selectedObject = visibleObjects.find(object => object.id === options.selectedObjectId);
    if (selectedObject && options.interactionMode === 'select' && !options.readOnly) {
      addRotateHandle({ THREE, group: designGroup, object: selectedObject });
    }
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

  const selectedObjectFocus = getObjectFocusPoint(options.design, options.focusObjectId);
  const selectedOsmFocusPoint = getOsmWayFocusPoint(options.design, options.focusOsmWayId);
  const focusPoint = selectedObjectFocus?.center ?? selectedOsmFocusPoint;
  const focusGroup = selectedObjectFocus ? designGroup : originalGroup;
  const focusDistance = selectedObjectFocus
    ? Math.max(36, Math.min(92, selectedObjectFocus.radius * 4 + 34))
    : 62;
  const focusHeight = selectedObjectFocus
    ? Math.max(camera.position.y, Math.min(74, selectedObjectFocus.radius * 2.2 + 40))
    : Math.max(camera.position.y, 52);
  const focusAnimation = focusPoint
    ? {
        startedAt: performance.now(),
        durationMs: 350,
        startTarget: controls.target.clone(),
        startPosition: camera.position.clone(),
        endTarget: new THREE.Vector3(
          focusPoint.x + focusGroup.position.x,
          0,
          focusPoint.z + focusGroup.position.z
        ),
        endPosition: new THREE.Vector3(
          focusPoint.x + focusGroup.position.x,
          focusHeight,
          focusPoint.z + focusGroup.position.z + focusDistance
        ),
      }
    : null;

  const raycaster = new THREE.Raycaster();
  raycaster.params.Line = { threshold: 2 };
  raycaster.params.Points = { threshold: 2 };
  const pointer = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const pointerPoint = new THREE.Vector3();
  let activeRotateDrag: {
    objectId: string;
    center: StreetDesignLocalPoint;
  } | null = null;

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

  function toDesignPoint(point: StreetDesignLocalPoint) {
    const designPoint = {
      x: point.x - designGroup.position.x,
      z: point.z - designGroup.position.z,
    };

    return designPoint;
  }

  function handlePlacePointerDown(event: PointerEvent) {
    const point = updatePointer(event);

    if (!options.readOnly) {
      options.onPointerDown(toDesignPoint(point));
    }
  }

  function handleSelectPointerDown(event: PointerEvent) {
    const point = updatePointer(event);
    const designIntersections = raycaster.intersectObjects(designGroup.children, true);
    const rotateObjectId = getIntersectionUserDataValue(
      designIntersections,
      'rotateHandleObjectId'
    );

    if (rotateObjectId && !options.readOnly) {
      const object = options.design.objects.find(item => item.id === rotateObjectId);
      if (object) {
        activeRotateDrag = {
          objectId: rotateObjectId,
          center: getObjectCenter(object),
        };
        canvas.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
    }

    const hitObjectId = getIntersectionUserDataValue(designIntersections, 'objectId');

    if (hitObjectId) {
      options.onObjectSelect(hitObjectId);
      return;
    }

    if (!options.readOnly && options.placementStart) {
      options.onObjectSelect(null);
      options.onOsmWaySelect(null);
      return;
    }

    if (layers.split && point.x < 0) {
      const originalIntersections = raycaster.intersectObjects(originalGroup.children, true);
      const osmWayId = getIntersectionUserDataValue(originalIntersections, 'osmWayId');
      if (osmWayId) {
        options.onOsmWaySelect(osmWayId);
      } else {
        options.onObjectSelect(null);
        options.onOsmWaySelect(null);
      }
      return;
    }

    const originalIntersections = raycaster.intersectObjects(originalGroup.children, true);
    const osmWayId = getIntersectionUserDataValue(originalIntersections, 'osmWayId');

    if (osmWayId) {
      options.onOsmWaySelect(osmWayId);
      return;
    }

    options.onObjectSelect(null);
    options.onOsmWaySelect(null);
  }

  function handlePointerDown(event: PointerEvent) {
    if (options.interactionMode === 'camera') {
      return;
    }

    if (options.interactionMode === 'place') {
      handlePlacePointerDown(event);
      return;
    }

    handleSelectPointerDown(event);
  }

  function handlePointerMove(event: PointerEvent) {
    if (!options.readOnly && options.interactionMode === 'place') {
      const point = updatePointer(event);
      options.onPointerMove(toDesignPoint(point));
    }
  }

  function handlePointerUp(event: PointerEvent) {
    if (!activeRotateDrag) return;

    const point = toDesignPoint(updatePointer(event));
    const rotationDeg =
      (Math.atan2(point.x - activeRotateDrag.center.x, point.z - activeRotateDrag.center.z) * 180) /
      Math.PI;
    options.onObjectRotate(activeRotateDrag.objectId, rotationDeg);
    activeRotateDrag = null;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
  }

  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('contextmenu', handleContextMenu);

  let animationFrame = 0;
  function render() {
    resize();
    if (focusAnimation) {
      const progress = Math.min(
        (performance.now() - focusAnimation.startedAt) / focusAnimation.durationMs,
        1
      );
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      controls.target.lerpVectors(
        focusAnimation.startTarget,
        focusAnimation.endTarget,
        easedProgress
      );
      camera.position.lerpVectors(
        focusAnimation.startPosition,
        focusAnimation.endPosition,
        easedProgress
      );
    }
    controls.update();
    const elapsedSeconds = performance.now() / 1000;
    animatedObjects.forEach((object, index) => {
      const baseY =
        typeof object.userData.baseY === 'number' ? object.userData.baseY : object.position.y;
      const phase = typeof object.userData.phase === 'number' ? object.userData.phase : index;
      const motion = object.userData.motion;
      if (motion === 'waterRipple') {
        object.position.y = baseY + Math.sin(elapsedSeconds * 1.2 + phase) * 0.014;
        const material = getSingleMaterial(object);
        if (material && 'opacity' in material) {
          const baseOpacity =
            typeof object.userData.baseOpacity === 'number' ? object.userData.baseOpacity : 0.42;
          material.opacity = baseOpacity + Math.sin(elapsedSeconds * 1.1 + phase) * 0.08;
          material.needsUpdate = true;
        }
        return;
      }

      if (motion === 'waterGlint') {
        object.position.y = baseY + Math.sin(elapsedSeconds * 1.15 + phase) * 0.01;
        object.scale.x = 1 + Math.sin(elapsedSeconds * 1.05 + phase) * 0.08;
        const material = getSingleMaterial(object);
        if (material && 'opacity' in material) {
          material.opacity = 0.1 + Math.sin(elapsedSeconds * 1.4 + phase) * 0.045;
          material.needsUpdate = true;
        }
        return;
      }

      if (motion === 'flower') {
        object.position.y = baseY + Math.sin(elapsedSeconds * 0.9 + phase) * 0.01;
        object.rotation.z = Math.sin(elapsedSeconds * 0.75 + phase) * 0.035;
        return;
      }

      if (motion === 'grass') {
        object.rotation.z = Math.sin(elapsedSeconds * 1.3 + phase) * 0.055;
        return;
      }

      if (motion === 'tree' || motion === 'bush') {
        object.position.y = baseY;
        object.rotation.z =
          Math.sin(elapsedSeconds * 0.7 + phase) * (motion === 'tree' ? 0.012 : 0.02);
        return;
      }

      object.position.y = baseY + Math.sin(elapsedSeconds * 1.4 + phase) * 0.025;
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
    canvas.removeEventListener('pointerup', handlePointerUp);
    canvas.removeEventListener('contextmenu', handleContextMenu);
    controls.dispose();
    renderer.dispose();
  };
}
