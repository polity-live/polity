import type {
  CorridorGeometry,
  PathCorridorGeometry,
  StreetDesignCameraPose,
  StreetDesignComparisonLayer,
  StreetDesignComparisonMode,
  StreetDesignInteractionMode,
  StreetDesignLocalPoint,
  StreetDesignObject,
  StreetDesignObjectCategory,
  StreetDesignObjectType,
  StreetDesignOsmFeatureKind,
  StreetDesignOsmWay,
  StreetDesignStateV1,
} from '../types';
import { getStreetDesignComparisonLayers } from './streetDesignDiff';
import {
  STREET_DESIGN_CURRENCY,
  getStreetDesignObjectDefinition,
} from './streetDesignObjectRegistry';
import {
  createCorridorGeometry,
  createPathCorridorGeometry,
  getStreetDesignGeometryCenter,
  getStreetDesignGeometryRotationDeg,
} from './streetDesignPlacement';
import {
  getStreetDesignHiddenOsmFeatureIds,
  getStreetDesignOsmFeatureLayer,
  getStreetDesignOsmFeaturePoints,
  getStreetDesignOsmFeatures,
  getStreetDesignOsmLayerVisibility,
} from './streetDesignOsm';
import {
  getStreetDesignChangeRequestOverlayObjects,
  type StreetDesignChangeRequest,
  type StreetDesignChangeRequestColorMode,
  type StreetDesignChangeRequestOverlayObject,
  type StreetDesignChangeRequestTone,
} from './streetDesignChangeRequests';
import {
  type StreetDesignInputAction,
  getStreetDesignKeyboardAction,
  getStreetDesignPointerAction,
} from './streetDesignInputRouter';
import { projectGeoPointToLocal } from './streetDesignProjection';

export interface StreetDesignSceneMountOptions {
  canvas: HTMLCanvasElement;
  design: StreetDesignStateV1;
  placementPreview: CorridorGeometry | PathCorridorGeometry | null;
  placementPreviewType: StreetDesignObjectType | null;
  placementStart: StreetDesignLocalPoint | null;
  selectedObjectId: string | null;
  selectedOsmWayId: string | null;
  selectedChangeRequestId?: string | null;
  hiddenObjectIds: string[];
  hiddenObjectCategories: StreetDesignObjectCategory[];
  changeRequests?: readonly StreetDesignChangeRequest[];
  changeRequestColorMode?: StreetDesignChangeRequestColorMode;
  focusObjectId: string | null;
  focusOsmWayId: string | null;
  interactionMode: StreetDesignInteractionMode;
  readOnly: boolean;
  initialCameraPose: StreetDesignCameraPose | null;
  onPointerDown: (point: StreetDesignLocalPoint) => void;
  onPointerMove: (point: StreetDesignLocalPoint) => void;
  onPointerHover: (
    point: StreetDesignLocalPoint | null,
    layer: StreetDesignComparisonLayer
  ) => void;
  onObjectSelect: (objectId: string | null) => void;
  onOsmWaySelect: (osmWayId: string | null) => void;
  onObjectRotate: (objectId: string, rotationDeg: number) => void;
  onCameraPoseChange: (pose: StreetDesignCameraPose) => void;
}

export interface StreetDesignSceneController {
  updateDesign: (
    options: Pick<
      StreetDesignSceneMountOptions,
      'design' | 'hiddenObjectIds' | 'hiddenObjectCategories'
    >
  ) => void;
  updateSelection: (
    options: Pick<
      StreetDesignSceneMountOptions,
      | 'selectedObjectId'
      | 'selectedOsmWayId'
      | 'selectedChangeRequestId'
      | 'focusObjectId'
      | 'focusOsmWayId'
      | 'interactionMode'
      | 'readOnly'
    >
  ) => void;
  updatePlacementPreview: (
    options: Pick<
      StreetDesignSceneMountOptions,
      'placementPreview' | 'placementPreviewType' | 'placementStart'
    >
  ) => void;
  updateChangeRequests: (
    options: Pick<
      StreetDesignSceneMountOptions,
      'changeRequests' | 'selectedChangeRequestId' | 'changeRequestColorMode'
    >
  ) => void;
  updateInteractionMode: (
    options: Pick<StreetDesignSceneMountOptions, 'interactionMode' | 'readOnly'>
  ) => void;
  updateHandlers: (
    options: Pick<
      StreetDesignSceneMountOptions,
      | 'onPointerDown'
      | 'onPointerMove'
      | 'onPointerHover'
      | 'onObjectSelect'
      | 'onOsmWaySelect'
      | 'onObjectRotate'
      | 'onCameraPoseChange'
    >
  ) => void;
  focusObject: (objectId: string | null) => void;
  focusOsmWay: (osmWayId: string | null) => void;
  dispose: () => void;
}

type ThreeModule = typeof import('three');
type Object3D = import('three').Object3D;
type Group = import('three').Group;
type ThreeMaterial = import('three').Material;
type RenderableCorridorGeometry = CorridorGeometry | PathCorridorGeometry;

const STREET_DESIGN_SPLIT_LAYER_OFFSET_X = 52;

export function getStreetDesignComparisonLayerOffsetX(
  comparisonMode: StreetDesignComparisonMode,
  layer: StreetDesignComparisonLayer
) {
  if (comparisonMode !== 'split') return 0;
  return layer === 'original'
    ? -STREET_DESIGN_SPLIT_LAYER_OFFSET_X
    : STREET_DESIGN_SPLIT_LAYER_OFFSET_X;
}

export function getStreetDesignPointerLayer(
  comparisonMode: StreetDesignComparisonMode,
  worldX: number
): StreetDesignComparisonLayer {
  const layers = getStreetDesignComparisonLayers(comparisonMode);
  if (layers.split) return worldX < 0 ? 'original' : 'design';
  return layers.showDesign ? 'design' : 'original';
}

export function normalizeStreetDesignPointerPoint(
  point: StreetDesignLocalPoint,
  comparisonMode: StreetDesignComparisonMode,
  layer: StreetDesignComparisonLayer
): StreetDesignLocalPoint {
  return {
    x: point.x - getStreetDesignComparisonLayerOffsetX(comparisonMode, layer),
    z: point.z,
  };
}

export interface StreetDesignRenderFrameApi {
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (handle: number) => void;
}

