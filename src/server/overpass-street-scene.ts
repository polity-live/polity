import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type {
  StreetDesignBoundingBox,
  StreetDesignOsmElevationSource,
  StreetDesignGeoPoint,
  StreetDesignOsmFeature,
  StreetDesignOsmFeatureKind,
  StreetDesignOsmSnapshot,
  StreetDesignOsmStructureKind,
} from '@/features/amendments/streetscape/types';
import {
  applyStreetDesignOsmSemanticMapping,
  getStreetDesignOsmRoadWidthMeters,
  getStreetDesignOsmSideWidthMeters,
} from '@/features/amendments/streetscape/logic/streetDesignOsmMapping';

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
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: { lat: number; lon: number }[];
  members?: {
    type: string;
    ref: number;
    role?: string;
    geometry?: { lat: number; lon: number }[];
  }[];
}

interface OverpassPayload {
  elements?: OverpassElement[];
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
] as const;

const ROAD_HIGHWAY_VALUES = new Set([
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'unclassified',
  'residential',
  'living_street',
  'service',
  'motorway_link',
  'trunk_link',
  'primary_link',
  'secondary_link',
  'tertiary_link',
  'track',
  'construction',
]);

const RAILWAY_VALUES = new Set(['rail', 'tram', 'light_rail', 'subway']);

const TRANSIT_RAILWAY_VALUES = new Set([
  'station',
  'halt',
  'tram_stop',
  'subway_entrance',
  'platform',
]);

const CIVIC_AMENITY_VALUES = new Set(['school', 'university', 'hospital', 'kindergarten']);

const HOSPITALITY_AMENITY_VALUES = new Set(['restaurant', 'cafe']);

const UTILITY_AMENITY_VALUES = new Set([
  'waste_basket',
  'recycling',
  'post_box',
  'fountain',
  'drinking_water',
  'charging_station',
  'toilets',
  'taxi',
]);

const STREET_FURNITURE_AMENITY_VALUES = new Set(['bench', 'bicycle_parking']);

const BARRIER_VALUES = new Set([
  'hedge',
  'bollard',
  'gate',
  'fence',
  'wall',
  'kerb',
  'cycle_barrier',
  'block',
  'lift_gate',
]);

const SPORTS_LEISURE_VALUES = new Set(['pitch', 'sports_centre']);

const ABSENT_SIDE_VALUES = new Set([
  'no',
  'none',
  'separate',
  'no_parking',
  'no_stopping',
  'no_standing',
]);

const GREEN_LANDUSE_VALUES = new Set([
  'allotments',
  'cemetery',
  'forest',
  'grass',
  'greenfield',
  'meadow',
  'recreation_ground',
  'village_green',
  'orchard',
  'vineyard',
  'flowerbed',
]);

const CONTEXT_LANDUSE_VALUES = new Set([
  'retail',
  'commercial',
  'industrial',
  'residential',
  'education',
  'institutional',
]);

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

export function buildOverpassQuery(bbox: StreetDesignBoundingBox) {
  const bounds = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;

  return `
    [out:json][timeout:20];
    (
      node["natural"="tree"](${bounds});
      node["amenity"~"bench|bicycle_parking|waste_basket|recycling|post_box|fountain|drinking_water|charging_station|toilets|taxi|bus_station"](${bounds});
      node["highway"~"street_lamp|traffic_signals|traffic_sign|crossing|bus_stop|stop|give_way"](${bounds});
      node["traffic_sign"](${bounds});
      node["entrance"](${bounds});
      node["emergency"="fire_hydrant"](${bounds});
      node["barrier"~"bollard|gate|kerb|cycle_barrier|block|lift_gate"](${bounds});
      node["traffic_calming"](${bounds});
      node["railway"~"station|halt|tram_stop|subway_entrance"](${bounds});
      node["public_transport"~"platform|stop_position|station"](${bounds});
      way["highway"](${bounds});
      way["building"](${bounds});
      way["place"="square"](${bounds});
      way["amenity"="marketplace"](${bounds});
      way["railway"~"rail|tram|light_rail|subway|station|halt|tram_stop|platform"](${bounds});
      way["public_transport"~"platform|stop_position|station"](${bounds});
      way["leisure"~"park|garden|playground|pitch|sports_centre"](${bounds});
      way["natural"~"water|wood|grassland|tree_row|wetland|scrub|shrubbery|heath"](${bounds});
      way["water"~"river|canal|lake|reservoir|pond|basin|stream_pool"](${bounds});
      way["waterway"~"riverbank|river|canal|stream|ditch|drain"](${bounds});
      way["landuse"~"allotments|cemetery|forest|grass|greenfield|meadow|recreation_ground|village_green|orchard|vineyard|flowerbed|brownfield|retail|commercial|industrial|residential|education|institutional"](${bounds});
      way["amenity"="parking"](${bounds});
      way["amenity"~"bicycle_parking|recycling|fountain|drinking_water|school|university|hospital|kindergarten|charging_station|toilets|taxi|bus_station"](${bounds});
      way["barrier"~"hedge|fence|wall|gate|kerb|cycle_barrier|block|lift_gate"](${bounds});
      way["traffic_calming"](${bounds});
      way["historic"](${bounds});
      way["tourism"~"attraction|hotel"](${bounds});
      way["shop"](${bounds});
      way["office"](${bounds});
      way["parking"](${bounds});
      way["bridge"](${bounds});
      way["bridge:structure"](${bounds});
      way["bridge:support"](${bounds});
      way["tunnel"](${bounds});
      way["layer"](${bounds});
      way["embankment"](${bounds});
      way["cutting"](${bounds});
      way["incline"](${bounds});
      way["step_count"](${bounds});
      way["ele"](${bounds});
      way["height"](${bounds});
      way["man_made"="bridge"](${bounds});
      way["area:highway"="steps"](${bounds});
      way["area:highway"="traffic_island"](${bounds});
      relation["natural"~"water|wetland"](${bounds});
      relation["building"](${bounds});
      relation["place"="square"](${bounds});
      relation["water"~"river|canal|lake|reservoir|pond|basin|stream_pool"](${bounds});
      relation["waterway"~"riverbank|river|canal"](${bounds});
      relation["bridge"](${bounds});
      relation["bridge:structure"](${bounds});
      relation["layer"](${bounds});
      relation["man_made"="bridge"](${bounds});
    );
    out tags geom;
  `;
}

