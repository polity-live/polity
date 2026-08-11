import type {
  CityDesignBoundingBox,
  CityDesignGeoPoint,
  CityDesignMapSelection,
  CityDesignOsmSnapshot,
} from '@/features/amendments/city-design/types';
import {
  getCityDesignOsmFeaturePoints,
  normalizeCityDesignOsmSnapshot,
} from '@/features/amendments/city-design/logic/cityDesignOsm';
import { getCityDesignMapSelectionBoundingBox } from '@/features/amendments/city-design/logic/cityDesignBbox';

export const APP_TUTORIAL_CITY_DESIGN_OSM_NODE_ID = 2_394_871_557;

export const APP_TUTORIAL_CITY_DESIGN_CENTER = {
  lat: 48.1142733,
  lon: 11.5325083,
} as const satisfies CityDesignGeoPoint;

export const APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION = {
  center: APP_TUTORIAL_CITY_DESIGN_CENTER,
  widthMeters: 360,
  heightMeters: 280,
  rotationDeg: 0,
} as const satisfies CityDesignMapSelection;

export const APP_TUTORIAL_CITY_DESIGN_BBOX = getCityDesignMapSelectionBoundingBox(
  APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION
);

export interface AppTutorialCityDesignFixtureDocument {
  schemaVersion: 1;
  attribution: string;
  copyrightUrl: string;
  capturedAt: string;
  address: {
    label: string;
    osmType: 'node';
    osmId: number;
    position: CityDesignGeoPoint;
  };
  mapSelection: CityDesignMapSelection;
  snapshot: CityDesignOsmSnapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isSameNumber(left: number, right: number) {
  return Math.abs(left - right) < 1e-9;
}

function isSamePoint(value: unknown, expected: CityDesignGeoPoint) {
  return (
    isRecord(value) &&
    isFiniteNumber(value.lat) &&
    isFiniteNumber(value.lon) &&
    isSameNumber(value.lat, expected.lat) &&
    isSameNumber(value.lon, expected.lon)
  );
}

function isSameBbox(value: CityDesignBoundingBox, expected: CityDesignBoundingBox) {
  return (
    isSameNumber(value.south, expected.south) &&
    isSameNumber(value.west, expected.west) &&
    isSameNumber(value.north, expected.north) &&
    isSameNumber(value.east, expected.east)
  );
}

function isPointInsideBbox(point: CityDesignGeoPoint, bbox: CityDesignBoundingBox) {
  return (
    point.lat >= bbox.south &&
    point.lat <= bbox.north &&
    point.lon >= bbox.west &&
    point.lon <= bbox.east
  );
}

function doesSegmentIntersectBbox(
  start: CityDesignGeoPoint,
  end: CityDesignGeoPoint,
  bbox: CityDesignBoundingBox
) {
  const deltaLon = end.lon - start.lon;
  const deltaLat = end.lat - start.lat;
  const boundaries = [
    [-deltaLon, start.lon - bbox.west],
    [deltaLon, bbox.east - start.lon],
    [-deltaLat, start.lat - bbox.south],
    [deltaLat, bbox.north - start.lat],
  ] as const;
  let minimum = 0;
  let maximum = 1;

  for (const [direction, distance] of boundaries) {
    if (direction === 0) {
      if (distance < 0) return false;
      continue;
    }
    const ratio = distance / direction;
    if (direction < 0) minimum = Math.max(minimum, ratio);
    else maximum = Math.min(maximum, ratio);
    if (minimum > maximum) return false;
  }

  return true;
}

function isPointInsidePolygon(point: CityDesignGeoPoint, polygon: CityDesignGeoPoint[]) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index] as CityDesignGeoPoint;
    const previousPoint = polygon[previous] as CityDesignGeoPoint;
    const crossesLatitude = currentPoint.lat > point.lat !== previousPoint.lat > point.lat;
    if (
      crossesLatitude &&
      point.lon <
        ((previousPoint.lon - currentPoint.lon) * (point.lat - currentPoint.lat)) /
          (previousPoint.lat - currentPoint.lat) +
          currentPoint.lon
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function doesFeatureIntersectBbox(
  feature: NonNullable<CityDesignOsmSnapshot['features']>[number],
  bbox: CityDesignBoundingBox
) {
  const points = getCityDesignOsmFeaturePoints(feature);
  if (points.some(point => isPointInsideBbox(point, bbox))) return true;
  if (
    points.slice(1).some((point, index) => {
      const previousPoint = points[index];
      return previousPoint && doesSegmentIntersectBbox(previousPoint, point, bbox);
    })
  ) {
    return true;
  }
  return (
    feature.geometryKind === 'polygon' &&
    isPointInsidePolygon(
      {
        lat: (bbox.south + bbox.north) / 2,
        lon: (bbox.west + bbox.east) / 2,
      },
      points
    )
  );
}

function normalizeGermanText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('de')
    .replaceAll('ß', 'ss')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

export function validateAppTutorialCityDesignFixtureDocument(
  value: unknown
): AppTutorialCityDesignFixtureDocument {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new Error('The tutorial OSM fixture has an unsupported schema version.');
  }
  if (
    typeof value.attribution !== 'string' ||
    !value.attribution.includes('OpenStreetMap') ||
    !value.attribution.includes('ODbL') ||
    typeof value.copyrightUrl !== 'string'
  ) {
    throw new Error('The tutorial OSM fixture is missing OpenStreetMap attribution.');
  }
  if (typeof value.capturedAt !== 'string' || !Number.isFinite(Date.parse(value.capturedAt))) {
    throw new Error('The tutorial OSM fixture has an invalid capture timestamp.');
  }

  const address = value.address;
  if (
    !isRecord(address) ||
    address.label !== 'Euckenstraße 38, München' ||
    address.osmType !== 'node' ||
    address.osmId !== APP_TUTORIAL_CITY_DESIGN_OSM_NODE_ID ||
    !isSamePoint(address.position, APP_TUTORIAL_CITY_DESIGN_CENTER)
  ) {
    throw new Error('The tutorial OSM fixture does not describe Euckenstraße 38.');
  }

  const mapSelection = value.mapSelection;
  if (
    !isRecord(mapSelection) ||
    !isSamePoint(mapSelection.center, APP_TUTORIAL_CITY_DESIGN_CENTER) ||
    mapSelection.widthMeters !== APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION.widthMeters ||
    mapSelection.heightMeters !== APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION.heightMeters ||
    mapSelection.rotationDeg !== APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION.rotationDeg
  ) {
    throw new Error('The tutorial OSM fixture has an unexpected map selection.');
  }

  const snapshotValue = value.snapshot;
  if (
    !isRecord(snapshotValue) ||
    !isFiniteNumber(snapshotValue.fetchedAt) ||
    !isRecord(snapshotValue.bbox) ||
    !Array.isArray(snapshotValue.features) ||
    snapshotValue.features.length === 0 ||
    'ways' in snapshotValue
  ) {
    throw new Error('The tutorial OSM fixture has an invalid feature snapshot.');
  }

  const snapshot = normalizeCityDesignOsmSnapshot(
    snapshotValue as unknown as CityDesignOsmSnapshot
  );
  if (!snapshot || !isSameBbox(snapshot.bbox, APP_TUTORIAL_CITY_DESIGN_BBOX)) {
    throw new Error('The tutorial OSM fixture has an unexpected bounding box.');
  }
  if (snapshot.features?.length !== snapshotValue.features.length) {
    throw new Error('The tutorial OSM fixture contains invalid features.');
  }
  if (snapshot.features.some(feature => feature.source !== 'osm' && feature.source !== 'derived')) {
    throw new Error('The tutorial OSM fixture contains synthetic features.');
  }
  if (
    !snapshot.features.some(
      feature =>
        feature.kind === 'road' &&
        feature.source === 'osm' &&
        normalizeGermanText(feature.tags?.name ?? feature.label ?? '') === 'euckenstrasse'
    )
  ) {
    throw new Error('The tutorial OSM fixture does not contain Euckenstraße.');
  }
  if (snapshot.features.some(feature => !doesFeatureIntersectBbox(feature, snapshot.bbox))) {
    throw new Error('The tutorial OSM fixture contains geometry outside its capture area.');
  }

  return {
    schemaVersion: 1,
    attribution: value.attribution,
    copyrightUrl: value.copyrightUrl,
    capturedAt: value.capturedAt,
    address: {
      label: address.label,
      osmType: address.osmType,
      osmId: address.osmId,
      position: { ...APP_TUTORIAL_CITY_DESIGN_CENTER },
    },
    mapSelection: {
      center: { ...APP_TUTORIAL_CITY_DESIGN_CENTER },
      widthMeters: APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION.widthMeters,
      heightMeters: APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION.heightMeters,
      rotationDeg: APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION.rotationDeg,
    },
    snapshot,
  };
}