function seededUnit(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

export function createStreetDesignRenderScheduler(
  renderFrame: FrameRequestCallback,
  frameApi: StreetDesignRenderFrameApi = window
) {
  let animationFrame = 0;
  let isDisposed = false;

  return {
    requestRender() {
      if (isDisposed || animationFrame) return;

      animationFrame = frameApi.requestAnimationFrame(timestamp => {
        animationFrame = 0;
        if (!isDisposed) {
          renderFrame(timestamp);
        }
      });
    },
    dispose() {
      isDisposed = true;
      if (animationFrame) {
        frameApi.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    },
  };
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

function clearObjectId(object: Object3D) {
  delete object.userData.objectId;
  object.children.forEach(clearObjectId);
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
  if (opacity < 1) {
    material.depthWrite = false;
  }
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
  osmWayId?: string;
}) {
  const { THREE, group, geometry, color, y = 0.16, objectId, osmWayId } = args;
  const vertices = geometry.polygon.map(point => toGroundVector(THREE, point, y));
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
  const line = new THREE.LineLoop(
    lineGeometry,
    new THREE.LineBasicMaterial({ color, linewidth: 2 })
  );

  setIdentities({ object: line, objectId, osmWayId });

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

export function getStreetDesignOsmFeatureRenderY(feature: StreetDesignOsmWay, fallbackY = 0.05) {
  const deckElevation = feature.deckElevationMeters;
  if (typeof deckElevation !== 'number' || !Number.isFinite(deckElevation)) return fallbackY;
  if (deckElevation === 0) return fallbackY;
  if (deckElevation < 0) return Math.max(-0.18, deckElevation * 0.08);
  return deckElevation;
}

export function getStreetDesignOsmWaterRenderY(feature: StreetDesignOsmWay) {
  const waterElevation = feature.baseElevationMeters ?? feature.deckElevationMeters;
  if (typeof waterElevation === 'number' && Number.isFinite(waterElevation) && waterElevation < 0) {
    return Math.max(-0.08, waterElevation * 0.5);
  }

  return 0.006;
}

function isElevatedOsmStructure(feature: StreetDesignOsmWay) {
  return (
    (feature.deckElevationMeters ?? 0) > 0.8 ||
    feature.structureKind === 'bridge' ||
    feature.structureKind === 'viaduct' ||
    feature.structureKind === 'embankment'
  );
}

const ELEVATION_RAMP_SNAP_METERS = 2.5;
const ELEVATION_RAMP_CONTINUOUS_METERS = 0.75;
const MIN_ELEVATION_RAMP_LENGTH_METERS = 10;
const MAX_ELEVATION_RAMP_LENGTH_METERS = 32;
const ELEVATION_RAMP_LENGTH_PER_METER = 4.5;

type ElevationRampEndpoint = 'start' | 'end';

export interface StreetDesignElevationRampFeature {
  id: string;
  kind: StreetDesignOsmFeatureKind;
  geometry: RenderableCorridorGeometry;
  surfaceY: number;
  structureKind?: string;
}

export interface StreetDesignElevationRampSegment {
  sourceId: string;
  endpoint: ElevationRampEndpoint;
  kind: StreetDesignOsmFeatureKind;
  geometry: RenderableCorridorGeometry;
  startY: number;
  endY: number;
  fallback: boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function distanceBetweenLocalPoints(start: StreetDesignLocalPoint, end: StreetDesignLocalPoint) {
  return Math.hypot(end.x - start.x, end.z - start.z);
}

function createCorridorGeometryFromCenterline(points: StreetDesignLocalPoint[], width: number) {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return null;
  return points.length <= 2
    ? createCorridorGeometry(first, last, width)
    : createPathCorridorGeometry(points, width);
}

function getGeometryEndpointPoint(
  geometry: RenderableCorridorGeometry,
  endpoint: ElevationRampEndpoint
) {
  const centerline = getCorridorCenterline(geometry);
  return endpoint === 'start' ? centerline[0] : centerline[centerline.length - 1];
}

function canFeatureReceiveElevationRamp(kind: StreetDesignOsmFeatureKind) {
  return (
    kind === 'road' ||
    kind === 'rail' ||
    kind === 'bike_lane' ||
    kind === 'sidewalk' ||
    kind === 'parking'
  );
}

function canFeatureStartElevationRamp(feature: StreetDesignElevationRampFeature) {
  return feature.surfaceY > 0.8 && feature.structureKind === 'bridge';
}

export function getStreetDesignElevationRampLength(deckElevationMeters: number, fallback = false) {
  if (fallback) return MIN_ELEVATION_RAMP_LENGTH_METERS;
  return clamp(
    Math.abs(deckElevationMeters) * ELEVATION_RAMP_LENGTH_PER_METER,
    MIN_ELEVATION_RAMP_LENGTH_METERS,
    MAX_ELEVATION_RAMP_LENGTH_METERS
  );
}

function getStreetDesignElevationRampConnections(
  source: StreetDesignElevationRampFeature,
  endpoint: ElevationRampEndpoint,
  features: StreetDesignElevationRampFeature[]
) {
  const sourcePoint = getGeometryEndpointPoint(source.geometry, endpoint);
  if (!sourcePoint) return [];

  return features
    .flatMap(feature =>
      feature.id === source.id
        ? []
        : (['start', 'end'] as const).map(candidateEndpoint => ({
            feature,
            endpoint: candidateEndpoint,
            point: getGeometryEndpointPoint(feature.geometry, candidateEndpoint),
          }))
    )
    .filter(
      (
        connection
      ): connection is {
        feature: StreetDesignElevationRampFeature;
        endpoint: ElevationRampEndpoint;
        point: StreetDesignLocalPoint;
      } =>
        Boolean(connection.point) &&
        distanceBetweenLocalPoints(sourcePoint, connection.point) <= ELEVATION_RAMP_SNAP_METERS
    )
    .sort((left, right) => {
      const leftSameKind = left.feature.kind === source.kind ? 0 : 1;
      const rightSameKind = right.feature.kind === source.kind ? 0 : 1;
      if (leftSameKind !== rightSameKind) return leftSameKind - rightSameKind;
      return (
        distanceBetweenLocalPoints(sourcePoint, left.point) -
        distanceBetweenLocalPoints(sourcePoint, right.point)
      );
    });
}

function sliceCenterlineByDistance(
  centerline: StreetDesignLocalPoint[],
  startDistance: number,
  endDistance: number
) {
  if (centerline.length < 2) return [];

  const distances = getCenterlineDistances(centerline);
  const totalDistance = distances[distances.length - 1] ?? 0;
  const safeStart = clamp(Math.min(startDistance, endDistance), 0, totalDistance);
  const safeEnd = clamp(Math.max(startDistance, endDistance), 0, totalDistance);
  if (safeEnd - safeStart <= 0.05) return [];

  const points: StreetDesignLocalPoint[] = [getCenterlineSample(centerline, safeStart).point];
  centerline.forEach((point, index) => {
    const distance = distances[index] ?? 0;
    if (distance > safeStart + 0.05 && distance < safeEnd - 0.05) {
      points.push(point);
    }
  });
  points.push(getCenterlineSample(centerline, safeEnd).point);

  return points;
}

function createRampGeometryInsideSource(args: {
  geometry: RenderableCorridorGeometry;
  endpoint: ElevationRampEndpoint;
  length: number;
}) {
  if (args.geometry.length <= 0.05) return null;

  const rampLength = clamp(args.length, 0.05, args.geometry.length);
  const startDistance = args.endpoint === 'start' ? 0 : args.geometry.length - rampLength;
  const endDistance = args.endpoint === 'start' ? rampLength : args.geometry.length;
  const centerline = sliceCenterlineByDistance(
    getCorridorCenterline(args.geometry),
    startDistance,
    endDistance
  );

  return createCorridorGeometryFromCenterline(centerline, args.geometry.width);
}

function getInternalElevationRampLength(
  feature: StreetDesignElevationRampFeature,
  rampCount: number
) {
  const maxRampLength = feature.geometry.length / Math.max(rampCount, 1);
  if (maxRampLength <= 0.05) return 0;

  return Math.min(getStreetDesignElevationRampLength(feature.surfaceY), maxRampLength);
}

export function getStreetDesignElevationRampSegments(
  features: StreetDesignElevationRampFeature[]
): StreetDesignElevationRampSegment[] {
  return features.flatMap(feature => {
    if (!canFeatureReceiveElevationRamp(feature.kind) || !canFeatureStartElevationRamp(feature)) {
      return [];
    }

    const candidates = (['start', 'end'] as const).flatMap(endpoint => {
      const sourcePoint = getGeometryEndpointPoint(feature.geometry, endpoint);
      if (!sourcePoint) return [];

      const connections = getStreetDesignElevationRampConnections(feature, endpoint, features);
      const hasContinuousConnection = connections.some(
        connection =>
          Math.abs(connection.feature.surfaceY - feature.surfaceY) <
          ELEVATION_RAMP_CONTINUOUS_METERS
      );
      if (hasContinuousConnection) return [];

      const lowerConnection = connections.find(
        connection =>
          connection.feature.surfaceY < feature.surfaceY - ELEVATION_RAMP_CONTINUOUS_METERS
      );
      const shouldCreateFallback =
        feature.structureKind === 'bridge' && lowerConnection == null && connections.length === 0;

      if (!lowerConnection && !shouldCreateFallback) return [];

      return [
        {
          endpoint,
          lowerY: lowerConnection?.feature.surfaceY ?? 0.05,
          fallback: !lowerConnection,
        },
      ];
    });

    const rampLength = getInternalElevationRampLength(feature, candidates.length);
    if (rampLength <= 0) return [];

    return candidates.flatMap(candidate => {
      const rampGeometry = createRampGeometryInsideSource({
        geometry: feature.geometry,
        endpoint: candidate.endpoint,
        length: rampLength,
      });
      if (!rampGeometry) return [];
      const isStartRamp = candidate.endpoint === 'start';

      return [
        {
          sourceId: feature.id,
          endpoint: candidate.endpoint,
          kind: feature.kind,
          geometry: rampGeometry,
          startY: isStartRamp ? candidate.lowerY : feature.surfaceY,
          endY: isStartRamp ? feature.surfaceY : candidate.lowerY,
          fallback: candidate.fallback,
        },
      ];
    });
  });
}

function getStreetDesignManualElevationRampSegments(args: {
  id: string;
  kind: StreetDesignOsmFeatureKind;
  geometry: RenderableCorridorGeometry;
  surfaceY: number;
  baseY: number;
  structureKind: string;
}) {
  if (args.structureKind !== 'bridge' || args.surfaceY <= args.baseY + 0.8) return [];
  const rampLength = Math.min(
    getStreetDesignElevationRampLength(args.surfaceY),
    args.geometry.length / 2
  );
  if (rampLength <= 0.05) return [];

  return (['start', 'end'] as const).flatMap(endpoint => {
    const rampGeometry = createRampGeometryInsideSource({
      geometry: args.geometry,
      endpoint,
      length: rampLength,
    });
    if (!rampGeometry) return [];
    const isStartRamp = endpoint === 'start';

    return [
      {
        sourceId: args.id,
        endpoint,
        kind: args.kind,
        geometry: rampGeometry,
        startY: isStartRamp ? args.baseY : args.surfaceY,
        endY: isStartRamp ? args.surfaceY : args.baseY,
        fallback: true,
      },
    ];
  });
}

function addPolygonOutline(args: {
  THREE: ThreeModule;
  group: Group;
  points: StreetDesignLocalPoint[];
  color: string;
  y?: number;
  objectId?: string;
  osmWayId?: string;
}) {
  const { THREE, group, points, color, y = 0.18, objectId, osmWayId } = args;
  if (points.length < 3) return;

  const vertices = points.map(point => toGroundVector(THREE, point, y));
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
  const line = new THREE.LineLoop(
    lineGeometry,
    new THREE.LineBasicMaterial({ color, linewidth: 2 })
  );

  setIdentities({ object: line, objectId, osmWayId });

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

export function createLaneArrowPolygon(args: {
  center: StreetDesignLocalPoint;
  direction: StreetDesignLocalPoint;
  length: number;
  width: number;
}): StreetDesignLocalPoint[] {
  const directionLength = Math.hypot(args.direction.x, args.direction.z);
  const direction =
    directionLength <= 0.001
      ? { x: 0, z: 1 }
      : {
          x: args.direction.x / directionLength,
          z: args.direction.z / directionLength,
        };
  const halfLength = Math.max(args.length, 0.4) / 2;
  const halfWidth = Math.max(args.width, 0.12) / 2;
  const shaftHalfWidth = halfWidth * 0.24;
  const tailCenter = {
    x: args.center.x - direction.x * halfLength,
    z: args.center.z - direction.z * halfLength,
  };
  const headBaseCenter = {
    x: args.center.x + direction.x * (halfLength * 0.18),
    z: args.center.z + direction.z * (halfLength * 0.18),
  };
  const tip = {
    x: args.center.x + direction.x * halfLength,
    z: args.center.z + direction.z * halfLength,
  };

  return [
    tip,
    offsetPointFromDirection(headBaseCenter, direction, halfWidth),
    offsetPointFromDirection(headBaseCenter, direction, shaftHalfWidth),
    offsetPointFromDirection(tailCenter, direction, shaftHalfWidth),
    offsetPointFromDirection(tailCenter, direction, -shaftHalfWidth),
    offsetPointFromDirection(headBaseCenter, direction, -shaftHalfWidth),
    offsetPointFromDirection(headBaseCenter, direction, -halfWidth),
  ];
}

function addLaneArrowMarkings(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry;
  lateralOffsets: number[];
  arrowLength: number;
  arrowWidth: number;
  color?: string;
  y?: number;
  objectId?: string;
  osmWayId?: string;
}) {
  const {
    THREE,
    group,
    geometry,
    lateralOffsets,
    arrowLength,
    arrowWidth,
    color = '#f8fafc',
    y = 0.14,
    objectId,
    osmWayId,
  } = args;
  const centerline = getCorridorCenterline(geometry);
  const length = geometry.length;

  if (length < arrowLength || centerline.length < 2) return;

  const spacing = Math.max(4.2, arrowLength * 2.25);
  const firstOffset = Math.min(spacing / 2, Math.max(arrowLength / 2, length / 2));

  for (let offset = firstOffset; offset < length - 0.4; offset += spacing) {
    const sample = getCenterlineSample(centerline, offset);

    lateralOffsets.forEach(lateralOffset => {
      const center = offsetPointFromDirection(sample.point, sample.direction, lateralOffset);
      addFlatPolygon({
        THREE,
        group,
        points: createLaneArrowPolygon({
          center,
          direction: sample.direction,
          length: arrowLength,
          width: arrowWidth,
        }),
        color,
        opacity: 0.94,
        y,
        objectId,
        osmWayId,
      });
    });
  }
}

function addCarLaneMarkings(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry;
  direction: string;
  y?: number;
  objectId?: string;
}) {
  const { THREE, group, geometry, direction, y = 0.14, objectId } = args;
  const isTwoWay = direction === 'two_way';
  const arrowLength = Math.max(1.8, Math.min(geometry.width * 1.05, 2.75));
  const arrowWidth = isTwoWay
    ? Math.max(0.34, Math.min(geometry.width * 0.18, 0.56))
    : Math.max(0.46, Math.min(geometry.width * 0.32, 0.86));

  if (isTwoWay) {
    const laneOffset = Math.max(0.34, Math.min(geometry.width * 0.28, geometry.width / 2 - 0.28));
    addStreetMarkings({
      THREE,
      group,
      geometry,
      objectId,
      color: '#facc15',
      y,
    });
    addLaneArrowMarkings({
      THREE,
      group,
      geometry,
      lateralOffsets: [-laneOffset, laneOffset],
      arrowLength,
      arrowWidth,
      y: y + 0.012,
      objectId,
    });
    return;
  }

  addLaneArrowMarkings({
    THREE,
    group,
    geometry,
    lateralOffsets: [0],
    arrowLength,
    arrowWidth,
    y,
    objectId,
  });
}

export type StreetDesignTreeRenderKind =
  | 'deciduous'
  | 'conifer'
  | 'fruit'
  | 'columnar_poplar'
  | 'ornamental_cherry'
  | 'flowering_plum';

export type StreetDesignTreeCanopyShape = 'rounded_lobes' | 'stacked_cones' | 'columnar_lobes';

export interface StreetDesignTreeRenderProfile {
  canopyColors?: string[];
  canopyShape: StreetDesignTreeCanopyShape;
  hasFruitMarkers: boolean;
  kind: StreetDesignTreeRenderKind;
  trunkHeightRatio: number;
}

export function getStreetDesignTreeRenderKind(value: unknown): StreetDesignTreeRenderKind {
  const species = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (species === 'conifer') return 'conifer';
  if (species === 'fruit' || species === 'obstbaum') return 'fruit';
  if (species === 'columnar_poplar') return 'columnar_poplar';
  if (species === 'ornamental_cherry' || species === 'zierkirsche' || species === 'japanese_cherry')
    return 'ornamental_cherry';
  if (species === 'flowering_plum' || species === 'pflaume' || species === 'plum')
    return 'flowering_plum';
  return 'deciduous';
}

export function getStreetDesignTreeRenderProfile(value: unknown): StreetDesignTreeRenderProfile {
  const kind = getStreetDesignTreeRenderKind(value);
  if (kind === 'conifer') {
    return {
      canopyShape: 'stacked_cones',
      hasFruitMarkers: false,
      kind,
      trunkHeightRatio: 0.28,
    };
  }

  if (kind === 'columnar_poplar') {
    return {
      canopyShape: 'columnar_lobes',
      hasFruitMarkers: false,
      kind,
      trunkHeightRatio: 0.32,
    };
  }

  if (kind === 'fruit') {
    return {
      canopyShape: 'rounded_lobes',
      hasFruitMarkers: true,
      kind,
      trunkHeightRatio: 0.34,
    };
  }

  if (kind === 'ornamental_cherry') {
    return {
      canopyColors: ['#ffd6e7', '#ffc2dc', '#f5a7cb', '#fff0f6'],
      canopyShape: 'rounded_lobes',
      hasFruitMarkers: false,
      kind,
      trunkHeightRatio: 0.36,
    };
  }

  if (kind === 'flowering_plum') {
    return {
      canopyColors: ['#fff7f0', '#ffe4ef', '#f3b1ca', '#f9fafb'],
      canopyShape: 'rounded_lobes',
      hasFruitMarkers: false,
      kind,
      trunkHeightRatio: 0.35,
    };
  }

  return {
    canopyShape: 'rounded_lobes',
    hasFruitMarkers: false,
    kind,
    trunkHeightRatio: 0.38,
  };
}

function addDeciduousTreeCanopy(args: {
  THREE: ThreeModule;
  root: Group;
  canopyBaseY: number;
  canopyRadius: number;
  colors: string[];
  fruit?: boolean;
}) {
  const { THREE, root, canopyBaseY, canopyRadius, colors, fruit = false } = args;
  const canopyGeometry = new THREE.SphereGeometry(1, 18, 12);
  const lobeOffsets = [
    { x: 0, y: 0.18, z: 0, scale: fruit ? 0.94 : 1.08 },
    { x: -0.38, y: -0.04, z: 0.12, scale: fruit ? 0.66 : 0.76 },
    { x: 0.34, y: -0.02, z: -0.1, scale: fruit ? 0.64 : 0.72 },
    { x: 0.06, y: 0.12, z: 0.38, scale: fruit ? 0.58 : 0.66 },
  ];

  lobeOffsets.forEach((offset, index) => {
    const canopy = new THREE.Mesh(
      canopyGeometry,
      new THREE.MeshStandardMaterial({
        color: colors[index % colors.length],
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

  if (!fruit) return;

  const fruitMaterial = new THREE.MeshStandardMaterial({
    color: '#dc4237',
    roughness: 0.5,
    metalness: 0,
  });
  [
    { x: -0.34, y: 0.06, z: 0.46 },
    { x: 0.24, y: -0.08, z: 0.5 },
    { x: 0.46, y: 0.12, z: -0.12 },
    { x: -0.1, y: -0.16, z: -0.48 },
  ].forEach(offset => {
    const fruitMesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), fruitMaterial);
    fruitMesh.position.set(
      offset.x * canopyRadius,
      canopyBaseY + offset.y * canopyRadius,
      offset.z * canopyRadius
    );
    setSceneShadows(fruitMesh, true, false);
    root.add(fruitMesh);
  });
}

function addConiferTreeCanopy(args: {
  THREE: ThreeModule;
  root: Group;
  trunkHeight: number;
  canopyRadius: number;
}) {
  const { THREE, root, trunkHeight, canopyRadius } = args;
  const colors = ['#1f5a35', '#27643a', '#2f6f38'];
  [0, 1, 2].forEach(index => {
    const coneHeight = canopyRadius * (1.55 - index * 0.18);
    const coneRadius = canopyRadius * (0.98 - index * 0.18);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(coneRadius, coneHeight, 14),
      new THREE.MeshStandardMaterial({
        color: colors[index % colors.length],
        roughness: 0.9,
        metalness: 0,
      })
    );
    cone.position.y = trunkHeight + canopyRadius * 0.25 + index * canopyRadius * 0.42;
    setSceneShadows(cone, true, true);
    root.add(cone);
  });
}

function addColumnarPoplarCanopy(args: {
  THREE: ThreeModule;
  root: Group;
  trunkHeight: number;
  canopyRadius: number;
}) {
  const { THREE, root, trunkHeight, canopyRadius } = args;
  const poplarMaterial = new THREE.MeshStandardMaterial({
    color: '#4f7f3f',
    roughness: 0.88,
    metalness: 0,
  });
  const canopyGeometry = new THREE.SphereGeometry(1, 16, 12);

  [0, 1, 2].forEach(index => {
    const canopy = new THREE.Mesh(canopyGeometry, poplarMaterial);
    canopy.position.y = trunkHeight + canopyRadius * (0.55 + index * 0.48);
    canopy.scale.set(canopyRadius * 0.52, canopyRadius * 1.05, canopyRadius * 0.48);
    setSceneShadows(canopy, true, true);
    root.add(canopy);
  });
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
    const treeRenderProfile = getStreetDesignTreeRenderProfile(object.properties.species);
    const trunkHeight = Math.max(height * treeRenderProfile.trunkHeightRatio, 1.15);
    const canopyRadius = canopyDiameter * 0.5;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(canopyRadius * 0.11, canopyRadius * 0.16, trunkHeight, 9),
      new THREE.MeshStandardMaterial({ color: '#6f4d31', roughness: 0.88 })
    );
    trunk.position.y = trunkHeight / 2;
    setSceneShadows(trunk, true, true);
    root.add(trunk);

    const canopyBaseY = trunkHeight + canopyRadius * 0.48;
    if (treeRenderProfile.canopyShape === 'stacked_cones') {
      addConiferTreeCanopy({ THREE, root, trunkHeight, canopyRadius });
    } else if (treeRenderProfile.canopyShape === 'columnar_lobes') {
      addColumnarPoplarCanopy({ THREE, root, trunkHeight, canopyRadius });
    } else {
      addDeciduousTreeCanopy({
        THREE,
        root,
        canopyBaseY,
        canopyRadius,
        colors:
          treeRenderProfile.canopyColors ??
          (treeRenderProfile.kind === 'fruit'
            ? ['#5f8f43', '#77a452', '#8bb661', '#6f9b48']
            : ['#2f6f38', definition.color, '#4f8f42', '#6a9b4f']),
        fruit: treeRenderProfile.hasFruitMarkers,
      });
    }
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
  } else if (
    definition.renderKind === 'street_furniture' ||
    definition.renderKind === 'utility' ||
    definition.renderKind === 'barrier' ||
    definition.renderKind === 'traffic' ||
    definition.renderKind === 'transit' ||
    object.type === 'taxi_stand'
  ) {
    const primaryMaterial = new THREE.MeshStandardMaterial({
      color: definition.color,
      roughness: 0.62,
      metalness: 0.12,
    });
    const darkMaterial = new THREE.MeshStandardMaterial({
      color: '#1f2937',
      roughness: 0.5,
      metalness: 0.2,
    });

    if (object.type === 'street_lamp') {
      const height = Math.max(numberProperty(object.properties.height, 5), 2);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.075, height, 10),
        darkMaterial
      );
      pole.position.y = height / 2;
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 12, 8),
        new THREE.MeshStandardMaterial({
          color: '#fff7cc',
          emissive: '#facc15',
          emissiveIntensity: 0.28,
          roughness: 0.35,
        })
      );
      head.position.y = height + 0.08;
      setSceneShadows(pole, true, true);
      setSceneShadows(head, true, false);
      root.add(pole, head);
    } else if (object.type === 'traffic_signal') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 2.4, 10), darkMaterial);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.7, 0.18), darkMaterial);
      pole.position.y = 1.2;
      box.position.set(0, 2.05, -0.08);
      root.add(pole, box);
      ['#ef4444', '#f59e0b', '#22c55e'].forEach((color, index) => {
        const lamp = new THREE.Mesh(
          new THREE.SphereGeometry(0.055, 8, 6),
          new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.22 })
        );
        lamp.position.set(0, 2.25 - index * 0.18, -0.18);
        root.add(lamp);
      });
      const signalType = stringProperty(object.properties.signalType, 'vehicle');
      if (signalType !== 'vehicle') {
        const plate = new THREE.Mesh(
          new THREE.BoxGeometry(0.34, 0.2, 0.06),
          new THREE.MeshStandardMaterial({
            color: signalType === 'bicycle' ? '#2563eb' : '#f8fafc',
            roughness: 0.45,
          })
        );
        plate.position.set(0, 1.58, -0.15);
        root.add(plate);
      }
    } else if (object.type === 'traffic_sign') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 2.05, 10), darkMaterial);
      pole.position.y = 1.025;
      const signType = stringProperty(object.properties.signType, 'give_way');
      const plate = new THREE.Mesh(
        signType === 'stop'
          ? new THREE.CylinderGeometry(0.34, 0.34, 0.055, 8)
          : new THREE.BoxGeometry(0.58, 0.58, 0.055),
        new THREE.MeshStandardMaterial({
          color: signType === 'give_way' ? '#f8fafc' : definition.color,
          roughness: 0.42,
        })
      );
      plate.rotation.x = Math.PI / 2;
      plate.position.set(0, 1.82, 0);
      root.add(pole, plate);
    } else if (object.type === 'bus_stop') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 2.1, 10), darkMaterial);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.05), primaryMaterial);
      pole.position.y = 1.05;
      sign.position.y = 1.82;
      root.add(pole, sign);
      if (object.properties.shelter !== false) {
        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 0.72), primaryMaterial);
        const back = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 0.8, 0.05),
          new THREE.MeshStandardMaterial({
            color: '#dbeafe',
            transparent: true,
            opacity: 0.62,
            roughness: 0.32,
          })
        );
        roof.position.set(0, 1.55, 0.1);
        back.position.set(0, 0.85, 0.42);
        setSceneShadows(roof, true, true);
        root.add(roof, back);
      }
    } else if (object.type === 'building_entrance') {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.15, 0.16), darkMaterial);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.86, 0.12), primaryMaterial);
      frame.position.y = 1.08;
      door.position.set(0, 0.95, -0.1);
      root.add(frame, door);
    } else if (object.type === 'charging_station') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.25, 0.34), primaryMaterial);
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.03), darkMaterial);
      body.position.y = 0.64;
      screen.position.set(0, 0.88, -0.19);
      root.add(body, screen);
    } else if (object.type === 'public_toilet') {
      const booth = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.05, 1.05), primaryMaterial);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.65, 0.04), darkMaterial);
      booth.position.y = 1.03;
      door.position.set(0, 0.9, -0.55);
      root.add(booth, door);
    } else if (object.type === 'taxi_stand') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 1.8, 10), darkMaterial);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.06), primaryMaterial);
      pole.position.y = 0.9;
      plate.position.y = 1.55;
      root.add(pole, plate);
    } else if (object.type === 'crossing') {
      for (let index = -2; index <= 2; index += 1) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.025, 1.2),
          new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.6 })
        );
        stripe.position.set(index * 0.28, 0.03, 0);
        root.add(stripe);
      }
    } else if (object.type === 'gate') {
      [-0.5, 0.5].forEach(x => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.25, 0.08), darkMaterial);
        post.position.set(x, 0.62, 0);
        root.add(post);
      });
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.08), primaryMaterial);
      rail.position.y = 0.78;
      root.add(rail);
    } else if (object.type === 'fountain') {
      const basin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.5, 0.18, 24),
        primaryMaterial
      );
      const waterType = stringProperty(object.properties.waterType, 'drinking');
      const water = new THREE.Mesh(
        new THREE.CylinderGeometry(
          waterType === 'splash' ? 0.48 : 0.34,
          waterType === 'splash' ? 0.48 : 0.34,
          0.035,
          24
        ),
        new THREE.MeshPhysicalMaterial({
          color: '#38bdf8',
          transparent: true,
          opacity: 0.72,
          roughness: 0.12,
          clearcoat: 0.8,
        })
      );
      basin.position.y = 0.12;
      water.position.y = 0.23;
      root.add(basin, water);
      if (waterType !== 'drinking') {
        const jet = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.04, waterType === 'splash' ? 0.38 : 0.58, 10),
          new THREE.MeshStandardMaterial({
            color: '#bae6fd',
            transparent: true,
            opacity: 0.78,
            roughness: 0.2,
          })
        );
        jet.position.y = waterType === 'splash' ? 0.42 : 0.54;
        root.add(jet);
      }
    } else if (object.type === 'hydrant') {
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.14, 0.62, 12),
        primaryMaterial
      );
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), primaryMaterial);
      body.position.y = 0.34;
      cap.position.y = 0.68;
      root.add(body, cap);
    } else if (object.type === 'bollard') {
      const bollard = new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.12,
          0.14,
          Math.max(numberProperty(object.properties.height, 0.9), 0.3),
          12
        ),
        primaryMaterial
      );
      bollard.position.y = Math.max(numberProperty(object.properties.height, 0.9), 0.3) / 2;
      root.add(bollard);
    } else {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.42), primaryMaterial);
      base.position.y = 0.34;
      setSceneShadows(base, true, true);
      root.add(base);
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