function isClosedRing(points: StreetDesignGeoPoint[]) {
  const first = points[0];
  const last = points[points.length - 1];
  return (
    points.length >= 4 && Boolean(first && last && first.lat === last.lat && first.lon === last.lon)
  );
}

function classifyWay(tags: Record<string, string> | undefined): StreetDesignOsmFeatureKind | null {
  if (!tags) return null;

  if (tags.building) return 'building';
  if (tags.railway && RAILWAY_VALUES.has(tags.railway)) return 'rail';
  if (
    (tags.railway && TRANSIT_RAILWAY_VALUES.has(tags.railway)) ||
    tags.public_transport ||
    tags.highway === 'bus_stop' ||
    tags.amenity === 'bus_station'
  ) {
    return 'transit';
  }
  if (tags.natural === 'tree_row') return 'tree_row';
  if (tags.natural === 'water' || tags.water || tags.waterway || tags.natural === 'wetland') {
    return 'water';
  }
  if (tags.amenity === 'fountain' || tags.amenity === 'drinking_water') return 'water';
  if (tags.amenity === 'parking' || (tags.parking && !tags.highway)) return 'parking';
  if (tags['area:highway'] === 'traffic_island') return 'traffic';
  if (
    tags.place === 'square' ||
    tags.amenity === 'marketplace' ||
    (tags.highway === 'pedestrian' && tags.area === 'yes')
  ) {
    return 'landuse_context';
  }
  if (tags.leisure === 'playground') return 'playground';
  if (tags.leisure && SPORTS_LEISURE_VALUES.has(tags.leisure)) return 'sports';
  if (tags.landuse === 'brownfield') return 'construction';
  if (tags.landuse && CONTEXT_LANDUSE_VALUES.has(tags.landuse)) return 'landuse_context';
  if (tags.amenity && CIVIC_AMENITY_VALUES.has(tags.amenity)) return 'civic_area';
  if (tags.barrier && BARRIER_VALUES.has(tags.barrier)) return 'barrier';
  if (tags.amenity && STREET_FURNITURE_AMENITY_VALUES.has(tags.amenity)) {
    return 'street_furniture';
  }
  if (tags.amenity && UTILITY_AMENITY_VALUES.has(tags.amenity)) return 'utility';
  if (tags.man_made === 'bridge') return 'construction';
  if (tags.traffic_calming) return 'traffic';
  if (
    tags.leisure ||
    tags.natural ||
    GREEN_LANDUSE_VALUES.has(tags.landuse ?? '') ||
    tags['garden:type']
  ) {
    return 'green';
  }

  const highway = tags?.highway;
  if (!highway) return null;

  if (
    highway === 'crossing' ||
    highway === 'traffic_signals' ||
    highway === 'traffic_sign' ||
    highway === 'stop' ||
    highway === 'give_way'
  ) {
    return 'traffic';
  }
  if (highway === 'bus_stop') return 'transit';

  if (
    highway === 'footway' ||
    highway === 'pedestrian' ||
    highway === 'steps' ||
    highway === 'bridleway'
  ) {
    return 'sidewalk';
  }

  if (highway === 'cycleway') return 'bike_lane';

  if (highway === 'path') {
    return tags?.cycleway || tags?.bicycle === 'designated' ? 'bike_lane' : 'sidewalk';
  }

  if (ROAD_HIGHWAY_VALUES.has(highway)) return 'road';

  return null;
}

function hasPointGeometry(
  element: OverpassElement
): element is OverpassElement & { lat: number; lon: number } {
  return element.type === 'node' && Number.isFinite(element.lat) && Number.isFinite(element.lon);
}

