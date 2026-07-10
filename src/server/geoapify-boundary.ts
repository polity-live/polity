import { createServerFn } from '@tanstack/react-start';
import type { ReadonlyJSONValue } from '@rocicorp/zero';
import { z } from 'zod';

import type {
  GeoJsonGeometry,
  GeoLocationBounds,
  GeoLocationKind,
} from '@/features/shared/logic/geoLocationShape';

const geoAddressFieldSchema = z.enum([
  'country',
  'region',
  'city',
  'post_code',
  'street',
  'house_number',
]);

const geoResolvedAddressSchema = z.object({
  place_id: z.string().optional(),
  country: z.string().optional(),
  country_code: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  city: z.string().optional(),
  street: z.string().optional(),
  housenumber: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  formatted: z.string().optional(),
  result_type: z.string().optional(),
});

const geoAddressValuesSchema = z.object({
  country: z.string(),
  region: z.string(),
  city: z.string(),
  post_code: z.string(),
  street: z.string(),
  house_number: z.string(),
});

const geoapifyBoundarySchema = z.object({
  field: geoAddressFieldSchema,
  placeId: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  values: geoAddressValuesSchema,
  resolvedAddress: geoResolvedAddressSchema.nullable().optional(),
  language: z.string().min(2),
});

type GeoAddressField = z.infer<typeof geoAddressFieldSchema>;
type GeoAddressValues = z.infer<typeof geoAddressValuesSchema>;
type GeoResolvedAddress = z.infer<typeof geoResolvedAddressSchema>;

interface GeoapifyBoundaryFeature {
  type: 'Feature';
  properties?: Record<string, unknown>;
  geometry?: GeoJsonGeometry | null;
  bbox?: [number, number, number, number] | number[];
}

interface GeoapifyBoundaryResponse {
  type?: 'FeatureCollection';
  features?: GeoapifyBoundaryFeature[];
}

interface BoundaryRequest {
  kind: GeoLocationKind;
  boundaries: 'administrative' | 'postal_code';
  geometry: 'geometry_1000' | 'geometry_5000' | 'geometry_10000';
}

interface SerializableGeoLocationShape {
  kind: GeoLocationKind;
  placeId: string | null;
  boundarySource: string | null;
  geometry: ReadonlyJSONValue | null;
  bounds: ReadonlyJSONValue | null;
}

const FIELD_BOUNDARY_REQUESTS: Partial<Record<GeoAddressField, BoundaryRequest>> = {
  post_code: {
    kind: 'postcode',
    boundaries: 'postal_code',
    geometry: 'geometry_1000',
  },
  city: {
    kind: 'city',
    boundaries: 'administrative',
    geometry: 'geometry_5000',
  },
  region: {
    kind: 'region',
    boundaries: 'administrative',
    geometry: 'geometry_10000',
  },
  country: {
    kind: 'country',
    boundaries: 'administrative',
    geometry: 'geometry_10000',
  },
};

function getGeoapifyApiKey(): string {
  const apiKey = process.env.GEOAPIFY_API_KEY ?? process.env.VITE_GEOAPIFY_API_KEY;

  if (!apiKey) {
    throw new Error('Geoapify API key is not configured');
  }

  return apiKey;
}

function normalize(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('de-DE');
}

function extractTargetValue(
  field: GeoAddressField,
  values: GeoAddressValues,
  resolvedAddress?: GeoResolvedAddress | null
): string {
  if (field === 'post_code') {
    return resolvedAddress?.postcode ?? values.post_code;
  }

  if (field === 'city') {
    return resolvedAddress?.city ?? values.city;
  }

  if (field === 'region') {
    return resolvedAddress?.state ?? values.region;
  }

  if (field === 'country') {
    return resolvedAddress?.country ?? values.country;
  }

  return '';
}

function getNamedPropertyCandidates(
  field: GeoAddressField,
  properties?: Record<string, unknown>
): unknown[] {
  if (!properties) {
    return [];
  }

  if (field === 'post_code') {
    return [properties.postcode, properties.post_code, properties.name];
  }

  if (field === 'city') {
    return [
      properties.city,
      properties.town,
      properties.village,
      properties.municipality,
      properties.name,
    ];
  }

  if (field === 'region') {
    return [properties.state, properties.region, properties.province, properties.name];
  }

  if (field === 'country') {
    return [properties.country, properties.name];
  }

  return [];
}

function getContextPropertyCandidates(
  field: GeoAddressField,
  properties?: Record<string, unknown>
): unknown[] {
  if (!properties) {
    return [];
  }

  if (field === 'post_code') {
    return [properties.postcode, properties.post_code];
  }

  if (field === 'city') {
    return [properties.city, properties.town, properties.village, properties.municipality];
  }

  if (field === 'region') {
    return [properties.state, properties.region, properties.province];
  }

  if (field === 'country') {
    return [properties.country];
  }

  return [];
}

function isPolygonGeometry(geometry?: GeoJsonGeometry | null): geometry is GeoJsonGeometry {
  return geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon';
}

function boundsFromBbox(bbox?: number[]): GeoLocationBounds | null {
  if (!bbox || bbox.length < 4 || bbox.some(value => typeof value !== 'number')) {
    return null;
  }

  return {
    west: bbox[0],
    south: bbox[1],
    east: bbox[2],
    north: bbox[3],
  };
}

function extendBounds(
  bounds: GeoLocationBounds | null,
  longitude: number,
  latitude: number
): GeoLocationBounds {
  if (!bounds) {
    return {
      south: latitude,
      west: longitude,
      north: latitude,
      east: longitude,
    };
  }

  return {
    south: Math.min(bounds.south, latitude),
    west: Math.min(bounds.west, longitude),
    north: Math.max(bounds.north, latitude),
    east: Math.max(bounds.east, longitude),
  };
}