function getDesignObjectSurfaceY(object: StreetDesignObject, fallbackY: number) {
  const deckElevation = numberProperty(object.properties.deckElevationMeters, fallbackY);
  if (deckElevation <= 0) return fallbackY;
  return deckElevation;
}

function getDesignObjectStructureKind(object: StreetDesignObject) {
  return stringProperty(object.properties.structureKind, '');
}

function getDesignObjectElevationRampKind(
  object: StreetDesignObject,
  definition: ReturnType<typeof getStreetDesignObjectDefinition>
): StreetDesignOsmFeatureKind | null {
  if (definition.renderKind === 'road' || object.type === 'car_lane') return 'road';
  if (definition.renderKind === 'rail') return 'rail';
  if (object.type === 'bike_lane') return 'bike_lane';
  if (object.type === 'sidewalk') return 'sidewalk';
  return null;
}

function colorFromMap(value: string, colorMap: Record<string, string>, fallback: string) {
  return colorMap[value] ?? fallback;
}

function getDesignObjectSurfaceColor(
  object: StreetDesignObject,
  definition: ReturnType<typeof getStreetDesignObjectDefinition>
) {
  if (object.type === 'flower_bed') return '#4e7743';
  if (object.type === 'grass_strip') return '#79a857';
  if (object.type === 'scrub_area') return '#587c49';
  if (object.type === 'heath_area') return '#8f7f55';
  if (object.type === 'orchard_area') return '#6f8d45';
  if (object.type === 'vineyard_area') return '#78935f';

  if (object.type === 'street') {
    const status = stringProperty(object.properties.status, 'open');
    if (status === 'construction') return '#b7791f';
    return colorFromMap(
      stringProperty(object.properties.roadClass, 'residential'),
      {
        construction: '#b7791f',
        living_street: '#5f6b57',
        pedestrian: '#8f8874',
        primary: '#343a40',
        residential: '#3f474c',
      },
      '#3f474c'
    );
  }

  if (object.type === 'car_lane') {
    return stringProperty(object.properties.direction, 'one_way') === 'two_way'
      ? '#46535c'
      : '#3f474c';
  }

  if (object.type === 'bike_lane') {
    return colorFromMap(
      stringProperty(object.properties.protection, 'painted'),
      { painted: '#2f8f87', protected: '#25796f', raised: '#55aaa0' },
      '#2f8f87'
    );
  }

  if (object.type === 'sidewalk') {
    return colorFromMap(
      stringProperty(object.properties.pathType, 'sidewalk'),
      {
        accessible: '#c8bda7',
        promenade: '#d1c1a6',
        sidewalk: '#b9af9f',
        standard: '#b9af9f',
      },
      '#b9af9f'
    );
  }

  if (object.type === 'parking_area') return '#697482';
  if (object.type === 'loading_zone') return '#8a6b3e';

  if (object.type === 'water_area') {
    return colorFromMap(
      stringProperty(object.properties.waterType, 'retention'),
      { pond: '#247f9b', retention: '#2f9fca', stream: '#2c8fb8' },
      '#2f9fca'
    );
  }

  if (object.type === 'wetland_area') {
    return colorFromMap(
      stringProperty(object.properties.wetlandType, 'reedbed'),
      { marsh: '#5f8b6b', reedbed: '#4f8f83', wet_meadow: '#6aa36f' },
      '#4f8f83'
    );
  }

  if (object.type === 'construction_area') {
    return colorFromMap(
      stringProperty(object.properties.status, 'planned'),
      { active: '#b7791f', closed: '#7c2d12', planned: '#a16207' },
      '#a16207'
    );
  }

  if (object.type === 'landuse_context_area') {
    return colorFromMap(
      stringProperty(object.properties.landuseType, 'commercial'),
      {
        civic: '#90a887',
        commercial: '#b8a083',
        green: '#79a857',
        industrial: '#8b8f97',
        mixed: '#a78b76',
        residential: '#c8bda7',
        retail: '#c58b62',
      },
      '#b8a083'
    );
  }

  if (object.type === 'civic_area') {
    return colorFromMap(
      stringProperty(object.properties.civicType, 'school'),
      {
        community_center: '#8fb58d',
        hospital: '#b77b85',
        library: '#8aa7c2',
        school: '#d0b46a',
        townhall: '#9aa7b8',
      },
      '#90a887'
    );
  }

  if (definition.renderKind === 'playground') {
    return colorFromMap(
      stringProperty(object.properties.equipment, 'mixed'),
      {
        climbing: '#c8844f',
        inclusive: '#74a889',
        mixed: '#d6a23f',
        sand: '#d2b067',
        swings: '#c96b76',
      },
      '#d6a23f'
    );
  }

  if (definition.renderKind === 'sports') {
    return colorFromMap(
      stringProperty(object.properties.sport, 'multi'),
      {
        basketball: '#b7791f',
        fitness: '#4f8f83',
        football: '#5f9f65',
        multi: '#5f9f65',
        skate: '#64748b',
      },
      '#5f9f65'
    );
  }

  if (definition.renderKind === 'traffic') return '#d9d4c8';
  if (definition.renderKind === 'rail') return '#3f474c';
  if (definition.renderKind === 'barrier') return '#5f6b57';

  return definition.color;
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

function offsetOsmLocalPoints(points: StreetDesignLocalPoint[], offsetMeters: number | undefined) {
  if (!offsetMeters || points.length < 2) return points;

  return points.map((point, index) => {
    const previous = points[Math.max(index - 1, 0)] ?? point;
    const next = points[Math.min(index + 1, points.length - 1)] ?? point;
    return offsetPointFromDirection(point, normalizeDirection(previous, next), offsetMeters);
  });
}

function getOsmWayLocalPoints(way: StreetDesignOsmWay, design: StreetDesignStateV1) {
  const localPoints = getStreetDesignOsmFeaturePoints(way).map(point =>
    projectGeoPointToLocal(point, design.origin)
  );

  return way.geometryKind === 'point'
    ? localPoints
    : offsetOsmLocalPoints(localPoints, way.offsetMeters);
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
  const way = getStreetDesignOsmFeatures(design.osmSnapshot).find(item => item.id === osmWayId);
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
  color?: string;
  opacity?: number;
  y?: number;
  objectId?: string;
  osmWayId?: string;
}) {
  const {
    THREE,
    group,
    geometry,
    color = '#2f9fca',
    opacity = 0.72,
    y = 0.06,
    objectId,
    osmWayId,
  } = args;
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
    color,
    opacity,
    y,
    objectId,
    osmWayId,
  });
  if (surface) {
    surface.material = new THREE.MeshPhysicalMaterial({
      color,
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
  orientation?: string;
  objectId?: string;
  osmWayId?: string;
  y?: number;
}) {
  const { THREE, group, geometry, orientation = 'parallel', objectId, osmWayId, y = 0.16 } = args;
  const samples = getCorridorSamples(geometry, 2.6).slice(0, 80);

  samples.forEach((sample, index) => {
    const stripeWidth = orientation === 'parallel' ? 0.06 : 0.08;
    const startOffset =
      orientation === 'parallel'
        ? -geometry.width * 0.42
        : orientation === 'angled'
          ? -geometry.width * 0.45
          : -geometry.width * 0.42;
    const endOffset =
      orientation === 'parallel'
        ? -geometry.width * 0.12
        : orientation === 'angled'
          ? geometry.width * 0.22
          : geometry.width * 0.42;
    const angleShift = orientation === 'angled' ? (index % 2 === 0 ? 0.48 : -0.48) : 0;
    const startBase = {
      x: sample.point.x - sample.direction.x * angleShift,
      z: sample.point.z - sample.direction.z * angleShift,
    };
    const endBase = {
      x: sample.point.x + sample.direction.x * angleShift,
      z: sample.point.z + sample.direction.z * angleShift,
    };
    const start = offsetPointFromDirection(startBase, sample.direction, startOffset);
    const end = offsetPointFromDirection(endBase, sample.direction, endOffset);
    addCorridorMesh({
      THREE,
      group,
      geometry: createCorridorGeometry(start, end, stripeWidth),
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

function getCenterlineDistances(centerline: StreetDesignLocalPoint[]) {
  const distances = [0];
  for (let index = 1; index < centerline.length; index += 1) {
    const previous = centerline[index - 1];
    const current = centerline[index];
    distances.push(
      (distances[index - 1] ?? 0) +
        (previous && current ? distanceBetweenLocalPoints(previous, current) : 0)
    );
  }
  return distances;
}

function interpolateRampY(startY: number, endY: number, distance: number, totalDistance: number) {
  if (totalDistance <= 0) return startY;
  const ratio = clamp(distance / totalDistance, 0, 1);
  return startY + (endY - startY) * ratio;
}

function getCenterlineDirectionAtIndex(centerline: StreetDesignLocalPoint[], index: number) {
  const previous = centerline[Math.max(index - 1, 0)];
  const next = centerline[Math.min(index + 1, centerline.length - 1)];
  if (!previous || !next || distanceBetweenLocalPoints(previous, next) <= 0.001) {
    return { x: 0, z: 1 };
  }
  return normalizeDirection(previous, next);
}

function addSlopedCorridorMesh(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry;
  color: string;
  startY: number;
  endY: number;
  opacity?: number;
  yOffset?: number;
}) {
  const { THREE, group, geometry, color, startY, endY, opacity = 1, yOffset = 0 } = args;
  const centerline = getCorridorCenterline(geometry);
  if (centerline.length < 2) return null;

  const distances = getCenterlineDistances(centerline);
  const totalDistance = distances[distances.length - 1] ?? geometry.length;
  const positions: number[] = [];
  const indices: number[] = [];

  centerline.forEach((point, index) => {
    const direction = getCenterlineDirectionAtIndex(centerline, index);
    const left = offsetPointFromDirection(point, direction, -geometry.width * 0.5);
    const right = offsetPointFromDirection(point, direction, geometry.width * 0.5);
    const y = interpolateRampY(startY, endY, distances[index] ?? 0, totalDistance) + yOffset;

    positions.push(left.x, y, left.z, right.x, y, right.z);
  });

  for (let index = 0; index < centerline.length - 1; index += 1) {
    const left = index * 2;
    const right = left + 1;
    const nextLeft = left + 2;
    const nextRight = left + 3;
    indices.push(left, right, nextLeft, nextLeft, right, nextRight);
  }

  const bufferGeometry = new THREE.BufferGeometry();
  bufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  bufferGeometry.setIndex(indices);
  bufferGeometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    roughness: 0.78,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  material.polygonOffset = true;
  material.polygonOffsetFactor = -0.8;
  material.polygonOffsetUnits = -0.8;
  const mesh = new THREE.Mesh(bufferGeometry, material);
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function createOffsetCenterline(
  geometry: RenderableCorridorGeometry,
  offset: number
): StreetDesignLocalPoint[] {
  const centerline = getCorridorCenterline(geometry);
  return centerline.map((point, index) =>
    offsetPointFromDirection(point, getCenterlineDirectionAtIndex(centerline, index), offset)
  );
}

function addSlopedCorridorEdgeStrips(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry;
  color: string;
  startY: number;
  endY: number;
  opacity?: number;
  yOffset?: number;
}) {
  const { THREE, group, geometry, color, startY, endY, opacity = 0.56, yOffset = 0.045 } = args;
  const offsets = [-geometry.width * 0.5 + 0.08, geometry.width * 0.5 - 0.08];

  offsets.forEach(offset => {
    const edgeGeometry = createCorridorGeometryFromCenterline(
      createOffsetCenterline(geometry, offset),
      0.08
    );
    if (!edgeGeometry) return;
    addSlopedCorridorMesh({
      THREE,
      group,
      geometry: edgeGeometry,
      color,
      opacity,
      startY,
      endY,
      yOffset,
    });
  });
}

function addSlopedStreetMarkings(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry;
  startY: number;
  endY: number;
  color?: string;
}) {
  const { THREE, group, geometry, startY, endY, color = '#f8fafc' } = args;
  const centerline = getCorridorCenterline(geometry);
  if (centerline.length < 2 || geometry.length < 2.4) return;

  const dashLength = 2.4;
  const gapLength = 3.2;
  for (
    let offset = gapLength / 2;
    offset < geometry.length - 0.4;
    offset += dashLength + gapLength
  ) {
    const dashEndOffset = Math.min(offset + dashLength, geometry.length);
    const dashGeometry = createCorridorGeometry(
      getCenterlineSample(centerline, offset).point,
      getCenterlineSample(centerline, dashEndOffset).point,
      0.16
    );
    addSlopedCorridorMesh({
      THREE,
      group,
      geometry: dashGeometry,
      color,
      opacity: 0.92,
      startY: interpolateRampY(startY, endY, offset, geometry.length),
      endY: interpolateRampY(startY, endY, dashEndOffset, geometry.length),
      yOffset: 0.08,
    });
  }
}

function addSlopedRailDetails(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry;
  startY: number;
  endY: number;
}) {
  const { THREE, group, geometry, startY, endY } = args;
  [-0.42, 0.42].forEach(offset => {
    const railGeometry = createCorridorGeometryFromCenterline(
      createOffsetCenterline(geometry, offset),
      0.08
    );
    if (!railGeometry) return;
    addSlopedCorridorMesh({
      THREE,
      group,
      geometry: railGeometry,
      color: '#d1d5db',
      opacity: 0.92,
      startY,
      endY,
      yOffset: 0.1,
    });
  });

  getCorridorSamples(geometry, 1.2)
    .slice(0, 80)
    .forEach(sample => {
      const distance = distanceBetweenLocalPoints(
        getGeometryEndpointPoint(geometry, 'start') ?? sample.point,
        sample.point
      );
      const sleeperY = interpolateRampY(startY, endY, distance, geometry.length) + 0.08;
      addCorridorMesh({
        THREE,
        group,
        geometry: createCorridorGeometry(
          offsetPointFromDirection(sample.point, sample.direction, -0.65),
          offsetPointFromDirection(sample.point, sample.direction, 0.65),
          0.07
        ),
        color: '#5b4636',
        opacity: 0.7,
        y: sleeperY,
      });
    });
}

function getRampSurfaceColor(kind: StreetDesignOsmFeatureKind, fallbackColor: string) {
  if (kind === 'rail') return '#3f474c';
  if (kind === 'bike_lane') return '#2f8f87';
  if (kind === 'sidewalk') return '#b9af9f';
  if (kind === 'parking') return '#697482';
  return fallbackColor;
}

function addElevationRampSegment(args: {
  THREE: ThreeModule;
  group: Group;
  segment: StreetDesignElevationRampSegment;
  color: string;
}) {
  const { THREE, group, segment } = args;
  const startY = segment.startY + 0.018;
  const endY = segment.endY + 0.055;
  const color = getRampSurfaceColor(segment.kind, args.color);

  addSlopedCorridorMesh({
    THREE,
    group,
    geometry: segment.geometry,
    color,
    opacity: segment.fallback ? 0.72 : 0.82,
    startY,
    endY,
  });
  addSlopedCorridorEdgeStrips({
    THREE,
    group,
    geometry: segment.geometry,
    color: segment.kind === 'bike_lane' ? '#c7fff5' : '#d7d2c3',
    opacity: 0.5,
    startY,
    endY,
  });

  if (segment.kind === 'rail') {
    addSlopedRailDetails({ THREE, group, geometry: segment.geometry, startY, endY });
    return;
  }

  if (segment.kind === 'road') {
    addSlopedStreetMarkings({ THREE, group, geometry: segment.geometry, startY, endY });
  }
}

function addElevationRampSegments(args: {
  THREE: ThreeModule;
  group: Group;
  segments: StreetDesignElevationRampSegment[] | undefined;
  color: string;
}) {
  args.segments?.forEach(segment => {
    addElevationRampSegment({
      THREE: args.THREE,
      group: args.group,
      segment,
      color: args.color,
    });
  });
}

function hasElevationRampSegments(segments: StreetDesignElevationRampSegment[] | undefined) {
  return Boolean(segments && segments.length > 0);
}

function getElevationRampPlateauGeometry(
  geometry: RenderableCorridorGeometry,
  segments: StreetDesignElevationRampSegment[] | undefined
) {
  if (!segments || segments.length === 0) return geometry;

  const startRampLength =
    segments.find(segment => segment.endpoint === 'start')?.geometry.length ?? 0;
  const endRampLength = segments.find(segment => segment.endpoint === 'end')?.geometry.length ?? 0;
  const startDistance = clamp(startRampLength, 0, geometry.length);
  const endDistance = clamp(geometry.length - endRampLength, 0, geometry.length);
  if (endDistance - startDistance <= 0.05) return null;

  return createCorridorGeometryFromCenterline(
    sliceCenterlineByDistance(getCorridorCenterline(geometry), startDistance, endDistance),
    geometry.width
  );
}

function getElevatedDeckColor(structureKind: string | undefined, color?: string) {
  return (
    color ??
    (structureKind === 'viaduct'
      ? '#8b8779'
      : structureKind === 'embankment'
        ? '#797662'
        : '#8f8b7d')
  );
}

function addInternalBridgeDeck(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry;
  deckY: number;
  color?: string;
  structureKind?: string;
  objectId?: string;
  osmWayId?: string;
  rampSegments: StreetDesignElevationRampSegment[] | undefined;
}) {
  const { THREE, group, geometry, deckY, structureKind, objectId, osmWayId, rampSegments } = args;
  if (!hasElevationRampSegments(rampSegments)) {
    addElevatedDeck({
      THREE,
      group,
      geometry,
      deckY,
      color: args.color,
      structureKind,
      objectId,
      osmWayId,
    });
    return;
  }

  const deckColor = getElevatedDeckColor(structureKind, args.color);
  rampSegments?.forEach(segment => {
    addSlopedCorridorMesh({
      THREE,
      group,
      geometry: segment.geometry,
      color: deckColor,
      opacity: 0.88,
      startY: Math.max(0.08, segment.startY - 0.24),
      endY: Math.max(0.08, segment.endY - 0.24),
    });
    addSlopedCorridorEdgeStrips({
      THREE,
      group,
      geometry: segment.geometry,
      color: '#d7d2c3',
      opacity: 0.44,
      startY: segment.startY,
      endY: segment.endY,
      yOffset: 0.018,
    });
  });

  const plateauGeometry = getElevationRampPlateauGeometry(geometry, rampSegments);
  if (!plateauGeometry) return;

  addElevatedDeck({
    THREE,
    group,
    geometry: plateauGeometry,
    deckY,
    color: args.color,
    structureKind,
    objectId,
    osmWayId,
  });
}

function addElevatedDeck(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry;
  deckY: number;
  color?: string;
  structureKind?: string;
  objectId?: string;
  osmWayId?: string;
}) {
  const { THREE, group, geometry, deckY, structureKind, objectId, osmWayId } = args;
  if (deckY <= 0.8) return;

  const deckColor = getElevatedDeckColor(structureKind, args.color);
  const undersideY = Math.max(0.12, deckY - 0.28);

  addCorridorMesh({
    THREE,
    group,
    geometry,
    color: deckColor,
    opacity: structureKind === 'embankment' ? 0.76 : 0.9,
    y: undersideY,
    objectId,
    osmWayId,
  });
  addCorridorEdgeStrips({
    THREE,
    group,
    geometry,
    color: '#d7d2c3',
    opacity: 0.54,
    y: deckY + 0.018,
    objectId,
    osmWayId,
  });

  if (structureKind === 'embankment') {
    addSurfaceTexture({
      THREE,
      group,
      geometry,
      color: '#5d6549',
      opacity: 0.18,
      y: undersideY + 0.02,
      objectId,
      osmWayId,
    });
    return;
  }

  const supportHeight = Math.max(deckY - 0.16, 0.5);
  const supportGeometry = new THREE.CylinderGeometry(
    structureKind === 'viaduct' ? 0.22 : 0.16,
    structureKind === 'viaduct' ? 0.28 : 0.2,
    supportHeight,
    10
  );
  const supportMaterial = new THREE.MeshStandardMaterial({
    color: structureKind === 'viaduct' ? '#777266' : '#827d70',
    roughness: 0.8,
    metalness: 0.02,
  });
  const supportSpacing = structureKind === 'viaduct' ? 9 : 14;
  const samples = getCorridorSamples(geometry, supportSpacing).slice(1, 40);
  const lateralOffsets =
    geometry.width >= 2.4 ? [-geometry.width * 0.36, geometry.width * 0.36] : [0];

  samples.forEach((sample, sampleIndex) => {
    if (sampleIndex === samples.length - 1 && samples.length > 2) return;

    lateralOffsets.forEach(offset => {
      const point = offsetPointFromDirection(sample.point, sample.direction, offset);
      const support = new THREE.Mesh(supportGeometry, supportMaterial);
      support.position.set(point.x, supportHeight / 2, point.z);
      setSceneShadows(support, true, true);
      setIdentities({ object: support, objectId, osmWayId });
      group.add(support);
    });
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

function addRailDetails(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry;
  objectId?: string;
  osmWayId?: string;
  y?: number;
}) {
  const { THREE, group, geometry, objectId, osmWayId, y = 0.14 } = args;
  const centerline = getCorridorCenterline(geometry);
  if (centerline.length < 2) return;

  [-0.42, 0.42].forEach(offset => {
    for (let index = 0; index < centerline.length - 1; index += 1) {
      const startPoint = centerline[index];
      const endPoint = centerline[index + 1];
      if (!startPoint || !endPoint) continue;
      const direction = normalizeDirection(startPoint, endPoint);
      addCorridorMesh({
        THREE,
        group,
        geometry: createCorridorGeometry(
          offsetPointFromDirection(startPoint, direction, offset),
          offsetPointFromDirection(endPoint, direction, offset),
          0.08
        ),
        color: '#d1d5db',
        opacity: 0.92,
        y,
        objectId,
        osmWayId,
      });
    }
  });

  getCorridorSamples(geometry, 1.2)
    .slice(0, 80)
    .forEach(sample => {
      const start = offsetPointFromDirection(sample.point, sample.direction, -0.65);
      const end = offsetPointFromDirection(sample.point, sample.direction, 0.65);
      addCorridorMesh({
        THREE,
        group,
        geometry: createCorridorGeometry(start, end, 0.07),
        color: '#5b4636',
        opacity: 0.75,
        y: y - 0.01,
        objectId,
        osmWayId,
      });
    });
}

function addCrossingMarkings(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry;
  objectId?: string;
  osmWayId?: string;
  y?: number;
}) {
  const { THREE, group, geometry, objectId, osmWayId, y = 0.16 } = args;
  getCorridorSamples(geometry, 0.75)
    .slice(0, 28)
    .forEach((sample, index) => {
      if (index % 2 === 1) return;
      const start = offsetPointFromDirection(
        sample.point,
        sample.direction,
        -geometry.width * 0.42
      );
      const end = offsetPointFromDirection(sample.point, sample.direction, geometry.width * 0.42);
      addCorridorMesh({
        THREE,
        group,
        geometry: createCorridorGeometry(start, end, 0.24),
        color: '#f8fafc',
        opacity: 0.92,
        y,
        objectId,
        osmWayId,
      });
    });
}

function addStairTreads(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry;
  objectId?: string;
  osmWayId?: string;
  y?: number;
  endY?: number;
  stepCount?: number;
  incline?: string;
}) {
  const { THREE, group, geometry, objectId, osmWayId, y = 0.15 } = args;
  const stepCount = Math.max(2, Math.min(args.stepCount ?? Math.round(geometry.length / 0.55), 96));
  const endY = typeof args.endY === 'number' ? args.endY : y;
  const samples = Array.from({ length: stepCount }, (_, index) => {
    const distance = geometry.length * ((index + 0.5) / stepCount);
    return getCenterlineSample(getCorridorCenterline(geometry), distance);
  });
  const reverse = args.incline === 'down';

  samples.forEach((sample, index) => {
    const ratio = stepCount <= 1 ? 0 : index / (stepCount - 1);
    const adjustedRatio = reverse ? 1 - ratio : ratio;
    const treadY = y + (endY - y) * adjustedRatio;
    const start = offsetPointFromDirection(sample.point, sample.direction, -geometry.width * 0.48);
    const end = offsetPointFromDirection(sample.point, sample.direction, geometry.width * 0.48);
    addCorridorMesh({
      THREE,
      group,
      geometry: createCorridorGeometry(start, end, 0.08),
      color: '#f5f0e8',
      opacity: 0.58,
      y: treadY,
      objectId,
      osmWayId,
    });
  });
}

function addBarrierVolume(args: {
  THREE: ThreeModule;
  group: Group;
  points: StreetDesignLocalPoint[];
  color: string;
  height?: number;
  objectId?: string;
  osmWayId?: string;
}) {
  const { THREE, group, points, color, height = 1.1, objectId, osmWayId } = args;
  addExtrudedPolygon({
    THREE,
    group,
    points,
    height,
    color,
    opacity: 0.82,
    objectId,
    osmWayId,
    bevel: false,
  });
}

function addSportsMarkings(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry | { polygon: StreetDesignLocalPoint[] };
  objectId?: string;
  osmWayId?: string;
  y?: number;
}) {
  const { THREE, group, geometry, objectId, osmWayId, y = 0.14 } = args;
  const points = geometry.polygon;
  if (points.length < 3) return;
  addPolygonOutline({ THREE, group, points, color: '#f8fafc', y, objectId, osmWayId });
  const center = getLocalPointsCenter(points);
  const radius = Math.max(
    0.5,
    Math.min(1.8, Math.hypot(points[0]?.x ?? 0, points[0]?.z ?? 0) * 0.04)
  );
  const circle = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.82, radius, 28),
    new THREE.MeshBasicMaterial({
      color: '#f8fafc',
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    })
  );
  circle.rotation.x = -Math.PI / 2;
  circle.position.set(center.x, y + 0.01, center.z);
  setIdentities({ object: circle, objectId, osmWayId });
  group.add(circle);
}

