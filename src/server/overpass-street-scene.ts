import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type {
  StreetDesignBoundingBox,
  StreetDesignOsmSnapshot,
} from '@/features/amendments/streetscape/types';

const streetSceneSchema = z.object({
  bbox: z.object({
    south: z.number().min(-90).max(90),
    west: z.number().min(-180).max(180),
    north: z.number().min(-90).max(90),
    east: z.number().min(-180).max(180),
  }),
});

interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

interface OverpassPayload {
  elements?: OverpassElement[];
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
] as const;

function assertSmallBoundingBox(bbox: StreetDesignBoundingBox) {
  const latSpan = bbox.north - bbox.south;
  const lonSpan = bbox.east - bbox.west;

  if (latSpan <= 0 || lonSpan <= 0) {
    throw new Error('Invalid street scene bounding box.');
  }

  if (latSpan > 0.02 || lonSpan > 0.02) {
    throw new Error('Street scene bounding box is too large.');
  }
}

function buildOverpassQuery(bbox: StreetDesignBoundingBox) {
  const bounds = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;

  return `
    [out:json][timeout:20];
    (
      way["highway"](${bounds});
      way["building"](${bounds});
      way["leisure"~"park|garden"](${bounds});
      way["natural"~"water|wood|grassland"](${bounds});
      way["landuse"~"grass|recreation_ground|residential"](${bounds});
    );
    out tags geom;
  `;
}

function classifyWay(tags: Record<string, string> | undefined) {
  if (tags?.building) return 'building' as const;
  if (tags?.natural === 'water' || tags?.waterway) return 'water' as const;
  if (tags?.leisure || tags?.natural || tags?.landuse) return 'green' as const;
  return 'road' as const;
}

function hasWayGeometry(
  element: OverpassElement
): element is OverpassElement & { geometry: { lat: number; lon: number }[] } {
  return element.type === 'way' && Boolean(element.geometry && element.geometry.length >= 2);
}

function normalizeOverpassPayload(
  bbox: StreetDesignBoundingBox,
  payload: OverpassPayload
): StreetDesignOsmSnapshot {
  const ways = (payload.elements ?? []).filter(hasWayGeometry).map(element => {
    const tags = element.tags ?? {};
    const levels = Number(tags['building:levels']);
    const explicitHeight = Number.parseFloat(tags.height ?? '');
    const height = Number.isFinite(explicitHeight)
      ? explicitHeight
      : Number.isFinite(levels)
        ? levels * 3
        : tags.building
          ? 9
          : undefined;

    return {
      id: String(element.id),
      kind: classifyWay(tags),
      label: tags.name ?? tags.highway ?? tags.building,
      points: element.geometry.map(point => ({ lat: point.lat, lon: point.lon })),
      height,
      tags,
    };
  });

  return {
    fetchedAt: Date.now(),
    bbox,
    ways,
  };
}

function createFallbackSnapshot(bbox: StreetDesignBoundingBox): StreetDesignOsmSnapshot {
  const centerLat = (bbox.south + bbox.north) / 2;
  const centerLon = (bbox.west + bbox.east) / 2;
  const latSpan = bbox.north - bbox.south;
  const lonSpan = bbox.east - bbox.west;

  return {
    fetchedAt: Date.now(),
    bbox,
    ways: [
      {
        id: 'fallback-road-main',
        kind: 'road',
        label: 'Strassenachse',
        points: [
          { lat: centerLat - latSpan * 0.42, lon: centerLon - lonSpan * 0.42 },
          { lat: centerLat + latSpan * 0.42, lon: centerLon + lonSpan * 0.42 },
        ],
        tags: { source: 'fallback' },
      },
      {
        id: 'fallback-green',
        kind: 'green',
        label: 'Gruenflaeche',
        points: [
          { lat: centerLat + latSpan * 0.12, lon: centerLon - lonSpan * 0.42 },
          { lat: centerLat + latSpan * 0.34, lon: centerLon - lonSpan * 0.22 },
          { lat: centerLat + latSpan * 0.2, lon: centerLon - lonSpan * 0.04 },
          { lat: centerLat, lon: centerLon - lonSpan * 0.22 },
          { lat: centerLat + latSpan * 0.12, lon: centerLon - lonSpan * 0.42 },
        ],
        tags: { source: 'fallback' },
      },
      {
        id: 'fallback-building',
        kind: 'building',
        label: 'Gebaeude',
        height: 12,
        points: [
          { lat: centerLat - latSpan * 0.28, lon: centerLon + lonSpan * 0.18 },
          { lat: centerLat - latSpan * 0.08, lon: centerLon + lonSpan * 0.36 },
          { lat: centerLat + latSpan * 0.08, lon: centerLon + lonSpan * 0.2 },
          { lat: centerLat - latSpan * 0.12, lon: centerLon + lonSpan * 0.02 },
          { lat: centerLat - latSpan * 0.28, lon: centerLon + lonSpan * 0.18 },
        ],
        tags: { source: 'fallback' },
      },
    ],
  };
}

async function fetchOverpassSnapshot(bbox: StreetDesignBoundingBox) {
  const body = new URLSearchParams({ data: buildOverpassQuery(bbox) }).toString();
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'polity-street-design/1.0',
        },
        body,
      });

      if (!response.ok) {
        lastError = new Error(`Overpass request failed with status ${response.status}`);
        continue;
      }

      const payload = (await response.json()) as OverpassPayload;
      return normalizeOverpassPayload(bbox, payload);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Overpass request failed');
    }
  }

  console.warn(lastError?.message ?? 'Overpass request failed');
  return createFallbackSnapshot(bbox);
}

export const overpassStreetSceneFn = createServerFn({ method: 'POST' })
  .validator(streetSceneSchema.parse)
  .handler(async ({ data }) => {
    assertSmallBoundingBox(data.bbox);
    return fetchOverpassSnapshot(data.bbox);
  });