function toGeoPoints(geometry: { lat: number; lon: number }[]) {
  return geometry.map(point => ({ lat: point.lat, lon: point.lon }));
}

function isSameGeoPoint(
  first: StreetDesignGeoPoint | undefined,
  second: StreetDesignGeoPoint | undefined
) {
  return Boolean(
    first &&
    second &&
    Math.abs(first.lat - second.lat) < 0.0000001 &&
    Math.abs(first.lon - second.lon) < 0.0000001
  );
}

function stitchRelationSegments(segments: StreetDesignGeoPoint[][]) {
  const remaining = segments.filter(segment => segment.length >= 2).map(segment => [...segment]);
  const rings: StreetDesignGeoPoint[][] = [];

  while (remaining.length > 0) {
    let ring = remaining.shift() ?? [];
    let changed = true;

    while (changed) {
      changed = false;

      for (let index = 0; index < remaining.length; index += 1) {
        const segment = remaining[index];
        const ringStart = ring[0];
        const ringEnd = ring[ring.length - 1];
        const segmentStart = segment[0];
        const segmentEnd = segment[segment.length - 1];

        if (isSameGeoPoint(ringEnd, segmentStart)) {
          ring = [...ring, ...segment.slice(1)];
        } else if (isSameGeoPoint(ringEnd, segmentEnd)) {
          ring = [...ring, ...segment.slice(0, -1).reverse()];
        } else if (isSameGeoPoint(ringStart, segmentEnd)) {
          ring = [...segment.slice(0, -1), ...ring];
        } else if (isSameGeoPoint(ringStart, segmentStart)) {
          ring = [...segment.slice(1).reverse(), ...ring];
        } else {
          continue;
        }

        remaining.splice(index, 1);
        changed = true;
        break;
      }
    }

    rings.push(ring);
  }

  const closedRing = rings
    .filter(isClosedRing)
    .sort((first, second) => second.length - first.length)[0];

  return (
    closedRing ??
    rings
      .filter(ring => ring.length >= 3)
      .sort((first, second) => second.length - first.length)[0] ??
    null
  );
}

function getElementGeometryPoints(element: OverpassElement) {
  if (
    (element.type === 'way' || element.type === 'relation') &&
    element.geometry &&
    element.geometry.length >= 2
  ) {
    return toGeoPoints(element.geometry);
  }

  if (element.type !== 'relation') return null;

  const outerSegments =
    element.members
      ?.filter(member => member.type === 'way' && (member.role === 'outer' || !member.role))
      .map(member => (member.geometry ? toGeoPoints(member.geometry) : []))
      .filter(segment => segment.length >= 2) ?? [];

  return stitchRelationSegments(outerSegments);
}

function classifyPoint(tags: Record<string, string>): StreetDesignOsmFeatureKind | null {
  if (tags.natural === 'tree') return 'tree';
  if (tags.highway === 'street_lamp') return 'street_furniture';
  if (
    tags.highway === 'traffic_signals' ||
    tags.highway === 'traffic_sign' ||
    tags.highway === 'stop' ||
    tags.highway === 'give_way' ||
    tags.highway === 'crossing' ||
    tags.traffic_sign ||
    tags.traffic_calming
  ) {
    return 'traffic';
  }
  if (tags.highway === 'bus_stop' || tags.public_transport || tags.amenity === 'bus_station')
    return 'transit';
  if (tags.railway && TRANSIT_RAILWAY_VALUES.has(tags.railway)) return 'transit';
  if (tags.emergency === 'fire_hydrant') return 'utility';
  if (tags.entrance) return 'utility';
  if (tags.barrier && BARRIER_VALUES.has(tags.barrier)) return 'barrier';
  if (tags.amenity && STREET_FURNITURE_AMENITY_VALUES.has(tags.amenity)) {
    return 'street_furniture';
  }
  if (tags.amenity === 'fountain' || tags.amenity === 'drinking_water') return 'water';
  if (tags.amenity && UTILITY_AMENITY_VALUES.has(tags.amenity)) return 'utility';

  return null;
}

function getFeatureGeometryKind(kind: StreetDesignOsmFeatureKind, points: StreetDesignGeoPoint[]) {
  if (
    kind === 'road' ||
    kind === 'sidewalk' ||
    kind === 'bike_lane' ||
    kind === 'tree_row' ||
    kind === 'rail'
  ) {
    return 'line' as const;
  }

  if (kind === 'barrier') return isClosedRing(points) ? ('polygon' as const) : ('line' as const);
  if (kind === 'traffic') return isClosedRing(points) ? ('polygon' as const) : ('line' as const);
  if (kind === 'transit') return isClosedRing(points) ? ('polygon' as const) : ('line' as const);
  if (kind === 'street_furniture' || kind === 'utility') {
    return isClosedRing(points) ? ('polygon' as const) : ('line' as const);
  }

  if (kind === 'parking') {
    return isClosedRing(points) ? ('polygon' as const) : ('line' as const);
  }

  if (kind === 'water') {
    return isClosedRing(points) ? ('polygon' as const) : ('line' as const);
  }

  return 'polygon' as const;
}