function addPlaygroundDetails(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry | { polygon: StreetDesignLocalPoint[] };
  objectId?: string;
  osmWayId?: string;
  y?: number;
}) {
  const { THREE, group, geometry, objectId, osmWayId, y = 0.16 } = args;
  const center = getLocalPointsCenter(geometry.polygon);
  const material = new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.7 });
  const mound = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.65, 4), material);
  mound.position.set(center.x, y + 0.34, center.z);
  mound.rotation.y = Math.PI / 4;
  setSceneShadows(mound, true, true);
  setIdentities({ object: mound, objectId, osmWayId });
  group.add(mound);
}

function addStationPlatformShelters(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: RenderableCorridorGeometry;
  objectId?: string;
  y: number;
  platformType: string;
}) {
  const { THREE, group, geometry, objectId, y, platformType } = args;
  if (geometry.length < 1.5) return;

  const primaryColor =
    platformType === 'rail_platform'
      ? '#2563eb'
      : platformType === 'bus_platform'
        ? '#f59e0b'
        : '#60a5fa';
  const roofMaterial = new THREE.MeshStandardMaterial({
    color: primaryColor,
    roughness: 0.58,
    metalness: 0.04,
  });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: '#dbeafe',
    transparent: true,
    opacity: 0.52,
    roughness: 0.24,
  });
  const postMaterial = new THREE.MeshStandardMaterial({
    color: '#475569',
    roughness: 0.72,
    metalness: 0.08,
  });
  const benchMaterial = new THREE.MeshStandardMaterial({
    color: '#8a5a2b',
    roughness: 0.7,
  });
  const signMaterial = new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    roughness: 0.5,
  });

  const margin = Math.min(5, geometry.length * 0.28);
  const distances =
    geometry.length < 16
      ? [geometry.length / 2]
      : Array.from(
          { length: Math.min(4, Math.floor((geometry.length - margin * 2) / 14) + 1) },
          (_, index) => margin + index * 14
        ).filter(distance => distance <= geometry.length - margin + 0.1);
  const centerline = getCorridorCenterline(geometry);

  distances.forEach(distance => {
    const sample = getCenterlineSample(centerline, distance);
    const point = offsetPointFromDirection(sample.point, sample.direction, geometry.width * 0.28);
    const root = new THREE.Group();
    root.position.set(point.x, y, point.z);
    root.rotation.y = Math.atan2(-sample.direction.z, sample.direction.x);
    setIdentities({ object: root, objectId });

    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.1, 1), roofMaterial);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.92, 0.06), glassMaterial);
    const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.82, 0.72), glassMaterial);
    const rightPanel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.82, 0.72), glassMaterial);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.12, 0.28), benchMaterial);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.55, 8), postMaterial);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.045), signMaterial);

    roof.position.set(0, 1.54, 0.02);
    back.position.set(0, 0.88, 0.48);
    leftPanel.position.set(-1.08, 0.82, 0.14);
    rightPanel.position.set(1.08, 0.82, 0.14);
    bench.position.set(0, 0.42, 0.2);
    pole.position.set(-1.32, 0.78, -0.45);
    sign.position.set(-1.32, 1.45, -0.45);

    [roof, back, leftPanel, rightPanel, bench, pole, sign].forEach(child => {
      setSceneShadows(child, true, true);
      setIdentities({ object: child, objectId });
      root.add(child);
    });

    group.add(root);
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

  if (object.geometry.kind === 'polygon') {
    const surfaceColor = getDesignObjectSurfaceColor(object, definition);
    addFlatPolygon({
      THREE,
      group,
      points: object.geometry.points,
      color: surfaceColor,
      opacity,
      y,
      objectId: object.id,
    });
    addPickPolygon({
      THREE,
      group,
      points: object.geometry.points,
      objectId: object.id,
      y: y + 0.2,
    });
    addPolygonOutline({
      THREE,
      group,
      points: object.geometry.points,
      color: selected ? '#facc15' : '#27323a',
      objectId: object.id,
      y: y + (selected ? 0.18 : 0.08),
    });
    return;
  }

  if (object.geometry.kind === 'corridor' || object.geometry.kind === 'path_corridor') {
    const surfaceColor = getDesignObjectSurfaceColor(object, definition);
    const deckAwareObject =
      definition.renderKind === 'road' ||
      definition.renderKind === 'lane' ||
      definition.renderKind === 'rail' ||
      object.type === 'sidewalk' ||
      object.type === 'stairs' ||
      object.type === 'station_platform';
    const objectDeckY = deckAwareObject ? getDesignObjectSurfaceY(object, y) : y;
    const surfaceY = object.type === 'stairs' ? y : objectDeckY;
    const pickY = Math.max(surfaceY, objectDeckY);
    const structureKind = getDesignObjectStructureKind(object);
    const rampKind = getDesignObjectElevationRampKind(object, definition);
    const elevationRampSegments = rampKind
      ? getStreetDesignManualElevationRampSegments({
          id: object.id,
          kind: rampKind,
          geometry: object.geometry,
          surfaceY: objectDeckY,
          baseY: y,
          structureKind,
        })
      : [];
    const flatSurfaceGeometry = hasElevationRampSegments(elevationRampSegments)
      ? getElevationRampPlateauGeometry(object.geometry, elevationRampSegments)
      : object.geometry;

    if (deckAwareObject && object.type !== 'stairs' && objectDeckY > y + 0.5) {
      addInternalBridgeDeck({
        THREE,
        group,
        geometry: object.geometry,
        deckY: objectDeckY,
        structureKind,
        objectId: object.id,
        rampSegments: elevationRampSegments,
      });
    }

    if (object.type === 'water_area') {
      addWaterSurface({
        THREE,
        group,
        geometry: object.geometry,
        color: surfaceColor,
        opacity: Math.min(opacity, 0.76),
        y: surfaceY,
        objectId: object.id,
      });
    } else {
      addElevationRampSegments({
        THREE,
        group,
        segments: elevationRampSegments,
        color: surfaceColor,
      });
      if (flatSurfaceGeometry) {
        addCorridorMesh({
          THREE,
          group,
          geometry: flatSurfaceGeometry,
          color: surfaceColor,
          opacity,
          y: surfaceY,
          objectId: object.id,
        });
      }
    }
    addPickPolygon({
      THREE,
      group,
      points: object.geometry.polygon,
      objectId: object.id,
      y: pickY + 0.2,
    });

    if (!flatSurfaceGeometry && hasElevationRampSegments(elevationRampSegments)) {
      if (selected) {
        addCorridorOutline({
          THREE,
          group,
          geometry: object.geometry,
          color: '#facc15',
          objectId: object.id,
          y: pickY + 0.18,
        });
      }
      return;
    }

    const detailGeometry = flatSurfaceGeometry ?? object.geometry;

    if (object.type === 'flower_bed') {
      addFlowerBedDetails({
        THREE,
        group,
        geometry: detailGeometry,
        objectId: object.id,
        animatedObjects,
        y: surfaceY + 0.03,
      });
    }

    if (object.type === 'grass_strip') {
      addGrassDetails({
        THREE,
        group,
        geometry: detailGeometry,
        objectId: object.id,
        animatedObjects,
        y: surfaceY + 0.02,
      });
    }

    if (object.type === 'water_area') {
      addWaterDetails({
        THREE,
        group,
        geometry: detailGeometry,
        objectId: object.id,
        animatedObjects,
        y: surfaceY + 0.08,
      });
      addCorridorEdgeStrips({
        THREE,
        group,
        geometry: detailGeometry,
        objectId: object.id,
        color:
          stringProperty(object.properties.edge, 'naturnah') === 'sitzkante'
            ? '#e8dcc7'
            : stringProperty(object.properties.edge, 'naturnah') === 'gefasst'
              ? '#9ca3af'
              : '#7db36f',
        opacity: 0.46,
        y: surfaceY + 0.075,
      });
    }

    if (object.type === 'wetland_area') {
      addGrassDetails({
        THREE,
        group,
        geometry: detailGeometry,
        objectId: object.id,
        animatedObjects,
        y: surfaceY + 0.04,
      });
      addSurfaceTexture({
        THREE,
        group,
        geometry: detailGeometry,
        objectId: object.id,
        color: '#9ed9c2',
        opacity: 0.26,
        y: surfaceY + 0.06,
      });
    }

    if (
      object.type === 'parking_area' ||
      object.type === 'loading_zone' ||
      object.type === 'taxi_stand'
    ) {
      addSurfaceTexture({
        THREE,
        group,
        geometry: detailGeometry,
        objectId: object.id,
        color:
          object.type === 'loading_zone'
            ? '#f8fafc'
            : object.type === 'taxi_stand'
              ? '#fde047'
              : '#454f59',
        opacity: object.type === 'loading_zone' ? 0.28 : 0.2,
        y: surfaceY + 0.06,
      });
      addParkingMarkings({
        THREE,
        group,
        geometry: detailGeometry,
        orientation: stringProperty(object.properties.orientation, 'parallel'),
        objectId: object.id,
        y: surfaceY + 0.08,
      });
    }

    if (object.type === 'sidewalk' || object.type === 'bike_lane') {
      const pathType = stringProperty(object.properties.pathType, 'sidewalk');
      const protection = stringProperty(object.properties.protection, 'painted');
      addSurfaceTexture({
        THREE,
        group,
        geometry: detailGeometry,
        objectId: object.id,
        color: object.type === 'bike_lane' ? '#9be8de' : '#e9dfcf',
        opacity: object.type === 'bike_lane' ? 0.28 : 0.34,
        y: surfaceY + 0.07,
      });
      addCorridorEdgeStrips({
        THREE,
        group,
        geometry: detailGeometry,
        objectId: object.id,
        color: object.type === 'bike_lane' ? '#c7fff5' : '#d4c6b5',
        opacity: 0.42,
        y: surfaceY + 0.08,
      });
      if (object.type === 'sidewalk' && pathType === 'accessible') {
        addSurfaceTexture({
          THREE,
          group,
          geometry: detailGeometry,
          objectId: object.id,
          color: '#facc15',
          opacity: 0.2,
          y: surfaceY + 0.095,
        });
      }
      if (object.type === 'sidewalk' && object.properties.tactilePaving === true) {
        addSurfaceTexture({
          THREE,
          group,
          geometry: detailGeometry,
          objectId: object.id,
          color: '#facc15',
          opacity: 0.42,
          y: surfaceY + 0.1,
        });
      }
      if (object.type === 'sidewalk' && pathType === 'promenade') {
        addCorridorEdgeStrips({
          THREE,
          group,
          geometry: detailGeometry,
          objectId: object.id,
          color: '#f5e7c7',
          opacity: 0.58,
          y: surfaceY + 0.1,
        });
      }
      if (object.type === 'bike_lane' && (protection === 'protected' || protection === 'raised')) {
        addCorridorEdgeStrips({
          THREE,
          group,
          geometry: detailGeometry,
          objectId: object.id,
          color: protection === 'raised' ? '#e2f6ef' : '#d9f99d',
          opacity: protection === 'raised' ? 0.78 : 0.62,
          y: surfaceY + 0.105,
        });
      }
    }

    if (definition.renderKind === 'rail') {
      addRailDetails({
        THREE,
        group,
        geometry: detailGeometry,
        objectId: object.id,
        y: surfaceY + 0.08,
      });
      if (object.type === 'rail_track') {
        const railType = stringProperty(object.properties.railType, 'tram');
        addSurfaceTexture({
          THREE,
          group,
          geometry: detailGeometry,
          objectId: object.id,
          color:
            railType === 'rail' ? '#d1d5db' : railType === 'light_rail' ? '#a7f3d0' : '#c7d2fe',
          opacity: 0.18,
          y: surfaceY + 0.095,
        });
      }
    }

    if (object.type === 'station_platform') {
      const platformType = stringProperty(object.properties.platformType, 'tram_stop');
      const isElevatedPlatform = surfaceY > y + 0.08;
      if (isElevatedPlatform) {
        addExtrudedPolygon({
          THREE,
          group,
          points: object.geometry.polygon,
          height: Math.max(surfaceY - 0.08, 0.04),
          color: platformType === 'rail_platform' ? '#8aa0b8' : '#b6a57d',
          opacity: 0.74,
          objectId: object.id,
          bevel: false,
        });
        addSurfaceTexture({
          THREE,
          group,
          geometry: detailGeometry,
          objectId: object.id,
          color: '#facc15',
          opacity: 0.22,
          y: surfaceY + 0.075,
        });
      }
      addCorridorEdgeStrips({
        THREE,
        group,
        geometry: detailGeometry,
        objectId: object.id,
        color:
          platformType === 'rail_platform'
            ? '#dbeafe'
            : platformType === 'bus_platform'
              ? '#fde68a'
              : '#fef3c7',
        opacity: 0.62,
        y: surfaceY + 0.09,
      });
      if (object.properties.shelter !== false) {
        addStationPlatformShelters({
          THREE,
          group,
          geometry: detailGeometry,
          objectId: object.id,
          y: surfaceY + 0.04,
          platformType,
        });
      }
    }

    if (definition.renderKind === 'barrier') {
      addBarrierVolume({
        THREE,
        group,
        points: object.geometry.polygon,
        color: definition.color,
        height:
          object.type === 'kerb'
            ? Math.max(numberProperty(object.properties.height, 0.12), 0.04)
            : Math.max(numberProperty(object.properties.height, 1.1), 0.3),
        objectId: object.id,
      });
    }

    if (object.type === 'crossing') {
      const crossingType = stringProperty(object.properties.crossingType, 'zebra');
      addCrossingMarkings({
        THREE,
        group,
        geometry: detailGeometry,
        objectId: object.id,
        y: surfaceY + 0.08,
      });
      if (crossingType === 'raised' || crossingType === 'refuge') {
        addCorridorEdgeStrips({
          THREE,
          group,
          geometry: detailGeometry,
          objectId: object.id,
          color: crossingType === 'raised' ? '#fde68a' : '#93c5fd',
          opacity: 0.58,
          y: surfaceY + 0.105,
        });
      }
      if (crossingType === 'signalized') {
        addSurfaceTexture({
          THREE,
          group,
          geometry: detailGeometry,
          objectId: object.id,
          color: '#ef4444',
          opacity: 0.18,
          y: surfaceY + 0.11,
        });
      }
    }

    if (object.type === 'stairs') {
      addStairTreads({
        THREE,
        group,
        geometry: detailGeometry,
        objectId: object.id,
        y: surfaceY + 0.08,
        endY: objectDeckY,
        stepCount: numberProperty(object.properties.steps, 6),
        incline: stringProperty(object.properties.incline, 'up'),
      });
    }

    if (definition.renderKind === 'sports') {
      addSportsMarkings({
        THREE,
        group,
        geometry: detailGeometry,
        objectId: object.id,
        y: surfaceY + 0.08,
      });
      if (stringProperty(object.properties.sport, 'multi') === 'basketball') {
        addStreetMarkings({
          THREE,
          group,
          geometry: detailGeometry,
          objectId: object.id,
          color: '#fef3c7',
          y: surfaceY + 0.1,
        });
      }
    }

    if (definition.renderKind === 'playground') {
      addPlaygroundDetails({
        THREE,
        group,
        geometry: detailGeometry,
        objectId: object.id,
        y: surfaceY + 0.08,
      });
    }

    if (definition.renderKind === 'road' || object.type === 'car_lane') {
      addRoadSurfaceDetails({
        THREE,
        group,
        geometry: detailGeometry,
        objectId: object.id,
        y: surfaceY + 0.055,
      });
      if (object.type === 'street') {
        const roadClass = stringProperty(object.properties.roadClass, 'residential');
        const status = stringProperty(object.properties.status, 'open');
        if (roadClass === 'living_street' || roadClass === 'pedestrian') {
          addSurfaceTexture({
            THREE,
            group,
            geometry: detailGeometry,
            objectId: object.id,
            color: roadClass === 'pedestrian' ? '#f5e7c7' : '#d9f99d',
            opacity: 0.22,
            y: surfaceY + 0.085,
          });
        }
        if (roadClass === 'construction' || status === 'construction') {
          addSurfaceTexture({
            THREE,
            group,
            geometry: detailGeometry,
            objectId: object.id,
            color: '#f59e0b',
            opacity: 0.34,
            y: surfaceY + 0.09,
          });
        }
      }
      if (object.type === 'car_lane') {
        const laneUse = stringProperty(object.properties.laneUse, 'general');
        if (laneUse !== 'general') {
          addSurfaceTexture({
            THREE,
            group,
            geometry: detailGeometry,
            objectId: object.id,
            color: laneUse === 'bus' ? '#dc2626' : laneUse === 'taxi' ? '#eab308' : '#2563eb',
            opacity: 0.28,
            y: surfaceY + 0.08,
          });
        }
      }
    }

    if (definition.renderKind === 'traffic' && object.type === 'traffic_calming') {
      const calmingType = stringProperty(object.properties.calmingType, 'table');
      addSurfaceTexture({
        THREE,
        group,
        geometry: detailGeometry,
        objectId: object.id,
        color: calmingType === 'chicane' ? '#f97316' : '#f59e0b',
        opacity: calmingType === 'hump' ? 0.26 : 0.34,
        y: surfaceY + 0.08,
      });
      if (calmingType === 'narrowing' || calmingType === 'chicane') {
        addCorridorEdgeStrips({
          THREE,
          group,
          geometry: detailGeometry,
          objectId: object.id,
          color: '#fef3c7',
          opacity: 0.62,
          y: surfaceY + 0.095,
        });
      }
    }

    if (object.type === 'traffic_island') {
      addCorridorEdgeStrips({
        THREE,
        group,
        geometry: detailGeometry,
        objectId: object.id,
        color: '#f8fafc',
        opacity: 0.72,
        y: surfaceY + 0.09,
      });
      addSurfaceTexture({
        THREE,
        group,
        geometry: detailGeometry,
        objectId: object.id,
        color: '#65a30d',
        opacity: 0.24,
        y: surfaceY + 0.1,
      });
    }

    if (object.type === 'public_space') {
      addSurfaceTexture({
        THREE,
        group,
        geometry: detailGeometry,
        objectId: object.id,
        color: '#f4eadc',
        opacity: 0.34,
        y: surfaceY + 0.07,
      });
    }

    if (object.type === 'construction_area') {
      addSurfaceTexture({
        THREE,
        group,
        geometry: detailGeometry,
        objectId: object.id,
        color:
          stringProperty(object.properties.status, 'planned') === 'closed' ? '#fca5a5' : '#fdba74',
        opacity: 0.32,
        y: surfaceY + 0.07,
      });
    }

    if (showStreetMarkings && object.type === 'car_lane') {
      addCarLaneMarkings({
        THREE,
        group,
        geometry: detailGeometry,
        direction: stringProperty(object.properties.direction, 'one_way'),
        objectId: object.id,
        y: surfaceY + 0.088,
      });
    } else if (showStreetMarkings && definition.renderKind === 'road') {
      addStreetMarkings({
        THREE,
        group,
        geometry: detailGeometry,
        objectId: object.id,
        y: surfaceY + 0.07,
      });
    }

    if (!selected) {
      addCorridorOutline({
        THREE,
        group,
        geometry: object.geometry,
        color: '#27323a',
        objectId: object.id,
        y: pickY + 0.04,
      });
    } else {
      addCorridorOutline({
        THREE,
        group,
        geometry: object.geometry,
        color: '#facc15',
        objectId: object.id,
        y: pickY + 0.18,
      });
    }
  }
}