function visitCoordinates(
  value: unknown,
  callback: (longitude: number, latitude: number) => void
): void {
  if (!Array.isArray(value)) {
    return;
  }

  if (typeof value[0] === 'number' && typeof value[1] === 'number') {
    callback(value[0], value[1]);
    return;
  }

  for (const child of value) {
    visitCoordinates(child, callback);
  }
}

function boundsFromGeometry(geometry: GeoJsonGeometry): GeoLocationBounds | null {
  let bounds: GeoLocationBounds | null = null;

  if (geometry.type === 'GeometryCollection') {
    for (const child of geometry.geometries ?? []) {
      const childBounds = boundsFromGeometry(child);
      if (!childBounds) {
        continue;
      }

      bounds = extendBounds(bounds, childBounds.west, childBounds.south);
      bounds = extendBounds(bounds, childBounds.east, childBounds.north);
    }
    return bounds;
  }

  visitCoordinates(geometry.coordinates, (longitude, latitude) => {
    bounds = extendBounds(bounds, longitude, latitude);
  });

  return bounds;
}

function boundsArea(bounds?: GeoLocationBounds | null): number {
  if (!bounds) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs((bounds.east - bounds.west) * (bounds.north - bounds.south));
}

function getFeatureTargetScore(
  feature: GeoapifyBoundaryFeature,
  field: GeoAddressField,
  targetValue: string
): number {
  const normalizedTarget = normalize(targetValue);
  if (!normalizedTarget) {
    return 0;
  }

  if (
    getNamedPropertyCandidates(field, feature.properties).some(
      candidate => normalize(candidate) === normalizedTarget
    )
  ) {
    return 2;
  }

  return getContextPropertyCandidates(field, feature.properties).some(
    candidate => normalize(candidate) === normalizedTarget
  )
    ? 1
    : 0;
}

function selectBoundaryFeature(
  features: GeoapifyBoundaryFeature[],
  field: GeoAddressField,
  targetValue: string
): GeoapifyBoundaryFeature | null {
  const polygonFeatures = features.filter(feature => isPolygonGeometry(feature.geometry));
  const scoredFeatures = polygonFeatures.map(feature => ({
    feature,
    score: getFeatureTargetScore(feature, field, targetValue),
    bounds:
      boundsFromBbox(feature.bbox) ??
      (feature.geometry ? boundsFromGeometry(feature.geometry) : null),
  }));
  const highestScore = Math.max(0, ...scoredFeatures.map(feature => feature.score));
  const candidates =
    highestScore > 0
      ? scoredFeatures.filter(feature => feature.score === highestScore)
      : scoredFeatures;
  const areaDirection = field === 'country' || field === 'region' ? -1 : 1;

  return (
    candidates.sort(
      (left, right) => areaDirection * (boundsArea(left.bounds) - boundsArea(right.bounds))
    )[0]?.feature ?? null
  );
}

function buildGeoapifyBoundaryUrl(
  data: z.infer<typeof geoapifyBoundarySchema>,
  request: BoundaryRequest,
  apiKey: string
): string | null {
  const params = new URLSearchParams({
    apiKey,
    boundaries: request.boundaries,
    geometry: request.geometry,
    lang: data.language,
  });

  if (data.placeId) {
    params.set('id', data.placeId);
  } else if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
    params.set('lat', String(data.latitude));
    params.set('lon', String(data.longitude));
  } else {
    return null;
  }

  return `https://api.geoapify.com/v1/boundaries/part-of?${params.toString()}`;
}

function toSerializableJson(value: unknown): ReadonlyJSONValue | null {
  return (value ?? null) as ReadonlyJSONValue | null;
}

function pointShape(placeId?: string | null): SerializableGeoLocationShape {
  return {
    kind: 'point',
    placeId: placeId ?? null,
    boundarySource: null,
    geometry: null,
    bounds: null,
  };
}

export const geoapifyBoundaryFn = createServerFn({ method: 'POST' })
  .validator(geoapifyBoundarySchema.parse)
  .handler(async ({ data }) => {
    const request = FIELD_BOUNDARY_REQUESTS[data.field];

    if (!request) {
      return {
        shape: pointShape(data.placeId ?? data.resolvedAddress?.place_id ?? null),
      };
    }

    const url = buildGeoapifyBoundaryUrl(data, request, getGeoapifyApiKey());
    if (!url) {
      return {
        shape: {
          kind: request.kind,
          placeId: data.placeId ?? data.resolvedAddress?.place_id ?? null,
          boundarySource: `geoapify:${request.boundaries}`,
          geometry: null,
          bounds: null,
        } satisfies SerializableGeoLocationShape,
      };
    }

    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Geoapify boundary request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as GeoapifyBoundaryResponse;
    const targetValue = extractTargetValue(data.field, data.values, data.resolvedAddress);
    const feature = selectBoundaryFeature(payload.features ?? [], data.field, targetValue);
    const geometry = isPolygonGeometry(feature?.geometry) ? feature.geometry : null;
    const bounds = feature
      ? (boundsFromBbox(feature.bbox) ?? (geometry ? boundsFromGeometry(geometry) : null))
      : null;

    return {
      shape: {
        kind: request.kind,
        placeId: data.placeId ?? data.resolvedAddress?.place_id ?? null,
        boundarySource: `geoapify:${request.boundaries}`,
        geometry: toSerializableJson(geometry),
        bounds: toSerializableJson(bounds),
      } satisfies SerializableGeoLocationShape,
    };
  });
