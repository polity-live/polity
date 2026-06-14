import type {
  StreetDesignBoundingBox,
  StreetDesignGeoPoint,
  StreetDesignMapSelection,
} from '../types';

export type StreetDesignBboxResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const MIN_STREET_DESIGN_BBOX_SIZE_METERS = 20;
export const MAX_STREET_DESIGN_BBOX_SPAN_DEGREES = 0.0195;

const METERS_PER_LAT_DEGREE = 111_320;

function metersPerLonDegree(lat: number) {
  return Math.max(METERS_PER_LAT_DEGREE * Math.cos((lat * Math.PI) / 180), 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function clampLatitude(lat: number) {
  return clamp(lat, -89.99, 89.99);
}

function clampLongitude(lon: number) {
  return clamp(lon, -179.99, 179.99);
}

function normalizeRotationDeg(rotationDeg: number) {
  if (!Number.isFinite(rotationDeg)) return 0;
  const normalized = rotationDeg % 360;
  return Math.round((normalized < 0 ? normalized + 360 : normalized) * 10) / 10;
}

function roundMeter(value: number) {
  return Math.round(value);
}

function clampAndRoundMeter(value: number, min: number, max: number) {
  const safeMax = Math.max(min, Math.floor(max));
  const rounded = roundMeter(clamp(value, min, max));
  return clamp(rounded, min, safeMax);
}

export function getStreetDesignBboxCenter(bbox: StreetDesignBoundingBox): StreetDesignGeoPoint {
  return {
    lat: (bbox.south + bbox.north) / 2,
    lon: (bbox.west + bbox.east) / 2,
  };
}

export function getStreetDesignMapSelectionDimensions(selection: StreetDesignMapSelection) {
  return {
    widthMeters: roundMeter(selection.widthMeters),
    heightMeters: roundMeter(selection.heightMeters),
    rotationDeg: normalizeRotationDeg(selection.rotationDeg),
  };
}

export function getStreetDesignBboxDimensionsMeters(bbox: StreetDesignBoundingBox) {
  const center = getStreetDesignBboxCenter(bbox);

  return {
    widthMeters: Math.round((bbox.east - bbox.west) * metersPerLonDegree(center.lat)),
    heightMeters: Math.round((bbox.north - bbox.south) * METERS_PER_LAT_DEGREE),
  };
}

export function createStreetDesignMapSelection(args: {
  center: StreetDesignGeoPoint;
  widthMeters: number;
  heightMeters: number;
  rotationDeg?: number;
}): StreetDesignMapSelection {
  const maxWidthMeters = MAX_STREET_DESIGN_BBOX_SPAN_DEGREES * metersPerLonDegree(args.center.lat);
  const maxHeightMeters = MAX_STREET_DESIGN_BBOX_SPAN_DEGREES * METERS_PER_LAT_DEGREE;

  return {
    center: {
      lat: clampLatitude(args.center.lat),
      lon: clampLongitude(args.center.lon),
    },
    widthMeters: clampAndRoundMeter(
      args.widthMeters,
      MIN_STREET_DESIGN_BBOX_SIZE_METERS,
      maxWidthMeters
    ),
    heightMeters: clampAndRoundMeter(
      args.heightMeters,
      MIN_STREET_DESIGN_BBOX_SIZE_METERS,
      maxHeightMeters
    ),
    rotationDeg: normalizeRotationDeg(args.rotationDeg ?? 0),
  };
}

export function createStreetDesignBboxFromCenter(args: {
  center: StreetDesignGeoPoint;
  widthMeters: number;
  heightMeters: number;
}): StreetDesignBoundingBox {
  return getStreetDesignMapSelectionBoundingBox(
    createStreetDesignMapSelection({
      center: args.center,
      widthMeters: args.widthMeters,
      heightMeters: args.heightMeters,
    })
  );
}

export function createStreetDesignMapSelectionFromBbox(
  bbox: StreetDesignBoundingBox,
  rotationDeg = 0
): StreetDesignMapSelection {
  const center = getStreetDesignBboxCenter(bbox);
  const dimensions = getStreetDesignBboxDimensionsMeters(bbox);

  return createStreetDesignMapSelection({
    center,
    widthMeters: dimensions.widthMeters,
    heightMeters: dimensions.heightMeters,
    rotationDeg,
  });
}

export function createStreetDesignBboxFromCenterRadius(
  center: StreetDesignGeoPoint,
  radiusMeters = 140
) {
  return createStreetDesignBboxFromCenter({
    center,
    widthMeters: radiusMeters * 2,
    heightMeters: radiusMeters * 2,
  });
}

export function createStreetDesignMapSelectionFromCenterRadius(
  center: StreetDesignGeoPoint,
  radiusMeters = 140
) {
  return createStreetDesignMapSelection({
    center,
    widthMeters: radiusMeters * 2,
    heightMeters: radiusMeters * 2,
  });
}

function geoPointToSelectionMeters(point: StreetDesignGeoPoint, center: StreetDesignGeoPoint) {
  return {
    x: (point.lon - center.lon) * metersPerLonDegree(center.lat),
    y: (point.lat - center.lat) * METERS_PER_LAT_DEGREE,
  };
}

function selectionMetersToGeoPoint(
  center: StreetDesignGeoPoint,
  point: { x: number; y: number }
): StreetDesignGeoPoint {
  return {
    lat: clampLatitude(center.lat + point.y / METERS_PER_LAT_DEGREE),
    lon: clampLongitude(center.lon + point.x / metersPerLonDegree(center.lat)),
  };
}

function rotateMeters(point: { x: number; y: number }, rotationDeg: number) {
  const radians = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function unrotateMeters(point: { x: number; y: number }, rotationDeg: number) {
  return rotateMeters(point, -rotationDeg);
}

export function getStreetDesignMapSelectionCorners(selection: StreetDesignMapSelection) {
  const halfWidth = selection.widthMeters / 2;
  const halfHeight = selection.heightMeters / 2;
  const localCorners = [
    { x: -halfWidth, y: halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: -halfWidth, y: -halfHeight },
  ];

  return localCorners.map(point =>
    selectionMetersToGeoPoint(selection.center, rotateMeters(point, selection.rotationDeg))
  );
}

export function getStreetDesignMapSelectionBoundingBox(selection: StreetDesignMapSelection) {
  const corners = getStreetDesignMapSelectionCorners(selection);
  const lats = corners.map(point => point.lat);
  const lons = corners.map(point => point.lon);

  return {
    south: Math.min(...lats),
    west: Math.min(...lons),
    north: Math.max(...lats),
    east: Math.max(...lons),
  };
}

export function moveStreetDesignBboxToCenter(
  bbox: StreetDesignBoundingBox,
  center: StreetDesignGeoPoint
) {
  const dimensions = getStreetDesignBboxDimensionsMeters(bbox);
  return createStreetDesignBboxFromCenter({
    center,
    widthMeters: dimensions.widthMeters,
    heightMeters: dimensions.heightMeters,
  });
}

export function moveStreetDesignMapSelectionToCenter(
  selection: StreetDesignMapSelection,
  center: StreetDesignGeoPoint
) {
  return createStreetDesignMapSelection({
    ...selection,
    center,
  });
}

export function resizeStreetDesignBboxMeters(args: {
  bbox: StreetDesignBoundingBox;
  widthMeters: number;
  heightMeters: number;
}) {
  return createStreetDesignBboxFromCenter({
    center: getStreetDesignBboxCenter(args.bbox),
    widthMeters: args.widthMeters,
    heightMeters: args.heightMeters,
  });
}

export function resizeStreetDesignMapSelectionMeters(args: {
  selection: StreetDesignMapSelection;
  widthMeters: number;
  heightMeters: number;
}) {
  return createStreetDesignMapSelection({
    ...args.selection,
    widthMeters: args.widthMeters,
    heightMeters: args.heightMeters,
  });
}

export function resizeStreetDesignBboxByHandle(args: {
  bbox: StreetDesignBoundingBox;
  handle: StreetDesignBboxResizeHandle;
  point: StreetDesignGeoPoint;
}) {
  const next = { ...args.bbox };

  if (args.handle.includes('n')) next.north = args.point.lat;
  if (args.handle.includes('s')) next.south = args.point.lat;
  if (args.handle.includes('e')) next.east = args.point.lon;
  if (args.handle.includes('w')) next.west = args.point.lon;

  const south = Math.min(next.south, next.north);
  const north = Math.max(next.south, next.north);
  const west = Math.min(next.west, next.east);
  const east = Math.max(next.west, next.east);
  const center = getStreetDesignBboxCenter({ south, west, north, east });
  const dimensions = getStreetDesignBboxDimensionsMeters({ south, west, north, east });

  return createStreetDesignBboxFromCenter({
    center,
    widthMeters: dimensions.widthMeters,
    heightMeters: dimensions.heightMeters,
  });
}

export function resizeStreetDesignMapSelectionByHandle(args: {
  selection: StreetDesignMapSelection;
  handle: StreetDesignBboxResizeHandle;
  point: StreetDesignGeoPoint;
}) {
  const relativeMeters = geoPointToSelectionMeters(args.point, args.selection.center);
  const local = unrotateMeters(relativeMeters, args.selection.rotationDeg);
  const widthMeters =
    args.handle.includes('e') || args.handle.includes('w')
      ? Math.abs(local.x) * 2
      : args.selection.widthMeters;
  const heightMeters =
    args.handle.includes('n') || args.handle.includes('s')
      ? Math.abs(local.y) * 2
      : args.selection.heightMeters;

  return createStreetDesignMapSelection({
    ...args.selection,
    widthMeters,
    heightMeters,
  });
}

export function rotateStreetDesignMapSelectionToPoint(args: {
  selection: StreetDesignMapSelection;
  point: StreetDesignGeoPoint;
}) {
  const relativeMeters = geoPointToSelectionMeters(args.point, args.selection.center);
  const rotationDeg = (Math.atan2(relativeMeters.y, relativeMeters.x) * 180) / Math.PI - 90;

  return createStreetDesignMapSelection({
    ...args.selection,
    rotationDeg,
  });
}

export function getStreetDesignMapSelectionRotateHandle(selection: StreetDesignMapSelection) {
  const offset = selection.heightMeters / 2 + 30;
  return selectionMetersToGeoPoint(
    selection.center,
    rotateMeters({ x: 0, y: offset }, selection.rotationDeg)
  );
}