function getChangeRequestOverlayColor(tone: Exclude<StreetDesignChangeRequestTone, 'neutral'>) {
  return tone === 'remove' ? '#ef4444' : '#22c55e';
}

function getChangeRequestOverlayOpacity(args: {
  selected: boolean;
  colorMode: StreetDesignChangeRequestColorMode;
}) {
  if (args.colorMode === 'tinted') return args.selected ? 0.86 : 0.72;
  return args.selected ? 0.82 : 0.58;
}

function forEachObjectMaterial(object: Object3D, visitor: (material: ThreeMaterial) => void) {
  object.traverse(child => {
    const material = (child as { material?: ThreeMaterial | ThreeMaterial[] }).material;
    if (!material) return;
    if (Array.isArray(material)) {
      material.forEach(visitor);
      return;
    }
    visitor(material);
  });
}

function cloneObjectMaterials(object: Object3D) {
  object.traverse(child => {
    const target = child as { material?: ThreeMaterial | ThreeMaterial[] };
    if (!target.material) return;
    target.material = Array.isArray(target.material)
      ? target.material.map(material => material.clone())
      : target.material.clone();
  });
}

function isInvisiblePickMaterial(material: ThreeMaterial) {
  return material.transparent && typeof material.opacity === 'number' && material.opacity <= 0.02;
}

function applyChangeRequestOverlayMaterialStyle(args: {
  object: Object3D;
  color: string;
  colorMode: StreetDesignChangeRequestColorMode;
  opacity: number;
}) {
  cloneObjectMaterials(args.object);
  forEachObjectMaterial(args.object, material => {
    if (isInvisiblePickMaterial(material)) return;

    const styledMaterial = material as ThreeMaterial & {
      color?: { set: (color: string) => void };
      opacity?: number;
      transparent?: boolean;
      depthWrite?: boolean;
      needsUpdate?: boolean;
    };
    if (args.colorMode === 'tinted') {
      styledMaterial.color?.set(args.color);
    }

    if (typeof styledMaterial.opacity === 'number') {
      styledMaterial.opacity = Math.min(styledMaterial.opacity, args.opacity);
    } else {
      styledMaterial.opacity = args.opacity;
    }
    styledMaterial.transparent = styledMaterial.opacity < 1;
    if (styledMaterial.transparent) {
      styledMaterial.depthWrite = false;
    }
    styledMaterial.needsUpdate = true;
  });
}

function addChangeRequestOverlayAccent(args: {
  THREE: ThreeModule;
  group: Group;
  object: StreetDesignObject;
  color: string;
  selected: boolean;
}) {
  const { THREE, group, object, color, selected } = args;
  const outlineY = selected ? 0.62 : 0.46;

  if (object.geometry.kind === 'point') {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(selected ? 0.86 : 0.64, 18, 12),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: selected ? 0.24 : 0.16,
        depthWrite: false,
      })
    );
    marker.position.set(object.geometry.point.x, outlineY + 0.36, object.geometry.point.z);
    group.add(marker);
    return;
  }

  if (object.geometry.kind === 'corridor' || object.geometry.kind === 'path_corridor') {
    const definition = getStreetDesignObjectDefinition(object.type);
    const y =
      definition.renderKind === 'building'
        ? Math.max(numberProperty(object.properties.height, 9), 1) + 0.42
        : outlineY;

    addPolygonOutline({
      THREE,
      group,
      points: object.geometry.polygon,
      color,
      y,
    });
    return;
  }

  addPolygonOutline({
    THREE,
    group,
    points: object.geometry.points,
    color,
    y: outlineY,
  });
}

function addChangeRequestOverlayObject(args: {
  THREE: ThreeModule;
  group: Group;
  overlay: StreetDesignChangeRequestOverlayObject;
  selected: boolean;
  colorMode: StreetDesignChangeRequestColorMode;
}) {
  const { THREE, group, overlay, selected, colorMode } = args;
  const color = getChangeRequestOverlayColor(overlay.tone);
  const opacity = getChangeRequestOverlayOpacity({ selected, colorMode });
  const object = overlay.object;
  const overlayGroup = new THREE.Group();
  overlayGroup.name = `change-request-overlay:${overlay.id}`;
  overlayGroup.userData.changeRequestId = overlay.changeRequestId;
  overlayGroup.position.y = selected ? 0.08 : 0.05;

  addDesignObject({
    THREE,
    group: overlayGroup,
    object,
    selected: false,
    showStreetMarkings: true,
    opacity,
    y: selected ? 0.2 : 0.14,
  });

  clearObjectId(overlayGroup);
  applyChangeRequestOverlayMaterialStyle({ object: overlayGroup, color, colorMode, opacity });
  addChangeRequestOverlayAccent({
    THREE,
    group: overlayGroup,
    object,
    color,
    selected,
  });
  group.add(overlayGroup);
}

function createOsmCorridorGeometry(
  points: StreetDesignLocalPoint[],
  widthMeters: number
): RenderableCorridorGeometry | null {
  if (points.length < 2) return null;
  const safeWidth = Math.max(widthMeters, 0.2);
  const start = points[0];
  const end = points[points.length - 1];
  if (!start || !end) return null;

  return points.length === 2
    ? createCorridorGeometry(start, end, safeWidth)
    : createPathCorridorGeometry(points, safeWidth);
}

function createOsmTreeObject(args: {
  id: string;
  point: StreetDesignLocalPoint;
  rotation?: number;
}): StreetDesignObject {
  const definition = getStreetDesignObjectDefinition('tree');

  return {
    id: `osm-${args.id}`,
    type: 'tree',
    geometry: {
      kind: 'point',
      point: args.point,
      rotation: args.rotation ?? 0,
    },
    properties: { ...definition.defaultProperties },
    cost: {
      rule: definition.costRule,
      currency: STREET_DESIGN_CURRENCY,
      suggestedUnitCostMinor: definition.suggestedUnitCostMinor,
    },
  };
}

function getOsmPointObjectType(way: StreetDesignOsmWay): StreetDesignObjectType {
  if (way.mappedObjectType) return way.mappedObjectType;
  if (way.kind === 'tree') return 'tree';
  if (way.kind === 'water') return 'fountain';
  if (way.kind === 'transit') return 'bus_stop';
  if (way.kind === 'traffic') {
    if (way.subkind === 'crossing') return 'crossing';
    if (way.subkind === 'traffic_calming') return 'traffic_calming';
    return 'traffic_signal';
  }
  if (way.kind === 'barrier') {
    if (way.subkind === 'gate') return 'gate';
    return 'bollard';
  }
  if (way.kind === 'utility') {
    if (way.subkind === 'fire_hydrant') return 'hydrant';
    if (way.subkind === 'post_box') return 'post_box';
    if (way.subkind === 'recycling') return 'recycling_container';
    if (way.subkind === 'waste_basket') return 'waste_bin';
    return 'fountain';
  }
  if (way.kind === 'street_furniture') {
    if (way.subkind === 'street_lamp') return 'street_lamp';
    if (way.subkind === 'bicycle_parking') return 'bicycle_parking';
    return 'bank';
  }
  return 'bank';
}