function getFeatureWidthMeters(kind: StreetDesignOsmFeatureKind, tags: Record<string, string>) {
  const explicitWidth = Number.parseFloat(tags.width ?? '');
  if (Number.isFinite(explicitWidth) && explicitWidth > 0) return explicitWidth;

  if (kind === 'sidewalk') return 2.4;
  if (kind === 'bike_lane') return 2;
  if (kind === 'parking') return 2.5;
  if (kind === 'tree_row') return 1.8;
  if (kind === 'rail') return 1.6;
  if (kind === 'water') {
    if (tags.waterway === 'river' || tags.waterway === 'canal') return 8;
    if (tags.waterway === 'stream') return 2;
    if (tags.waterway === 'ditch' || tags.waterway === 'drain') return 1.4;
  }
  if (kind === 'barrier')
    return tags.barrier === 'wall' ? 0.5 : tags.barrier === 'hedge' ? 0.8 : 0.3;
  if (kind === 'traffic') return tags.highway === 'crossing' ? 3 : 1.2;
  if (kind === 'transit') return 2.8;
  if (kind === 'road') return getStreetDesignOsmRoadWidthMeters(tags);
  return undefined;
}

function getFeatureLabel(tags: Record<string, string>, kind: StreetDesignOsmFeatureKind) {
  return (
    tags.name ??
    tags.highway ??
    tags.amenity ??
    tags.railway ??
    tags.barrier ??
    tags.leisure ??
    tags.natural ??
    tags.water ??
    tags.waterway ??
    tags.landuse ??
    kind
  );
}

function getFeatureLevel(tags: Record<string, string>) {
  if (tags.bridge && tags.bridge !== 'no') return 'bridge' as const;
  if (tags.man_made === 'bridge') return 'bridge' as const;
  if (tags.tunnel && tags.tunnel !== 'no') return 'tunnel' as const;
  if (tags.railway === 'subway') return 'tunnel' as const;
  return 'surface' as const;
}

