import type { CityDesignBoundingBox, CityDesignGeoPoint, CityDesignMapSelection } from '../types';

export type CityDesignBboxResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const MIN_CITY_DESIGN_BBOX_SIZE_METERS = 20;
export const MAX_CITY_DESIGN_BBOX_SPAN_DEGREES = 0.0195;

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

export function getCityDesignBboxCenter(bbox: CityDesignBoundingBox): CityDesignGeoPoint {
  return {
    lat: (bbox.south + bbox.north) / 2,
    lon: (bbox.west + bbox.east) / 2,
  };
}

export function getCityDesignMapSelectionDimensions(selection: CityDesignMapSelection) {
  return {
    widthMeters: roundMeter(selection.widthMeters),
    heightMeters: roundMeter(selection.heightMeters),
    rotationDeg: normalizeRotationDeg(selection.rotationDeg),
  };
}

export function getCityDesignBboxDimensionsMeters(bbox: CityDesignBoundingBox) {
  const center = getCityDesignBboxCenter(bbox);

  return {
    widthMeters: Math.round((bbox.east - bbox.west) * metersPerLonDegree(center.lat)),
    heightMeters: Math.round((bbox.north - bbox.south) * METERS_PER_LAT_DEGREE),
  };
}

export function createCityDesignMapSelection(args: {
  center: CityDesignGeoPoint;
  widthMeters: number;
  heightMeters: number;
  rotationDeg?: number;
}): CityDesignMapSelection {
  const maxWidthMeters = MAX_CITY_DESIGN_BBOX_SPAN_DEGREES * metersPerLonDegree(args.center.lat);
  const maxHeightMeters = MAX_CITY_DESIGN_BBOX_SPAN_DEGREES * METERS_PER_LAT_DEGREE;

  return {
    center: {
      lat: clampLatitude(args.center.lat),
      lon: clampLongitude(args.center.lon),
    },
    widthMeters: clampAndRoundMeter(
      args.widthMeters,
      MIN_CITY_DESIGN_BBOX_SIZE_METERS,
      maxWidthMeters
    ),
    heightMeters: clampAndRoundMeter(
      args.heightMeters,
      MIN_CITY_DESIGN_BBOX_SIZE_METERS,
      maxHeightMeters
    ),
    rotationDeg: normalizeRotationDeg(args.rotationDeg ?? 0),
  };
}

export function createCityDesignBboxFromCenter(args: {
  center: CityDesignGeoPoint;
  widthMeters: number;
  heightMeters: number;
}): CityDesignBoundingBox {
  return getCityDesignMapSelectionBoundingBox(
    createCityDesignMapSelection({
      center: args.center,
      widthMeters: args.widthMeters,
      heightMeters: args.heightMeters,
    })
  );
}

export function createCityDesignMapSelectionFromBbox(
  bbox: CityDesignBoundingBox,
  rotationDeg = 0
): CityDesignMapSelection {
  const center = getCityDesignBboxCenter(bbox);
  const dimensions = getCityDesignBboxDimensionsMeters(bbox);

  return createCityDesignMapSelection({
    center,
    widthMeters: dimensions.widthMeters,
    heightMeters: dimensions.heightMeters,
    rotationDeg,
  });
}

export function createCityDesignBboxFromCenterRadius(
  center: CityDesignGeoPoint,
  radiusMeters = 140
) {
  return createCityDesignBboxFromCenter({
    center,
    widthMeters: radiusMeters * 2,
    heightMeters: radiusMeters * 2,
  });
}

export function createCityDesignMapSelectionFromCenterRadius(
  center: CityDesignGeoPoint,
  radiusMeters = 140
) {
  return createCityDesignMapSelection({
    center,
    widthMeters: radiusMeters * 2,
    heightMeters: radiusMeters * 2,
  });
}

function geoPointToSelectionMeters(point: CityDesignGeoPoint, center: CityDesignGeoPoint) {
  return {
    x: (point.lon - center.lon) * metersPerLonDegree(center.lat),
    y: (point.lat - center.lat) * METERS_PER_LAT_DEGREE,
  };
}

function selectionMetersToGeoPoint(
  center: CityDesignGeoPoint,
  point: { x: number; y: number }
): CityDesignGeoPoint {
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

export function getCityDesignMapSelectionCorners(selection: CityDesignMapSelection) {
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

export function getCityDesignMapSelectionBoundingBox(selection: CityDesignMapSelection) {
  const corners = getCityDesignMapSelectionCorners(selection);
  const lats = corners.map(point => point.lat);
  const lons = corners.map(point => point.lon);

  return {
    south: Math.min(...lats),
    west: Math.min(...lons),
    north: Math.max(...lats),
    east: Math.max(...lons),
  };
}

export function moveCityDesignBboxToCenter(
  bbox: CityDesignBoundingBox,
  center: CityDesignGeoPoint
) {
  const dimensions = getCityDesignBboxDimensionsMeters(bbox);
  return createCityDesignBboxFromCenter({
    center,
    widthMeters: dimensions.widthMeters,
    heightMeters: dimensions.heightMeters,
  });
}

export function moveCityDesignMapSelectionToCenter(
  selection: CityDesignMapSelection,
  center: CityDesignGeoPoint
) {
  return createCityDesignMapSelection({
    ...selection,
    center,
  });
}

export function resizeCityDesignBboxMeters(args: {
  bbox: CityDesignBoundingBox;
  widthMeters: number;
  heightMeters: number;
}) {
  return createCityDesignBboxFromCenter({
    center: getCityDesignBboxCenter(args.bbox),
    widthMeters: args.widthMeters,
    heightMeters: args.heightMeters,
  });
}

export function resizeCityDesignMapSelectionMeters(args: {
  selection: CityDesignMapSelection;
  widthMeters: number;
  heightMeters: number;
}) {
  return createCityDesignMapSelection({
    ...args.selection,
    widthMeters: args.widthMeters,
    heightMeters: args.heightMeters,
  });
}

export function resizeCityDesignBboxByHandle(args: {
  bbox: CityDesignBoundingBox;
  handle: CityDesignBboxResizeHandle;
  point: CityDesignGeoPoint;
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
  const center = getCityDesignBboxCenter({ south, west, north, east });
  const dimensions = getCityDesignBboxDimensionsMeters({ south, west, north, east });

  return createCityDesignBboxFromCenter({
    center,
    widthMeters: dimensions.widthMeters,
    heightMeters: dimensions.heightMeters,
  });
}

export function resizeCityDesignMapSelectionByHandle(args: {
  selection: CityDesignMapSelection;
  handle: CityDesignBboxResizeHandle;
  point: CityDesignGeoPoint;
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

  return createCityDesignMapSelection({
    ...args.selection,
    widthMeters,
    heightMeters,
  });
}

export function rotateCityDesignMapSelectionToPoint(args: {
  selection: CityDesignMapSelection;
  point: CityDesignGeoPoint;
}) {
  const relativeMeters = geoPointToSelectionMeters(args.point, args.selection.center);
  const rotationDeg = (Math.atan2(relativeMeters.y, relativeMeters.x) * 180) / Math.PI - 90;

  return createCityDesignMapSelection({
    ...args.selection,
    rotationDeg,
  });
}

export function getCityDesignMapSelectionRotateHandle(selection: CityDesignMapSelection) {
  const offset = selection.heightMeters / 2 + 30;
  return selectionMetersToGeoPoint(
    selection.center,
    rotateMeters({ x: 0, y: offset }, selection.rotationDeg)
  );
}