function createOsmPointObject(args: {
  id: string;
  type: StreetDesignObjectType;
  point: StreetDesignLocalPoint;
  rotation?: number;
}): StreetDesignObject {
  const definition = getStreetDesignObjectDefinition(args.type);

  return {
    id: `osm-${args.id}`,
    type: args.type,
    geometry: {
      kind: 'point',
      point: args.point,
      rotation: args.rotation ?? 0,
    },
    properties: { ...definition.defaultProperties },
    cost: {
      rule: definition.costRule,
      currency: STREET_DESIGN_CURRENCY,
      suggestedUnitCostMinor: definition.suggestedUnitCostMinor,
    },
  };
}

function addOsmTreePoint(args: {
  THREE: ThreeModule;
  group: Group;
  way: StreetDesignOsmWay;
  point: StreetDesignLocalPoint;
  selected: boolean;
  animatedObjects: Object3D[];
  rotation?: number;
}) {
  const { THREE, group, way, point, selected, animatedObjects, rotation } = args;
  const tree = addPointObject({
    THREE,
    group,
    object: createOsmTreeObject({ id: way.id, point, rotation }),
    selected,
  });

  if (!tree) return;

  clearObjectId(tree);
  setOsmWayId(tree, way.id);
  tree.userData.baseY = tree.position.y;
  tree.userData.phase = point.x * 0.11 + point.z * 0.07;
  tree.userData.motion = 'tree';
  animatedObjects.push(tree);
}

function addOsmPointFeature(args: {
  THREE: ThreeModule;
  group: Group;
  way: StreetDesignOsmWay;
  point: StreetDesignLocalPoint;
  selected: boolean;
  animatedObjects: Object3D[];
}) {
  const { THREE, group, way, point, selected, animatedObjects } = args;
  const objectType = getOsmPointObjectType(way);
  const object = createOsmPointObject({ id: way.id, type: objectType, point });
  const pointObject = addPointObject({ THREE, group, object, selected });
  if (!pointObject) return;

  clearObjectId(pointObject);
  setOsmWayId(pointObject, way.id);

  if (objectType === 'tree' || objectType === 'bush') {
    pointObject.userData.baseY = pointObject.position.y;
    pointObject.userData.phase = point.x * 0.11 + point.z * 0.07;
    pointObject.userData.motion = objectType === 'tree' ? 'tree' : 'bush';
    animatedObjects.push(pointObject);
  }
}

function addOsmTreeRow(args: {
  THREE: ThreeModule;
  group: Group;
  way: StreetDesignOsmWay;
  localPoints: StreetDesignLocalPoint[];
  selected: boolean;
  animatedObjects: Object3D[];
}) {
  const { THREE, group, way, localPoints, selected, animatedObjects } = args;
  const geometry = createOsmCorridorGeometry(localPoints, way.widthMeters ?? 1.8);
  if (!geometry) return;

  const samples = getCorridorSamples(geometry, 6).slice(0, 90);
  samples.forEach(sample => {
    addOsmTreePoint({
      THREE,
      group,
      way,
      point: sample.point,
      selected: false,
      animatedObjects,
      rotation: Math.atan2(sample.direction.x, sample.direction.z),
    });
  });

  addPickPolygon({
    THREE,
    group,
    points: geometry.polygon,
    osmWayId: way.id,
    y: 0.22,
  });

  if (selected) {
    addCorridorOutline({
      THREE,
      group,
      geometry,
      color: '#facc15',
      y: 0.24,
    });
  }
}

export function getStreetDesignOsmRenderPriority(kind: StreetDesignOsmFeatureKind) {
  switch (kind) {
    case 'green':
      return 0;
    case 'water':
      return 1;
    case 'road':
      return 2;
    case 'parking':
      return 3;
    case 'sidewalk':
      return 4;
    case 'bike_lane':
      return 5;
    case 'building':
      return 6;
    case 'tree_row':
      return 7;
    case 'tree':
      return 8;
    case 'rail':
      return 9;
    case 'construction':
      return 10;
    case 'landuse_context':
      return 11;
    case 'civic_area':
      return 12;
    case 'sports':
    case 'playground':
      return 13;
    case 'barrier':
      return 14;
    case 'traffic':
      return 15;
    case 'transit':
      return 16;
    case 'street_furniture':
    case 'utility':
      return 17;
    default:
      return 18;
  }
}

function getOsmLineFeatureSurfaceY(way: StreetDesignOsmWay) {
  if (way.kind === 'rail') {
    return getStreetDesignOsmFeatureRenderY(way, way.level === 'tunnel' ? 0.035 : 0.07);
  }
  if (way.kind === 'road') {
    return getStreetDesignOsmFeatureRenderY(way, way.level === 'tunnel' ? 0.035 : 0.052);
  }
  if (way.kind === 'parking') {
    return getStreetDesignOsmFeatureRenderY(way, 0.06);
  }
  if (way.kind === 'sidewalk' || way.kind === 'bike_lane') {
    return getStreetDesignOsmFeatureRenderY(way, 0.058);
  }
  return getStreetDesignOsmFeatureRenderY(way);
}

function getOsmLineFeatureWidth(way: StreetDesignOsmWay) {
  if (way.kind === 'rail') return way.widthMeters ?? 1.6;
  if (way.kind === 'road') return way.widthMeters ?? 4.8;
  if (way.kind === 'parking') return way.widthMeters ?? 2.2;
  return way.widthMeters ?? 2.2;
}

function getOsmRampSurfaceColor(way: StreetDesignOsmWay) {
  if (way.kind === 'rail') return '#3f474c';
  if (way.kind === 'bike_lane') return '#2f8f87';
  if (way.kind === 'parking') return way.subkind === 'loading_zone' ? '#9a6b30' : '#697482';
  if (way.kind === 'sidewalk') return way.subkind === 'bridleway' ? '#9b7a55' : '#b9af9f';
  if (way.kind === 'road') {
    if (way.subkind === 'construction') return '#b7791f';
    if (way.subkind === 'track') return '#8a6a42';
    return way.renderColor ?? '#4b545a';
  }
  return way.renderColor ?? '#4b545a';
}