function parseFiniteNumber(value: string | undefined) {
  if (!value) return undefined;
  const normalized = value.replace(',', '.').match(/-?\d+(\.\d+)?/)?.[0];
  if (!normalized) return undefined;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseInteger(value: string | undefined) {
  const parsed = parseFiniteNumber(value);
  return typeof parsed === 'number' ? Math.round(parsed) : undefined;
}

function isTruthyOsmTag(value: string | undefined) {
  return Boolean(value && value !== 'no' && value !== 'false' && value !== '0');
}

function getFeatureLayerIndex(tags: Record<string, string>) {
  return parseInteger(tags.layer) ?? 0;
}

function getFeatureStructureKind(
  kind: StreetDesignOsmFeatureKind,
  tags: Record<string, string>
): StreetDesignOsmStructureKind | undefined {
  if (tags.highway === 'steps' || tags['area:highway'] === 'steps') return 'steps';
  if (tags.railway === 'subway' || isTruthyOsmTag(tags.tunnel)) return 'tunnel';
  if (isTruthyOsmTag(tags.cutting)) return 'cutting';

  if (isTruthyOsmTag(tags.bridge) || tags.man_made === 'bridge') {
    if (
      tags.bridge === 'viaduct' ||
      tags['bridge:structure'] === 'viaduct' ||
      tags['bridge:support'] === 'viaduct'
    ) {
      return 'viaduct';
    }
    return 'bridge';
  }

  if (isTruthyOsmTag(tags.embankment)) return 'embankment';
  if (kind === 'rail' && getFeatureLayerIndex(tags) > 0) return 'embankment';
  return undefined;
}

function getFeatureClearanceMeters(tags: Record<string, string>) {
  return (
    parseFiniteNumber(tags.clearance) ??
    parseFiniteNumber(tags['maxheight:physical']) ??
    parseFiniteNumber(tags.maxheight) ??
    parseFiniteNumber(tags.min_height)
  );
}

function getFeatureStepCount(tags: Record<string, string>) {
  return parseInteger(tags.step_count ?? tags.steps);
}

function getFeatureDeckElevationMeters(args: {
  kind: StreetDesignOsmFeatureKind;
  tags: Record<string, string>;
  layerIndex: number;
  structureKind?: StreetDesignOsmStructureKind;
  clearanceMeters?: number;
  stepCount?: number;
}) {
  const { kind, tags, layerIndex, structureKind, clearanceMeters, stepCount } = args;
  const explicitLocalHeight = kind === 'building' ? undefined : parseFiniteNumber(tags.height);

  if (structureKind === 'tunnel') return -2.4;
  if (structureKind === 'cutting') return -1.4;
  if (structureKind === 'steps') {
    const rise = Math.max((stepCount ?? 6) * 0.16, 0.6);
    return tags.incline === 'down' ? -rise : rise;
  }
  if (typeof explicitLocalHeight === 'number' && explicitLocalHeight > 0) {
    return explicitLocalHeight;
  }
  if (typeof clearanceMeters === 'number' && clearanceMeters > 0 && structureKind) {
    return clearanceMeters + 0.45;
  }

  const layerLift = layerIndex > 0 ? layerIndex * 2.4 + 1 : 0;
  if (structureKind === 'viaduct') return Math.max(kind === 'rail' ? 7.5 : 6.5, layerLift);
  if (structureKind === 'embankment') return Math.max(kind === 'rail' ? 4.5 : 3.4, layerLift);
  if (structureKind === 'bridge') return Math.max(kind === 'rail' ? 5.2 : 3.6, layerLift);
  if (layerIndex > 0 && (kind === 'rail' || kind === 'road')) return layerLift;
  if (kind === 'water') return -0.08;
  return 0;
}

function getFeatureBaseElevationMeters(structureKind: StreetDesignOsmStructureKind | undefined) {
  if (structureKind === 'tunnel') return -2.4;
  if (structureKind === 'cutting') return -1.4;
  return 0;
}

function getFeatureElevationSource(args: {
  tags: Record<string, string>;
  deckElevationMeters: number;
  structureKind?: StreetDesignOsmStructureKind;
}): StreetDesignOsmElevationSource {
  if (args.tags.ele || args.tags.height || args.tags.min_height || args.tags.clearance) {
    return 'osm';
  }
  if (args.structureKind || Math.abs(args.deckElevationMeters) > 0) return 'heuristic';
  return 'surface';
}

function getFeatureAccess(tags: Record<string, string>) {
  if (tags.access === 'private') return 'private' as const;
  if (tags.access === 'destination') return 'destination' as const;
  return 'public' as const;
}

function getBuildingSemanticUse(tags: Record<string, string>) {
  if (tags.shop || tags.building === 'commercial' || tags.building === 'retail') return 'retail';
  if (tags.office || tags.building === 'office') return 'office';
  if (
    (tags.amenity && CIVIC_AMENITY_VALUES.has(tags.amenity)) ||
    tags.amenity === 'townhall' ||
    tags.amenity === 'library' ||
    tags.building === 'public' ||
    tags.building === 'civic' ||
    tags.building === 'school' ||
    tags.building === 'university' ||
    tags.building === 'hospital'
  ) {
    return 'civic';
  }
  if (
    tags.tourism === 'hotel' ||
    (tags.amenity && HOSPITALITY_AMENITY_VALUES.has(tags.amenity)) ||
    tags.building === 'hotel'
  ) {
    return 'hospitality';
  }
  if (tags.building === 'industrial' || tags.building === 'warehouse') return 'industrial';
  if (
    tags.building === 'apartments' ||
    tags.building === 'house' ||
    tags.building === 'residential'
  ) {
    return 'residential';
  }
  if (tags.historic || tags.tourism === 'attraction') return 'significant';
  return undefined;
}

function getBuildingRenderColor(semanticUse: string | undefined) {
  switch (semanticUse) {
    case 'residential':
      return '#c8bda7';
    case 'retail':
      return '#b46b55';
    case 'office':
      return '#6f7a82';
    case 'civic':
      return '#8ba77f';
    case 'hospitality':
      return '#c9a45c';
    case 'industrial':
      return '#6b7280';
    case 'significant':
      return '#a78b5b';
    default:
      return undefined;
  }
}

function getFeatureRenderColor(kind: StreetDesignOsmFeatureKind, tags: Record<string, string>) {
  if (kind === 'road' && tags.highway === 'construction') return '#b7791f';
  if (kind === 'road' && tags.highway === 'track') return '#8a6a42';
  if (kind === 'rail') return '#475569';
  if (kind === 'water' && tags.natural === 'wetland') return '#4f8f83';
  if (kind === 'green' && tags.natural === 'scrub') return '#5c8f46';
  if (kind === 'green' && tags.natural === 'heath') return '#8b7d57';
  if (kind === 'green' && tags.landuse === 'flowerbed') return '#c95f8a';
  if (kind === 'construction') return '#a16207';
  if (kind === 'landuse_context') return '#8f8a7a';
  if (kind === 'sports') return '#5f9f65';
  if (kind === 'playground') return '#d6a23f';
  if (kind === 'barrier' && tags.barrier === 'hedge') return '#4d7c3f';
  if (kind === 'barrier') return '#64748b';
  if (kind === 'traffic') return '#f8fafc';
  if (kind === 'transit') return '#2563eb';
  if (kind === 'street_furniture') return '#8a6a42';
  if (kind === 'utility') return '#3f3f46';
  return undefined;
}

function getFeatureSubkind(kind: StreetDesignOsmFeatureKind, tags: Record<string, string>) {
  if (kind === 'road') {
    if (tags.highway === 'construction') return 'construction';
    if (tags.highway === 'track') return 'track';
    if (
      tags.highway === 'motorway' ||
      tags.highway === 'trunk' ||
      tags.highway === 'primary' ||
      tags.highway === 'secondary'
    ) {
      return 'major_road';
    }
    return tags.highway;
  }
  if (kind === 'sidewalk') {
    if (tags.highway === 'steps') return 'steps';
    if (tags.highway === 'bridleway') return 'bridleway';
    return tags.highway;
  }
  if (kind === 'rail') return tags.railway === 'subway' ? 'subway' : tags.railway;
  if (kind === 'water') {
    if (tags.natural === 'wetland') return 'wetland';
    if (tags.intermittent === 'yes') return 'intermittent';
    return tags.amenity ?? tags.water ?? tags.natural ?? tags.waterway;
  }
  if (kind === 'green') {
    if (tags.natural === 'scrub' || tags.natural === 'shrubbery') return 'scrub';
    if (tags.natural === 'heath') return 'heath';
    if (tags.landuse === 'orchard' || tags.landuse === 'vineyard') return tags.landuse;
    if (tags.landuse === 'flowerbed' || tags['garden:type']) return 'flower_bed';
    return tags.landuse ?? tags.natural ?? tags.leisure;
  }
  if (kind === 'construction') return tags.landuse ?? tags.highway ?? 'construction';
  if (kind === 'landuse_context') return tags.landuse;
  if (kind === 'sports') return tags.leisure ?? 'sports';
  if (kind === 'playground') return 'playground';
  if (kind === 'barrier') return tags.barrier;
  if (kind === 'street_furniture') return tags.amenity ?? tags.highway;
  if (kind === 'utility') return tags.emergency ?? tags.amenity;
  if (kind === 'traffic')
    return tags.traffic_calming ?? tags['area:highway'] ?? tags.highway ?? tags.crossing;
  if (kind === 'transit') return tags.highway ?? tags.railway ?? tags.public_transport;
  if (kind === 'parking' && hasLoadingZoneTags(tags)) return 'loading_zone';
  if (kind === 'building') {
    if (tags.historic || tags.tourism === 'attraction') return 'significant';
    return tags.building;
  }
  return tags.natural ?? tags.amenity ?? tags.highway ?? tags.landuse;
}

function hasLoadingZoneTags(tags: Record<string, string>) {
  return Object.entries(tags).some(
    ([key, value]) => key.startsWith('parking') && value.includes('loading_only')
  );
}

function isPresentSideValue(value: string | undefined) {
  return Boolean(value && !ABSENT_SIDE_VALUES.has(value));
}

function collectSideValues(
  tags: Record<string, string>,
  key: string,
  presentBaseValues: Set<string>
): ('left' | 'right')[] {
  const sides: ('left' | 'right')[] = [];
  const keepExplicitlyPresent = (candidates: ('left' | 'right')[]) =>
    candidates.filter(side => !ABSENT_SIDE_VALUES.has(tags[`${key}:${side}`] ?? ''));

  (['left', 'right'] as const).forEach(side => {
    if (isPresentSideValue(tags[`${key}:${side}`])) {
      sides.push(side);
    }
  });

  if (sides.length > 0) return keepExplicitlyPresent(sides);

  if (isPresentSideValue(tags[`${key}:both`])) return keepExplicitlyPresent(['left', 'right']);

  const baseValue = tags[key];
  if (!baseValue || ABSENT_SIDE_VALUES.has(baseValue)) return [];
  if (baseValue === 'left' || baseValue === 'right') return keepExplicitlyPresent([baseValue]);
  if (baseValue === 'both' || baseValue === 'yes' || presentBaseValues.has(baseValue)) {
    return keepExplicitlyPresent(['left', 'right']);
  }

  return [];
}

function collectCyclewaySides(tags: Record<string, string>) {
  return collectSideValues(
    tags,
    'cycleway',
    new Set(['lane', 'track', 'opposite_lane', 'shared_lane'])
  ).filter(side => tags[`cycleway:${side}`] !== 'separate' && tags.cycleway !== 'sidepath');
}

function collectParkingSides(tags: Record<string, string>) {
  const modernSides = collectSideValues(
    tags,
    'parking',
    new Set(['lane', 'street_side', 'on_street', 'on_kerb', 'half_on_kerb', 'yes'])
  );
  const legacySides = collectSideValues(
    tags,
    'parking:lane',
    new Set(['parallel', 'diagonal', 'perpendicular', 'marked', 'yes'])
  );

  return Array.from(new Set([...modernSides, ...legacySides]));
}

function collectLoadingZoneSides(tags: Record<string, string>): ('left' | 'right')[] {
  const sides: ('left' | 'right')[] = [];

  (['left', 'right'] as const).forEach(side => {
    const sideValue = Object.entries(tags).find(
      ([key, value]) => key.startsWith(`parking:${side}`) && value.includes('loading_only')
    );
    if (sideValue) sides.push(side);
  });

  if (sides.length > 0) return sides;
  if (hasLoadingZoneTags(tags)) return ['right'];
  return [];
}

function createDerivedStreetSideFeature(args: {
  feature: StreetDesignOsmFeature;
  kind: 'sidewalk' | 'bike_lane' | 'parking';
  side: 'left' | 'right';
  widthMeters: number;
  offsetMeters: number;
  subkind?: string;
}) {
  const { feature, kind, side, widthMeters, offsetMeters, subkind } = args;

  return {
    id: `${feature.id}:${subkind ?? kind}:${side}`,
    kind,
    geometryKind: 'line' as const,
    label: feature.label,
    points: feature.points ?? [],
    widthMeters,
    offsetMeters: side === 'right' ? offsetMeters : -offsetMeters,
    side,
    subkind,
    level: feature.level,
    access: feature.access,
    layerIndex: feature.layerIndex,
    elevationMeters: feature.elevationMeters,
    baseElevationMeters: feature.baseElevationMeters,
    deckElevationMeters: feature.deckElevationMeters,
    clearanceMeters: feature.clearanceMeters,
    incline: feature.incline,
    stepCount: feature.stepCount,
    structureKind: feature.structureKind,
    elevationSource: feature.elevationSource,
    tags: {
      ...(feature.tags ?? {}),
      'polity:derived_from': feature.id,
    },
    source: 'derived' as const,
  } satisfies StreetDesignOsmFeature;
}

function createDerivedStreetSideFeatures(feature: StreetDesignOsmFeature) {
  if (feature.kind !== 'road' || !feature.tags || !feature.points) return [];

  const tags = feature.tags;
  const sidewalkSides = collectSideValues(tags, 'sidewalk', new Set(['lane']));
  const cyclewaySides = collectCyclewaySides(tags);
  const parkingSides = collectParkingSides(tags);
  const loadingZoneSides = collectLoadingZoneSides(tags);

  return (['left', 'right'] as const).flatMap(side => {
    const bands: { kind: 'sidewalk' | 'bike_lane' | 'parking'; subkind?: string }[] = [];
    if (cyclewaySides.includes(side)) bands.push({ kind: 'bike_lane' });
    if (loadingZoneSides.includes(side)) {
      bands.push({ kind: 'parking', subkind: 'loading_zone' });
    } else if (parkingSides.includes(side)) {
      bands.push({ kind: 'parking' });
    }
    if (sidewalkSides.includes(side)) bands.push({ kind: 'sidewalk' });

    let outerEdge = (feature.widthMeters ?? getStreetDesignOsmRoadWidthMeters(tags)) / 2;
    return bands.map(band => {
      const widthMeters = getStreetDesignOsmSideWidthMeters({ tags, kind: band.kind, side });
      const offsetMeters = Math.round((outerEdge + 0.15 + widthMeters / 2) * 100) / 100;
      outerEdge = offsetMeters + widthMeters / 2;
      return createDerivedStreetSideFeature({
        feature,
        kind: band.kind,
        side,
        widthMeters,
        offsetMeters,
        subkind: band.subkind,
      });
    });
  });
}

export function normalizeOverpassPayload(
  bbox: StreetDesignBoundingBox,
  payload: OverpassPayload
): StreetDesignOsmSnapshot {
  const features: StreetDesignOsmFeature[] = [];

  (payload.elements ?? []).forEach(element => {
    const tags = element.tags ?? {};

    if (hasPointGeometry(element)) {
      const kind = classifyPoint(tags);
      if (!kind) return;
      const semanticUse = kind === 'building' ? getBuildingSemanticUse(tags) : undefined;
      const layerIndex = getFeatureLayerIndex(tags);
      const structureKind = getFeatureStructureKind(kind, tags);
      const clearanceMeters = getFeatureClearanceMeters(tags);
      const stepCount = getFeatureStepCount(tags);
      const deckElevationMeters = getFeatureDeckElevationMeters({
        kind,
        tags,
        layerIndex,
        structureKind,
        clearanceMeters,
        stepCount,
      });
      features.push(
        applyStreetDesignOsmSemanticMapping({
          id: String(element.id),
          kind,
          geometryKind: 'point',
          label: getFeatureLabel(tags, kind),
          point: { lat: element.lat, lon: element.lon },
          subkind: getFeatureSubkind(kind, tags),
          semanticUse,
          renderColor: kind === 'building' ? getBuildingRenderColor(semanticUse) : undefined,
          renderVariant: tags.crossing ?? tags.traffic_calming ?? tags.public_transport,
          level: getFeatureLevel(tags),
          access: getFeatureAccess(tags),
          layerIndex,
          elevationMeters: parseFiniteNumber(tags.ele),
          baseElevationMeters: getFeatureBaseElevationMeters(structureKind),
          deckElevationMeters,
          clearanceMeters,
          incline: tags.incline,
          stepCount,
          structureKind,
          elevationSource: getFeatureElevationSource({ tags, deckElevationMeters, structureKind }),
          tags,
          source: 'osm',
        })
      );
      return;
    }

    const points = getElementGeometryPoints(element);
    if (!points) return;

    const kind = classifyWay(tags);
    if (!kind) return;

    const levels = Number(tags['building:levels']);
    const explicitHeight = Number.parseFloat(tags.height ?? '');
    const semanticUse = kind === 'building' ? getBuildingSemanticUse(tags) : undefined;
    const layerIndex = getFeatureLayerIndex(tags);
    const structureKind = getFeatureStructureKind(kind, tags);
    const clearanceMeters = getFeatureClearanceMeters(tags);
    const stepCount = getFeatureStepCount(tags);
    const deckElevationMeters = getFeatureDeckElevationMeters({
      kind,
      tags,
      layerIndex,
      structureKind,
      clearanceMeters,
      stepCount,
    });
    const height = Number.isFinite(explicitHeight)
      ? explicitHeight
      : Number.isFinite(levels)
        ? levels * 3
        : tags.building
          ? 9
          : undefined;
    const feature: StreetDesignOsmFeature = {
      id: element.type === 'relation' ? `relation/${element.id}` : String(element.id),
      kind,
      geometryKind: getFeatureGeometryKind(kind, points),
      label: getFeatureLabel(tags, kind),
      points,
      height,
      widthMeters: getFeatureWidthMeters(kind, tags),
      subkind: getFeatureSubkind(kind, tags),
      semanticUse,
      renderColor:
        kind === 'building'
          ? getBuildingRenderColor(semanticUse)
          : getFeatureRenderColor(kind, tags),
      renderVariant: tags.crossing ?? tags.traffic_calming ?? tags.surface,
      level: getFeatureLevel(tags),
      access: getFeatureAccess(tags),
      layerIndex,
      elevationMeters: parseFiniteNumber(tags.ele),
      baseElevationMeters: getFeatureBaseElevationMeters(structureKind),
      deckElevationMeters,
      clearanceMeters,
      incline: tags.incline,
      stepCount,
      structureKind,
      elevationSource: getFeatureElevationSource({ tags, deckElevationMeters, structureKind }),
      tags,
      source: 'osm',
    };

    const mappedFeature = applyStreetDesignOsmSemanticMapping(feature);
    features.push(mappedFeature);
    features.push(
      ...createDerivedStreetSideFeatures(mappedFeature).map(applyStreetDesignOsmSemanticMapping)
    );
  });

  return {
    fetchedAt: Date.now(),
    bbox,
    features,
    ways: features,
  };
}

function createFallbackSnapshot(bbox: StreetDesignBoundingBox): StreetDesignOsmSnapshot {
  const centerLat = (bbox.south + bbox.north) / 2;
  const centerLon = (bbox.west + bbox.east) / 2;
  const latSpan = bbox.north - bbox.south;
  const lonSpan = bbox.east - bbox.west;
  const features: StreetDesignOsmFeature[] = [
    {
      id: 'fallback-road-main',
      kind: 'road',
      geometryKind: 'line',
      label: 'Strassenachse',
      widthMeters: 4.8,
      points: [
        { lat: centerLat - latSpan * 0.42, lon: centerLon - lonSpan * 0.42 },
        { lat: centerLat + latSpan * 0.42, lon: centerLon + lonSpan * 0.42 },
      ],
      tags: { source: 'fallback' },
      source: 'fallback',
    },
    {
      id: 'fallback-green',
      kind: 'green',
      geometryKind: 'polygon',
      label: 'Gruenflaeche',
      points: [
        { lat: centerLat + latSpan * 0.12, lon: centerLon - lonSpan * 0.42 },
        { lat: centerLat + latSpan * 0.34, lon: centerLon - lonSpan * 0.22 },
        { lat: centerLat + latSpan * 0.2, lon: centerLon - lonSpan * 0.04 },
        { lat: centerLat, lon: centerLon - lonSpan * 0.22 },
        { lat: centerLat + latSpan * 0.12, lon: centerLon - lonSpan * 0.42 },
      ],
      tags: { source: 'fallback' },
      source: 'fallback',
    },
    {
      id: 'fallback-building',
      kind: 'building',
      geometryKind: 'polygon',
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
      source: 'fallback',
    },
  ];

  return {
    fetchedAt: Date.now(),
    bbox,
    features,
    ways: features,
  };
}

async function fetchOverpassSnapshot(bbox: StreetDesignBoundingBox) {
  const body = new URLSearchParams({ data: buildOverpassQuery(bbox) }).toString();

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
        continue;
      }

      const payload = (await response.json()) as OverpassPayload;
      return normalizeOverpassPayload(bbox, payload);
    } catch {
      continue;
    }
  }

  return createFallbackSnapshot(bbox);
}

export const overpassStreetSceneFn = createServerFn({ method: 'POST' })
  .validator(streetSceneSchema.parse)
  .handler(async ({ data }) => {
    assertSmallBoundingBox(data.bbox);
    return fetchOverpassSnapshot(data.bbox);
  });