function buildOsmElevationRampFeature(args: {
  way: StreetDesignOsmWay;
  localPoints: StreetDesignLocalPoint[];
}): StreetDesignElevationRampFeature | null {
  const { way, localPoints } = args;
  if (
    !canFeatureReceiveElevationRamp(way.kind) ||
    way.geometryKind !== 'line' ||
    way.subkind === 'steps'
  ) {
    return null;
  }

  const geometry = createOsmCorridorGeometry(localPoints, getOsmLineFeatureWidth(way));
  if (!geometry) return null;

  return {
    id: way.id,
    kind: way.kind,
    geometry,
    surfaceY: getOsmLineFeatureSurfaceY(way),
    structureKind: way.structureKind,
  } satisfies StreetDesignElevationRampFeature;
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

  const layerVisibility = getStreetDesignOsmLayerVisibility(design.osmLayerVisibility);
  const hiddenOsmWayIds = getStreetDesignHiddenOsmFeatureIds(design);
  const showStreetMarkings = design.showStreetMarkings ?? true;

  const osmFeatures = getStreetDesignOsmFeatures(snapshot)
    .slice()
    .sort(
      (left, right) =>
        getStreetDesignOsmRenderPriority(left.kind) -
          getStreetDesignOsmRenderPriority(right.kind) || left.id.localeCompare(right.id)
    );
  const visibleOsmFeatures = osmFeatures.filter(way => {
    const layer = getStreetDesignOsmFeatureLayer(way.kind);
    return !hiddenOsmWayIds.has(way.id) && layerVisibility[layer];
  });
  const elevationRampFeatures = visibleOsmFeatures
    .map(way =>
      buildOsmElevationRampFeature({
        way,
        localPoints: getOsmWayLocalPoints(way, design),
      })
    )
    .filter((feature): feature is StreetDesignElevationRampFeature => Boolean(feature));
  const elevationRampsByFeatureId = getStreetDesignElevationRampSegments(
    elevationRampFeatures
  ).reduce<Map<string, StreetDesignElevationRampSegment[]>>((result, segment) => {
    const segments = result.get(segment.sourceId) ?? [];
    segments.push(segment);
    result.set(segment.sourceId, segments);
    return result;
  }, new Map());

  visibleOsmFeatures.forEach(way => {
    const layer = getStreetDesignOsmFeatureLayer(way.kind);
    if (hiddenOsmWayIds.has(way.id)) {
      return;
    }
    if (!layerVisibility[layer]) {
      return;
    }

    const localPoints = getOsmWayLocalPoints(way, design);
    const isSelected = way.id === selectedOsmWayId;

    if (way.kind === 'tree') {
      const point = localPoints[0];
      if (point) {
        addOsmTreePoint({
          THREE,
          group,
          way,
          point,
          selected: isSelected,
          animatedObjects,
        });
      }
      return;
    }

    if (way.kind === 'tree_row') {
      if (localPoints.length < 2) {
        return;
      }
      addOsmTreeRow({ THREE, group, way, localPoints, selected: isSelected, animatedObjects });
      return;
    }

    if (way.geometryKind === 'point') {
      const point = localPoints[0];
      if (point) {
        addOsmPointFeature({
          THREE,
          group,
          way,
          point,
          selected: isSelected,
          animatedObjects,
        });
      }
      return;
    }

    if (way.kind === 'rail') {
      const geometry = createOsmCorridorGeometry(localPoints, way.widthMeters ?? 1.6);
      if (!geometry) {
        return;
      }
      const surfaceY = getStreetDesignOsmFeatureRenderY(way, way.level === 'tunnel' ? 0.035 : 0.07);
      const elevationRampSegments = elevationRampsByFeatureId.get(way.id);
      const flatGeometry = hasElevationRampSegments(elevationRampSegments)
        ? getElevationRampPlateauGeometry(geometry, elevationRampSegments)
        : geometry;
      if (isElevatedOsmStructure(way)) {
        addInternalBridgeDeck({
          THREE,
          group,
          geometry,
          deckY: surfaceY,
          structureKind: way.structureKind,
          osmWayId: way.id,
          rampSegments: elevationRampSegments,
        });
      }
      addElevationRampSegments({
        THREE,
        group,
        segments: elevationRampSegments,
        color: getOsmRampSurfaceColor(way),
      });
      if (flatGeometry) {
        addCorridorMesh({
          THREE,
          group,
          geometry: flatGeometry,
          color: way.level === 'tunnel' ? '#64748b' : '#3f474c',
          opacity: way.level === 'tunnel' ? 0.45 : 0.82,
          y: surfaceY,
          osmWayId: way.id,
        });
        addRailDetails({
          THREE,
          group,
          geometry: flatGeometry,
          osmWayId: way.id,
          y: surfaceY + 0.08,
        });
      }
      addPickPolygon({
        THREE,
        group,
        points: geometry.polygon,
        osmWayId: way.id,
        y: surfaceY + 0.22,
      });
      if (isSelected) {
        addCorridorOutline({
          THREE,
          group,
          geometry,
          color: '#facc15',
          y: surfaceY + 0.18,
          osmWayId: way.id,
        });
      }
      return;
    }

    if (way.kind === 'barrier') {
      const color = way.renderColor ?? (way.subkind === 'hedge' ? '#4d7c3f' : '#64748b');
      const geometry =
        way.geometryKind === 'polygon'
          ? { polygon: localPoints, width: way.widthMeters ?? 0.7, length: 0 }
          : createOsmCorridorGeometry(localPoints, way.widthMeters ?? 0.5);
      if (!geometry || geometry.polygon.length < 3) {
        return;
      }
      addBarrierVolume({
        THREE,
        group,
        points: geometry.polygon,
        color,
        height:
          way.subkind === 'wall'
            ? 1.2
            : way.subkind === 'hedge'
              ? 1.1
              : way.subkind === 'kerb'
                ? 0.12
                : 0.75,
        osmWayId: way.id,
      });
      addPickPolygon({ THREE, group, points: geometry.polygon, osmWayId: way.id, y: 1.35 });
      if (isSelected) {
        addPolygonOutline({
          THREE,
          group,
          points: geometry.polygon,
          color: '#facc15',
          osmWayId: way.id,
        });
      }
      return;
    }

    if (
      way.kind === 'traffic' ||
      way.kind === 'transit' ||
      way.kind === 'street_furniture' ||
      way.kind === 'utility'
    ) {
      const corridorGeometry =
        way.geometryKind === 'polygon'
          ? null
          : createOsmCorridorGeometry(localPoints, way.widthMeters ?? 1.2);
      const polygon =
        way.geometryKind === 'polygon' ? localPoints : (corridorGeometry?.polygon ?? []);
      if (polygon.length < 3) {
        return;
      }
      addFlatPolygon({
        THREE,
        group,
        points: polygon,
        color: way.renderColor ?? (way.kind === 'transit' ? '#2563eb' : '#d9d4c8'),
        opacity: way.kind === 'traffic' ? 0.72 : 0.48,
        y: 0.12,
        osmWayId: way.id,
      });
      if (way.subkind === 'crossing' && corridorGeometry) {
        addCrossingMarkings({
          THREE,
          group,
          geometry: corridorGeometry,
          osmWayId: way.id,
          y: 0.18,
        });
      }
      if (way.subkind === 'traffic_calming' && corridorGeometry) {
        addSurfaceTexture({
          THREE,
          group,
          geometry: corridorGeometry,
          osmWayId: way.id,
          color: '#f59e0b',
          opacity: 0.42,
          y: 0.18,
        });
      }
      addPickPolygon({ THREE, group, points: polygon, osmWayId: way.id, y: 0.28 });
      if (isSelected)
        addPolygonOutline({ THREE, group, points: polygon, color: '#facc15', osmWayId: way.id });
      return;
    }

    if (
      way.kind === 'sports' ||
      way.kind === 'playground' ||
      way.kind === 'construction' ||
      way.kind === 'landuse_context' ||
      way.kind === 'civic_area'
    ) {
      if (localPoints.length < 3) {
        return;
      }
      const color =
        way.renderColor ??
        (way.kind === 'construction'
          ? '#a16207'
          : way.kind === 'landuse_context'
            ? '#8f8a7a'
            : way.kind === 'playground'
              ? '#d6a23f'
              : way.kind === 'civic_area'
                ? '#8ba77f'
                : '#5f9f65');
      addFlatPolygon({
        THREE,
        group,
        points: localPoints,
        color,
        opacity: way.kind === 'landuse_context' ? 0.28 : 0.56,
        y: 0.01,
        osmWayId: way.id,
      });
      if (way.kind === 'sports') {
        addSportsMarkings({
          THREE,
          group,
          geometry: { polygon: localPoints },
          osmWayId: way.id,
          y: 0.09,
        });
      }
      if (way.kind === 'playground') {
        addPlaygroundDetails({
          THREE,
          group,
          geometry: { polygon: localPoints },
          osmWayId: way.id,
          y: 0.08,
        });
      }
      addPickPolygon({ THREE, group, points: localPoints, osmWayId: way.id, y: 0.18 });
      if (isSelected)
        addPolygonOutline({
          THREE,
          group,
          points: localPoints,
          color: '#facc15',
          osmWayId: way.id,
        });
      return;
    }

    if (way.kind === 'road') {
      const geometry = createOsmCorridorGeometry(localPoints, way.widthMeters ?? 4.8);
      if (!geometry) {
        return;
      }
      const isConstruction = way.subkind === 'construction';
      const isTrack = way.subkind === 'track';
      const surfaceY = getStreetDesignOsmFeatureRenderY(
        way,
        way.level === 'tunnel' ? 0.035 : 0.052
      );
      const elevationRampSegments = elevationRampsByFeatureId.get(way.id);
      const flatGeometry = hasElevationRampSegments(elevationRampSegments)
        ? getElevationRampPlateauGeometry(geometry, elevationRampSegments)
        : geometry;

      if (isElevatedOsmStructure(way)) {
        addInternalBridgeDeck({
          THREE,
          group,
          geometry,
          deckY: surfaceY,
          structureKind: way.structureKind,
          osmWayId: way.id,
          rampSegments: elevationRampSegments,
        });
      }

      addElevationRampSegments({
        THREE,
        group,
        segments: elevationRampSegments,
        color: getOsmRampSurfaceColor(way),
      });
      if (flatGeometry) {
        addCorridorMesh({
          THREE,
          group,
          geometry: flatGeometry,
          color: way.renderColor ?? (isConstruction ? '#b7791f' : isTrack ? '#8a6a42' : '#4b545a'),
          opacity: way.level === 'tunnel' ? 0.42 : isConstruction ? 0.62 : 0.8,
          y: surfaceY,
          osmWayId: way.id,
        });
        if (!isConstruction) {
          addRoadSurfaceDetails({
            THREE,
            group,
            geometry: flatGeometry,
            osmWayId: way.id,
            y: surfaceY + 0.038,
          });
        } else {
          addSurfaceTexture({
            THREE,
            group,
            geometry: flatGeometry,
            osmWayId: way.id,
            color: '#f59e0b',
            opacity: 0.34,
            y: surfaceY + 0.05,
          });
        }
      }
      addPickPolygon({
        THREE,
        group,
        points: geometry.polygon,
        osmWayId: way.id,
        y: surfaceY + 0.13,
      });
      if (showStreetMarkings && flatGeometry) {
        addStreetMarkings({
          THREE,
          group,
          geometry: flatGeometry,
          y: surfaceY + 0.046,
          osmWayId: way.id,
        });
      }
      if (isSelected) {
        addCorridorOutline({
          THREE,
          group,
          geometry,
          color: '#facc15',
          y: surfaceY + 0.16,
          osmWayId: way.id,
        });
      }
      return;
    }

    if (way.kind === 'sidewalk' || way.kind === 'bike_lane' || way.kind === 'parking') {
      if (way.geometryKind === 'polygon') {
        if (localPoints.length < 3) {
          return;
        }
        addFlatPolygon({
          THREE,
          group,
          points: localPoints,
          color:
            way.kind === 'bike_lane'
              ? '#2f8f87'
              : way.kind === 'parking'
                ? way.subkind === 'loading_zone'
                  ? '#9a6b30'
                  : '#697482'
                : way.subkind === 'bridleway'
                  ? '#9b7a55'
                  : '#b9af9f',
          opacity: way.kind === 'parking' ? 0.72 : 0.82,
          y: 0.058,
          osmWayId: way.id,
        });
        addPickPolygon({
          THREE,
          group,
          points: localPoints,
          osmWayId: way.id,
          y: 0.18,
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
        return;
      }

      const geometry = createOsmCorridorGeometry(localPoints, way.widthMeters ?? 2.2);
      if (!geometry) {
        return;
      }
      const isBikeLane = way.kind === 'bike_lane';
      const isParking = way.kind === 'parking';
      const isLoadingZone = way.subkind === 'loading_zone';
      const isSteps = way.subkind === 'steps';
      const surfaceY = isSteps
        ? 0.058
        : getStreetDesignOsmFeatureRenderY(way, isParking ? 0.06 : 0.058);
      const elevationRampSegments = elevationRampsByFeatureId.get(way.id);
      const flatGeometry =
        !isSteps && hasElevationRampSegments(elevationRampSegments)
          ? getElevationRampPlateauGeometry(geometry, elevationRampSegments)
          : geometry;

      if (!isSteps && isElevatedOsmStructure(way)) {
        addInternalBridgeDeck({
          THREE,
          group,
          geometry,
          deckY: surfaceY,
          structureKind: way.structureKind,
          osmWayId: way.id,
          rampSegments: elevationRampSegments,
        });
      }

      if (!isSteps) {
        addElevationRampSegments({
          THREE,
          group,
          segments: elevationRampSegments,
          color: getOsmRampSurfaceColor(way),
        });
      }

      if (flatGeometry) {
        addCorridorMesh({
          THREE,
          group,
          geometry: flatGeometry,
          color: isBikeLane
            ? '#2f8f87'
            : isParking
              ? isLoadingZone
                ? '#9a6b30'
                : '#697482'
              : way.subkind === 'bridleway'
                ? '#9b7a55'
                : '#b9af9f',
          opacity: isParking ? 0.74 : 0.86,
          y: surfaceY,
          osmWayId: way.id,
        });
        addSurfaceTexture({
          THREE,
          group,
          geometry: flatGeometry,
          osmWayId: way.id,
          color: isBikeLane
            ? '#9be8de'
            : isParking
              ? isLoadingZone
                ? '#f59e0b'
                : '#454f59'
              : '#e9dfcf',
          opacity: isBikeLane ? 0.24 : isParking ? 0.18 : 0.3,
          y: surfaceY + 0.044,
        });
        addCorridorEdgeStrips({
          THREE,
          group,
          geometry: flatGeometry,
          osmWayId: way.id,
          color: isBikeLane ? '#c7fff5' : isParking ? '#d9e2ef' : '#d4c6b5',
          opacity: isParking ? 0.38 : 0.45,
          y: surfaceY + 0.052,
        });
      }
      if (isParking && flatGeometry) {
        addParkingMarkings({
          THREE,
          group,
          geometry: flatGeometry,
          osmWayId: way.id,
          y: surfaceY + 0.058,
        });
      }
      if (isSteps) {
        addStairTreads({
          THREE,
          group,
          geometry,
          osmWayId: way.id,
          y: surfaceY + 0.066,
          endY: getStreetDesignOsmFeatureRenderY(way, 0.8),
          stepCount: way.stepCount,
          incline: way.incline,
        });
      }
      addPickPolygon({
        THREE,
        group,
        points: geometry.polygon,
        osmWayId: way.id,
        y: Math.max(surfaceY, getStreetDesignOsmFeatureRenderY(way, surfaceY)) + 0.18,
      });
      if (isSelected) {
        addCorridorOutline({
          THREE,
          group,
          geometry,
          color: '#facc15',
          y: Math.max(surfaceY, getStreetDesignOsmFeatureRenderY(way, surfaceY)) + 0.2,
          osmWayId: way.id,
        });
      }
      return;
    }

    if (way.kind === 'building') {
      if (localPoints.length < 3) {
        return;
      }
      const height = Math.max(way.height ?? 8, 3);
      const buildingColor = way.renderColor ?? '#b6aa9b';
      addExtrudedPolygon({
        THREE,
        group,
        points: localPoints,
        height,
        color: buildingColor,
        osmWayId: way.id,
      });
      addBuildingFacadeDetails({
        THREE,
        group,
        points: localPoints,
        height,
        color: buildingColor,
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

    if (way.kind === 'water' && way.geometryKind === 'line') {
      const geometry = createOsmCorridorGeometry(localPoints, way.widthMeters ?? 4);
      if (!geometry) {
        return;
      }
      const waterY = getStreetDesignOsmWaterRenderY(way);

      addWaterSurface({
        THREE,
        group,
        geometry,
        opacity: way.subkind === 'intermittent' ? 0.34 : 0.58,
        y: waterY,
        osmWayId: way.id,
      });
      addWaterDetails({
        THREE,
        group,
        geometry,
        osmWayId: way.id,
        animatedObjects,
        y: waterY + 0.05,
      });
      addPickPolygon({
        THREE,
        group,
        points: geometry.polygon,
        osmWayId: way.id,
        y: waterY + 0.12,
      });
      if (isSelected) {
        addCorridorOutline({
          THREE,
          group,
          geometry,
          color: '#facc15',
          y: waterY + 0.18,
          osmWayId: way.id,
        });
      }
      return;
    }

    if (localPoints.length < 3) {
      return;
    }

    if (way.kind === 'water') {
      const waterY = getStreetDesignOsmWaterRenderY(way);
      if (way.subkind === 'wetland') {
        addFlatPolygon({
          THREE,
          group,
          points: localPoints,
          color: '#4f8f83',
          opacity: 0.46,
          y: waterY,
          osmWayId: way.id,
        });
        if (localPoints.length >= 3) {
          const roughGeometry = createCorridorGeometry(
            localPoints[0] ?? { x: 0, z: 0 },
            localPoints[1] ?? { x: 1, z: 0 },
            1.4
          );
          addGrassDetails({
            THREE,
            group,
            geometry: { ...roughGeometry, polygon: localPoints, width: 2.4 },
            osmWayId: way.id,
            animatedObjects,
            y: waterY + 0.024,
          });
        }
      } else {
        addWaterSurface({
          THREE,
          group,
          geometry: { polygon: localPoints },
          opacity: way.subkind === 'intermittent' ? 0.36 : 0.62,
          y: waterY,
          osmWayId: way.id,
        });
        if (way.subkind === 'intermittent') {
          addPolygonOutline({
            THREE,
            group,
            points: localPoints,
            color: '#bfdbfe',
            y: waterY + 0.08,
            osmWayId: way.id,
          });
        }
      }
    } else {
      const greenColor =
        way.renderColor ??
        (way.subkind === 'scrub'
          ? '#5c8f46'
          : way.subkind === 'heath'
            ? '#8b7d57'
            : way.subkind === 'flower_bed'
              ? '#c95f8a'
              : way.subkind === 'orchard' || way.subkind === 'vineyard'
                ? '#6d8f48'
                : '#89a96b');
      addFlatPolygon({
        THREE,
        group,
        points: localPoints,
        color: greenColor,
        opacity: 0.56,
        y: 0.004,
        osmWayId: way.id,
      });
      if (localPoints.length >= 3) {
        const firstPoint = localPoints[0] ?? { x: 0, z: 0 };
        const secondPoint = localPoints[1] ?? firstPoint;
        const roughGeometry = createCorridorGeometry(firstPoint, secondPoint, 1);
        const detailGeometry = {
          ...roughGeometry,
          polygon: localPoints,
          width: Math.max(2, roughGeometry.width),
        };
        if (way.subkind === 'flower_bed') {
          addFlowerBedDetails({
            THREE,
            group,
            geometry: detailGeometry,
            osmWayId: way.id,
            animatedObjects,
            y: 0.018,
          });
        } else {
          addGrassDetails({
            THREE,
            group,
            geometry: detailGeometry,
            osmWayId: way.id,
            animatedObjects,
            y: 0.018,
          });
        }
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

function disposeObjectTree(object: Object3D) {
  object.traverse(child => {
    const disposableChild = child as {
      geometry?: { dispose?: () => void };
      material?: ThreeMaterial | ThreeMaterial[];
    };

    disposableChild.geometry?.dispose?.();
    const material = disposableChild.material;
    if (Array.isArray(material)) {
      material.forEach(item => item.dispose());
    } else {
      material?.dispose();
    }
  });
}

function clearSceneGroup(group: Group) {
  group.children.slice().forEach(child => {
    group.remove(child);
    disposeObjectTree(child);
  });
}

function createSceneGroups(THREE: ThreeModule, scene: import('three').Scene) {
  const originalGroup = new THREE.Group();
  const designGroup = new THREE.Group();
  const originalLayerGroup = new THREE.Group();
  const designObjectLayerGroup = new THREE.Group();
  const changeRequestLayerGroup = new THREE.Group();
  const selectionLayerGroup = new THREE.Group();
  const placementLayerGroup = new THREE.Group();

  originalGroup.add(originalLayerGroup);
  designGroup.add(
    designObjectLayerGroup,
    changeRequestLayerGroup,
    selectionLayerGroup,
    placementLayerGroup
  );
  scene.add(originalGroup, designGroup);
  return {
    originalGroup,
    designGroup,
    originalLayerGroup,
    designObjectLayerGroup,
    changeRequestLayerGroup,
    selectionLayerGroup,
    placementLayerGroup,
  };
}

export async function mountStreetDesignScene(
  initialOptions: StreetDesignSceneMountOptions
): Promise<StreetDesignSceneController> {
  const THREE = await import('three');
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
  let options = { ...initialOptions };
  const canvas = initialOptions.canvas;
  type ThreeMouseAction = (typeof THREE.MOUSE)[keyof typeof THREE.MOUSE];
  type ThreeTouchAction = (typeof THREE.TOUCH)[keyof typeof THREE.TOUCH];
  const noMouseAction = -1 as ThreeMouseAction;
  const noTouchAction = -1 as ThreeTouchAction;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.setClearColor(0x06110d, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

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
  controls.enableRotate = true;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
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
    LEFT: options.interactionMode === 'camera' ? THREE.MOUSE.PAN : noMouseAction,
    MIDDLE: THREE.MOUSE.PAN,
    RIGHT: THREE.MOUSE.ROTATE,
  };
  controls.touches = {
    ONE: options.interactionMode === 'camera' ? THREE.TOUCH.PAN : noTouchAction,
    TWO: THREE.TOUCH.DOLLY_PAN,
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

  let layers = getStreetDesignComparisonLayers(options.design.comparisonMode);
  const {
    originalGroup,
    designGroup,
    originalLayerGroup,
    designObjectLayerGroup,
    changeRequestLayerGroup,
    selectionLayerGroup,
    placementLayerGroup,
  } = createSceneGroups(THREE, scene);
  const animatedObjects: Object3D[] = [];
  const originalAnimatedObjects: Object3D[] = [];
  const designAnimatedObjects: Object3D[] = [];
  let requestRender: () => void = () => undefined;
  let focusAnimation: {
    startedAt: number;
    durationMs: number;
    startTarget: import('three').Vector3;
    startPosition: import('three').Vector3;
    endTarget: import('three').Vector3;
    endPosition: import('three').Vector3;
  } | null = null;

  function syncAnimatedObjects() {
    animatedObjects.length = 0;
    animatedObjects.push(...originalAnimatedObjects, ...designAnimatedObjects);
  }

  function updateLayerLayout() {
    layers = getStreetDesignComparisonLayers(options.design.comparisonMode);
    originalGroup.visible = layers.showOriginal;
    designGroup.visible = layers.showDesign;
    originalGroup.position.x = getStreetDesignComparisonLayerOffsetX(
      options.design.comparisonMode,
      'original'
    );
    designGroup.position.x = getStreetDesignComparisonLayerOffsetX(
      options.design.comparisonMode,
      'design'
    );
  }

  function getVisibleDesignObjects() {
    const hiddenObjectIds = new Set(options.hiddenObjectIds);
    const hiddenObjectCategories = new Set(options.hiddenObjectCategories);
    return options.design.objects.filter(object =>
      isObjectVisible(object, hiddenObjectIds, hiddenObjectCategories)
    );
  }

  function mergeSceneOptions(partialOptions: Partial<StreetDesignSceneMountOptions>) {
    options = { ...options, ...partialOptions };
    updateLayerLayout();
  }

  function rebuildOriginalLayer() {
    clearSceneGroup(originalLayerGroup);
    originalAnimatedObjects.length = 0;
    if (layers.showOriginal) {
      addOsmWays({
        THREE,
        group: originalLayerGroup,
        design: options.design,
        selectedOsmWayId: options.selectedOsmWayId,
        animatedObjects: originalAnimatedObjects,
      });
      const neutral = new THREE.Color('#9aa0a3');
      forEachObjectMaterial(originalLayerGroup, material => {
        const styled = material as ThreeMaterial & {
          color?: import('three').Color;
          emissive?: import('three').Color;
          opacity?: number;
          transparent?: boolean;
          depthWrite?: boolean;
        };
        if (styled.opacity != null && styled.opacity <= 0.02) return;
        const isSelection = styled.color?.getHexString() === 'facc15';
        if (!isSelection && styled.color) styled.color.lerp(neutral, 0.55);
        if (!isSelection && styled.emissive) styled.emissive.multiplyScalar(0.35);
        if (!isSelection) {
          styled.opacity = Math.min(styled.opacity ?? 1, 0.75);
          styled.transparent = true;
          styled.depthWrite = false;
        }
      });
    }
    syncAnimatedObjects();
    requestRender();
  }

  function rebuildDesignLayer() {
    clearSceneGroup(designObjectLayerGroup);
    designAnimatedObjects.length = 0;
    if (layers.showDesign) {
      const designOpacity = layers.showOverlay ? 0.72 : 1;
      getVisibleDesignObjects().forEach(object => {
        addDesignObject({
          THREE,
          group: designObjectLayerGroup,
          object,
          selected: object.id === options.selectedObjectId,
          showStreetMarkings: options.design.showStreetMarkings ?? true,
          animatedObjects: designAnimatedObjects,
          opacity: designOpacity,
          y: layers.showOverlay ? 0.08 : 0.05,
        });
      });
    }
    syncAnimatedObjects();
    requestRender();
  }

  function rebuildChangeRequestLayer() {
    clearSceneGroup(changeRequestLayerGroup);
    if (layers.showDesign) {
      getStreetDesignChangeRequestOverlayObjects(options.changeRequests).forEach(overlay => {
        addChangeRequestOverlayObject({
          THREE,
          group: changeRequestLayerGroup,
          overlay,
          selected: overlay.changeRequestId === options.selectedChangeRequestId,
          colorMode: options.changeRequestColorMode ?? 'natural',
        });
      });
    }
    requestRender();
  }

  function rebuildSelectionLayer() {
    clearSceneGroup(selectionLayerGroup);
    if (!layers.showDesign || options.interactionMode !== 'select' || options.readOnly) {
      requestRender();
      return;
    }

    const selectedObject = getVisibleDesignObjects().find(
      object => object.id === options.selectedObjectId
    );
    if (selectedObject) {
      addRotateHandle({ THREE, group: selectionLayerGroup, object: selectedObject });
    }
    requestRender();
  }

  function rebuildPlacementLayer() {
    clearSceneGroup(placementLayerGroup);
    if (options.placementStart) {
      addPlacementStartMarker({
        THREE,
        group: placementLayerGroup,
        point: options.placementStart,
      });
    }

    if (options.placementPreview) {
      const previewColor = options.placementPreviewType
        ? getStreetDesignObjectDefinition(options.placementPreviewType).color
        : '#facc15';

      addCorridorMesh({
        THREE,
        group: placementLayerGroup,
        geometry: options.placementPreview,
        color: previewColor,
        opacity: 0.45,
        y: 0.12,
      });
      addCorridorOutline({
        THREE,
        group: placementLayerGroup,
        geometry: options.placementPreview,
        color: '#facc15',
        y: 0.18,
      });
    }
    requestRender();
  }

  function startFocusAnimation(focusObjectId: string | null, focusOsmWayId: string | null) {
    const selectedObjectFocus = getObjectFocusPoint(options.design, focusObjectId);
    const selectedOsmFocusPoint = getOsmWayFocusPoint(options.design, focusOsmWayId);
    const focusPoint = selectedObjectFocus?.center ?? selectedOsmFocusPoint;
    const focusGroup = selectedObjectFocus ? designGroup : originalGroup;
    if (!focusPoint) return;

    const focusDistance = selectedObjectFocus
      ? Math.max(36, Math.min(92, selectedObjectFocus.radius * 4 + 34))
      : 62;
    const focusHeight = selectedObjectFocus
      ? Math.max(camera.position.y, Math.min(74, selectedObjectFocus.radius * 2.2 + 40))
      : Math.max(camera.position.y, 52);

    focusAnimation = {
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
    };
    requestRender();
  }

  function hasOsmRenderInputsChanged(
    previousOptions: StreetDesignSceneMountOptions,
    nextOptions: StreetDesignSceneMountOptions
  ) {
    return (
      previousOptions.design.osmSnapshot !== nextOptions.design.osmSnapshot ||
      previousOptions.design.origin !== nextOptions.design.origin ||
      previousOptions.design.osmLayerVisibility !== nextOptions.design.osmLayerVisibility ||
      previousOptions.design.hiddenOsmWayIds !== nextOptions.design.hiddenOsmWayIds ||
      previousOptions.design.hiddenOsmFeatureIds !== nextOptions.design.hiddenOsmFeatureIds ||
      previousOptions.design.comparisonMode !== nextOptions.design.comparisonMode ||
      previousOptions.design.showStreetMarkings !== nextOptions.design.showStreetMarkings ||
      previousOptions.selectedOsmWayId !== nextOptions.selectedOsmWayId
    );
  }

  function hasDesignRenderInputsChanged(
    previousOptions: StreetDesignSceneMountOptions,
    nextOptions: StreetDesignSceneMountOptions
  ) {
    return (
      previousOptions.design.objects !== nextOptions.design.objects ||
      previousOptions.design.showStreetMarkings !== nextOptions.design.showStreetMarkings ||
      previousOptions.design.comparisonMode !== nextOptions.design.comparisonMode ||
      previousOptions.hiddenObjectIds !== nextOptions.hiddenObjectIds ||
      previousOptions.hiddenObjectCategories !== nextOptions.hiddenObjectCategories ||
      previousOptions.selectedObjectId !== nextOptions.selectedObjectId
    );
  }

  function syncControlsForInteractionMode() {
    controls.mouseButtons.LEFT =
      options.interactionMode === 'camera' ? THREE.MOUSE.PAN : noMouseAction;
    controls.touches.ONE = options.interactionMode === 'camera' ? THREE.TOUCH.PAN : noTouchAction;
  }

  updateLayerLayout();
  rebuildOriginalLayer();
  rebuildDesignLayer();
  rebuildChangeRequestLayer();
  rebuildSelectionLayer();
  rebuildPlacementLayer();
  startFocusAnimation(options.focusObjectId, options.focusOsmWayId);

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
  const activeTouchPointers = new Map<number, { x: number; y: number }>();
  let pendingTouchAction: {
    pointerId: number;
    action: 'select' | 'place';
    startX: number;
    startY: number;
    moved: boolean;
    suppressed: boolean;
  } | null = null;
  let isSpacePressed = false;

  function getPointerAction(
    event: PointerEvent,
    overrides: { isObjectRotateHandle?: boolean } = {}
  ) {
    return getStreetDesignPointerAction({
      mode: options.interactionMode,
      button: event.button,
      pointerType: event.pointerType,
      isSpacePressed,
      shiftKey: event.shiftKey,
      touchPointCount: event.pointerType === 'touch' ? activeTouchPointers.size : undefined,
      isObjectRotateHandle: overrides.isObjectRotateHandle,
      readOnly: options.readOnly,
    });
  }

  function setPrimaryPointerNavigationControls(action: StreetDesignInputAction) {
    controls.mouseButtons.LEFT =
      action === 'move' || action === 'turn'
        ? THREE.MOUSE.PAN
        : options.interactionMode === 'camera'
          ? THREE.MOUSE.PAN
          : noMouseAction;
  }

  function isNavigationPointerMove(event: PointerEvent) {
    if (event.pointerType === 'touch') return activeTouchPointers.size >= 2;
    if (isSpacePressed) return true;
    if (event.shiftKey && (event.buttons & 1) === 1) return true;
    return (event.buttons & 2) === 2 || (event.buttons & 4) === 4;
  }

  function getHorizontalCameraAxes() {
    const forward = controls.target.clone().sub(camera.position);
    forward.y = 0;
    if (forward.lengthSq() < 0.0001) {
      forward.set(0, 0, -1);
    } else {
      forward.normalize();
    }

    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    return { forward, right };
  }

  function applyCameraPan(deltaRight: number, deltaForward: number) {
    const { forward, right } = getHorizontalCameraAxes();
    const move = right.multiplyScalar(deltaRight).add(forward.multiplyScalar(deltaForward));
    camera.position.add(move);
    controls.target.add(move);
    controls.update();
    requestRender();
  }

  function applyCameraZoom(direction: 'in' | 'out') {
    const offset = camera.position.clone().sub(controls.target);
    const distance = offset.length();
    if (distance < 0.0001) return;

    const nextDistance = Math.min(
      controls.maxDistance,
      Math.max(controls.minDistance, distance * (direction === 'in' ? 0.86 : 1.16))
    );
    camera.position.copy(controls.target).add(offset.normalize().multiplyScalar(nextDistance));
    controls.update();
    requestRender();
  }

  function applyCameraTurn(direction: 'left' | 'right') {
    const offset = camera.position.clone().sub(controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), direction === 'left' ? 0.12 : -0.12);
    camera.position.copy(controls.target).add(offset);
    camera.lookAt(controls.target);
    controls.update();
    requestRender();
  }

  function getKeyboardPanStep() {
    return Math.max(2, camera.position.distanceTo(controls.target) * 0.055);
  }

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const targetWidth = Math.floor(width * renderer.getPixelRatio());
    const targetHeight = Math.floor(height * renderer.getPixelRatio());

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      renderer.setSize(width, height, false);
      camera.aspect = Math.max(width / Math.max(height, 1), 1);
      camera.updateProjectionMatrix();
      return true;
    }

    return false;
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

  function getPointerLayer(point: StreetDesignLocalPoint): StreetDesignComparisonLayer {
    return getStreetDesignPointerLayer(options.design.comparisonMode, point.x);
  }

  function toLayerPoint(
    point: StreetDesignLocalPoint,
    layer: StreetDesignComparisonLayer
  ): StreetDesignLocalPoint {
    return normalizeStreetDesignPointerPoint(point, options.design.comparisonMode, layer);
  }

  function handlePlacePointerDown(event: PointerEvent) {
    const point = updatePointer(event);

    if (!options.readOnly) {
      options.onPointerDown(toDesignPoint(point));
    }
  }

  function getPointerHitContext(event: PointerEvent) {
    const point = updatePointer(event);
    const designIntersections = raycaster.intersectObjects(designGroup.children, true);
    return { point, designIntersections };
  }

  function getRotateObjectIdAtPointer(event: PointerEvent) {
    const { designIntersections } = getPointerHitContext(event);
    return getIntersectionUserDataValue(designIntersections, 'rotateHandleObjectId');
  }

  function startObjectRotateDrag(event: PointerEvent, rotateObjectId: string) {
    if (options.readOnly) return false;
    const object = options.design.objects.find(item => item.id === rotateObjectId);
    if (!object) return false;

    activeRotateDrag = {
      objectId: rotateObjectId,
      center: getObjectCenter(object),
    };
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    return true;
  }

  function handleSelectPointerDown(event: PointerEvent) {
    const { point, designIntersections } = getPointerHitContext(event);
    const rotateObjectId = getIntersectionUserDataValue(
      designIntersections,
      'rotateHandleObjectId'
    );

    if (rotateObjectId && startObjectRotateDrag(event, rotateObjectId)) {
      return;
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

  function handlePointerDownCapture(event: PointerEvent) {
    if (event.pointerType === 'touch') {
      activeTouchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    const action = getPointerAction(event);
    setPrimaryPointerNavigationControls(action);

    if (event.pointerType === 'touch' && activeTouchPointers.size >= 2 && pendingTouchAction) {
      pendingTouchAction.suppressed = true;
    }
  }

  function handlePointerDown(event: PointerEvent) {
    const rotateObjectId =
      options.interactionMode === 'select' ? getRotateObjectIdAtPointer(event) : undefined;
    const action = getPointerAction(event, {
      isObjectRotateHandle: Boolean(rotateObjectId),
    });

    if (action === 'move' || action === 'turn' || action === 'zoom' || action === 'none') {
      return;
    }

    if (event.pointerType === 'touch') {
      if (action === 'objectRotate' && rotateObjectId) {
        startObjectRotateDrag(event, rotateObjectId);
        return;
      }

      if (action === 'select' || action === 'place') {
        pendingTouchAction = {
          pointerId: event.pointerId,
          action,
          startX: event.clientX,
          startY: event.clientY,
          moved: false,
          suppressed: activeTouchPointers.size >= 2,
        };
      }
      return;
    }

    if (action === 'place') {
      handlePlacePointerDown(event);
      return;
    }

    handleSelectPointerDown(event);
  }

  function updatePendingTouchMove(event: PointerEvent) {
    if (event.pointerType !== 'touch') return;

    activeTouchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!pendingTouchAction || pendingTouchAction.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - pendingTouchAction.startX;
    const deltaY = event.clientY - pendingTouchAction.startY;
    if (deltaX * deltaX + deltaY * deltaY > 64) {
      pendingTouchAction.moved = true;
    }
    if (activeTouchPointers.size >= 2) {
      pendingTouchAction.suppressed = true;
    }
  }

  function handlePointerMove(event: PointerEvent) {
    updatePendingTouchMove(event);

    if (event.pointerType !== 'touch') {
      const hoverPoint = updatePointer(event);
      const hoverLayer = getPointerLayer(hoverPoint);
      options.onPointerHover(toLayerPoint(hoverPoint, hoverLayer), hoverLayer);
    }

    if (
      !options.readOnly &&
      options.interactionMode === 'place' &&
      !isNavigationPointerMove(event)
    ) {
      const point = updatePointer(event);
      options.onPointerMove(toDesignPoint(point));
    }
  }

  function handlePointerLeave(event: PointerEvent) {
    if (event.pointerType !== 'touch') {
      options.onPointerHover(null, 'design');
    }
  }

  function finishPendingTouchAction(event: PointerEvent) {
    if (
      event.pointerType !== 'touch' ||
      !pendingTouchAction ||
      pendingTouchAction.pointerId !== event.pointerId
    ) {
      return false;
    }

    const action = pendingTouchAction;
    pendingTouchAction = null;
    if (action.moved || action.suppressed || activeTouchPointers.size >= 2) {
      return true;
    }

    if (action.action === 'place') {
      handlePlacePointerDown(event);
    } else {
      handleSelectPointerDown(event);
    }
    return true;
  }

  function finishRotateDrag(event: PointerEvent) {
    if (!activeRotateDrag) return false;

    const point = toDesignPoint(updatePointer(event));
    const rotationDeg =
      (Math.atan2(point.x - activeRotateDrag.center.x, point.z - activeRotateDrag.center.z) * 180) /
      Math.PI;
    options.onObjectRotate(activeRotateDrag.objectId, rotationDeg);
    activeRotateDrag = null;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    return true;
  }

  function handlePointerUp(event: PointerEvent) {
    finishRotateDrag(event);
    finishPendingTouchAction(event);

    if (event.pointerType === 'touch') {
      activeTouchPointers.delete(event.pointerId);
      if (activeTouchPointers.size === 0) {
        pendingTouchAction = null;
      }
    }
  }

  function handlePointerCancel(event: PointerEvent) {
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    if (event.pointerType === 'touch') {
      activeTouchPointers.delete(event.pointerId);
      if (pendingTouchAction?.pointerId === event.pointerId || activeTouchPointers.size === 0) {
        pendingTouchAction = null;
      }
    }
    if (event.pointerType !== 'touch') {
      options.onPointerHover(null, 'design');
    }
    activeRotateDrag = null;
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
  }

  function isEditableKeyboardTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;

    return Boolean(
      target.closest('input, textarea, select, button, [contenteditable="true"], [role="textbox"]')
    );
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.defaultPrevented || isEditableKeyboardTarget(event.target)) return;

    if (event.code === 'Space') {
      isSpacePressed = true;
      event.preventDefault();
      return;
    }

    const action = getStreetDesignKeyboardAction(event.key);
    if (action === 'none') return;

    event.preventDefault();
    const panStep = getKeyboardPanStep();
    if (action === 'move') {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        applyCameraPan(-panStep, 0);
      } else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        applyCameraPan(panStep, 0);
      } else if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') {
        applyCameraPan(0, panStep);
      } else if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') {
        applyCameraPan(0, -panStep);
      }
      return;
    }

    if (action === 'zoom') {
      applyCameraZoom(event.key === '-' ? 'out' : 'in');
      return;
    }

    if (action === 'turn') {
      applyCameraTurn(event.key.toLowerCase() === 'q' ? 'left' : 'right');
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    if (event.code === 'Space') {
      isSpacePressed = false;
      setPrimaryPointerNavigationControls(options.interactionMode === 'camera' ? 'move' : 'none');
    }
  }

  function handleWindowBlur() {
    isSpacePressed = false;
    setPrimaryPointerNavigationControls(options.interactionMode === 'camera' ? 'move' : 'none');
    options.onPointerHover(null, 'design');
  }

  function updateAmbientAnimations(elapsedSeconds: number) {
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
  }

  function getCameraPoseSignature() {
    return [
      camera.position.x,
      camera.position.y,
      camera.position.z,
      controls.target.x,
      controls.target.y,
      controls.target.z,
    ]
      .map(value => value.toFixed(3))
      .join(':');
  }

  let lastCameraPoseSignature: string | null = null;
  function emitCameraPoseChangeIfNeeded() {
    const signature = getCameraPoseSignature();
    if (signature === lastCameraPoseSignature) return;

    lastCameraPoseSignature = signature;
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
  }

  const renderScheduler = createStreetDesignRenderScheduler(() => {
    resize();
    let isFocusAnimationActive = false;
    const activeFocusAnimation = focusAnimation;

    if (activeFocusAnimation) {
      const progress = Math.min(
        (performance.now() - activeFocusAnimation.startedAt) / activeFocusAnimation.durationMs,
        1
      );
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      controls.target.lerpVectors(
        activeFocusAnimation.startTarget,
        activeFocusAnimation.endTarget,
        easedProgress
      );
      camera.position.lerpVectors(
        activeFocusAnimation.startPosition,
        activeFocusAnimation.endPosition,
        easedProgress
      );
      isFocusAnimationActive = progress < 1;
      if (!isFocusAnimationActive) {
        focusAnimation = null;
      }
    }

    if (isFocusAnimationActive) {
      updateAmbientAnimations(performance.now() / 1000);
    }

    const controlsChanged = controls.update();
    renderer.render(scene, camera);
    emitCameraPoseChangeIfNeeded();

    if (isFocusAnimationActive || controlsChanged) {
      renderScheduler.requestRender();
    }
  });

  requestRender = () => renderScheduler.requestRender();
  const handleControlsChange = () => requestRender();
  const handleWindowResize = () => requestRender();
  const resizeObserver =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => requestRender());

  canvas.addEventListener('pointerdown', handlePointerDownCapture, true);
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerleave', handlePointerLeave);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', handlePointerCancel);
  canvas.addEventListener('contextmenu', handleContextMenu);
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
  controls.addEventListener('change', handleControlsChange);
  resizeObserver?.observe(canvas);
  window.addEventListener('resize', handleWindowResize);
  window.addEventListener('blur', handleWindowBlur);
  requestRender();

  function dispose() {
    options.onPointerHover(null, 'design');
    renderScheduler.dispose();
    controls.removeEventListener('change', handleControlsChange);
    resizeObserver?.disconnect();
    window.removeEventListener('resize', handleWindowResize);
    window.removeEventListener('blur', handleWindowBlur);
    canvas.removeEventListener('pointerdown', handlePointerDownCapture, true);
    canvas.removeEventListener('pointerdown', handlePointerDown);
    canvas.removeEventListener('pointermove', handlePointerMove);
    canvas.removeEventListener('pointerleave', handlePointerLeave);
    canvas.removeEventListener('pointerup', handlePointerUp);
    canvas.removeEventListener('pointercancel', handlePointerCancel);
    canvas.removeEventListener('contextmenu', handleContextMenu);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    clearSceneGroup(originalGroup);
    clearSceneGroup(designGroup);
    controls.dispose();
    renderer.dispose();
  }

  return {
    updateDesign(nextOptions) {
      const previousOptions = options;
      mergeSceneOptions(nextOptions);
      if (hasOsmRenderInputsChanged(previousOptions, options)) {
        rebuildOriginalLayer();
      }
      if (hasDesignRenderInputsChanged(previousOptions, options)) {
        rebuildDesignLayer();
      }
      if (previousOptions.design.comparisonMode !== options.design.comparisonMode) {
        rebuildChangeRequestLayer();
      }
      rebuildSelectionLayer();
      requestRender();
    },
    updateSelection(nextOptions) {
      const previousOptions = options;
      mergeSceneOptions(nextOptions);
      if (previousOptions.selectedOsmWayId !== options.selectedOsmWayId) {
        rebuildOriginalLayer();
      }
      if (previousOptions.selectedObjectId !== options.selectedObjectId) {
        rebuildDesignLayer();
      }
      if (previousOptions.selectedChangeRequestId !== options.selectedChangeRequestId) {
        rebuildChangeRequestLayer();
      }
      rebuildSelectionLayer();
      if (nextOptions.focusObjectId || nextOptions.focusOsmWayId) {
        startFocusAnimation(nextOptions.focusObjectId, nextOptions.focusOsmWayId);
      }
      requestRender();
    },
    updatePlacementPreview(nextOptions) {
      mergeSceneOptions(nextOptions);
      rebuildPlacementLayer();
    },
    updateChangeRequests(nextOptions) {
      mergeSceneOptions(nextOptions);
      rebuildChangeRequestLayer();
    },
    updateInteractionMode(nextOptions) {
      mergeSceneOptions(nextOptions);
      syncControlsForInteractionMode();
      rebuildSelectionLayer();
      requestRender();
    },
    updateHandlers(nextOptions) {
      mergeSceneOptions(nextOptions);
    },
    focusObject(objectId) {
      mergeSceneOptions({ focusObjectId: objectId, focusOsmWayId: null });
      startFocusAnimation(objectId, null);
    },
    focusOsmWay(osmWayId) {
      mergeSceneOptions({ focusObjectId: null, focusOsmWayId: osmWayId });
      startFocusAnimation(null, osmWayId);
    },
    dispose,
  };
}
