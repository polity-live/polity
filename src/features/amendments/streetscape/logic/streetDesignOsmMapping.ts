import type {
  StreetDesignObjectType,
  StreetDesignOsmFeature,
  StreetDesignOsmMappingConfidence,
  StreetDesignOsmRenderProfile,
  StreetDesignPropertyValue,
} from '../types';

export interface StreetDesignOsmSemanticMapping {
  objectType: StreetDesignObjectType | null;
  properties: Record<string, StreetDesignPropertyValue>;
  confidence: StreetDesignOsmMappingConfidence;
  renderProfile: StreetDesignOsmRenderProfile;
}

const ROAD_CLASS_BY_HIGHWAY: Record<string, string> = {
  motorway: 'primary',
  trunk: 'primary',
  primary: 'primary',
  secondary: 'primary',
  living_street: 'living_street',
  pedestrian: 'pedestrian',
  construction: 'construction',
};

function finiteNumber(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function integer(value: string | undefined) {
  const parsed = finiteNumber(value);
  return parsed == null ? undefined : Math.max(0, Math.round(parsed));
}

function stringValue(value: string | undefined) {
  return value && value.length > 0 ? value : undefined;
}

function compactProperties(
  properties: Record<string, StreetDesignPropertyValue | undefined>
): Record<string, StreetDesignPropertyValue> {
  return Object.fromEntries(
    Object.entries(properties).filter(
      (entry): entry is [string, StreetDesignPropertyValue] => entry[1] !== undefined
    )
  );
}

function sideTag(tags: Record<string, string>, key: string, side?: 'left' | 'right') {
  if (!side) return tags[key];
  return tags[`${key}:${side}`] ?? tags[`${key}:both`] ?? tags[key];
}

function sidePropertyTag(
  tags: Record<string, string>,
  prefix: string,
  property: string,
  side?: 'left' | 'right'
) {
  if (!side) return tags[`${prefix}:${property}`] ?? tags[property];
  return (
    tags[`${prefix}:${side}:${property}`] ??
    tags[`${prefix}:both:${property}`] ??
    tags[`${prefix}:${property}`] ??
    tags[property]
  );
}

export function getStreetDesignOsmRoadWidthMeters(tags: Record<string, string>) {
  const explicitWidth = finiteNumber(tags['width:carriageway'] ?? tags.width);
  if (explicitWidth && explicitWidth > 0) return explicitWidth;

  const lanes = integer(tags.lanes);
  if (lanes && lanes > 0) return Math.max(3.1, lanes * 3.25);

  switch (tags.highway) {
    case 'motorway':
    case 'trunk':
      return 7.2;
    case 'primary':
    case 'secondary':
      return 6.5;
    case 'service':
    case 'track':
      return 3.5;
    case 'living_street':
      return 4.5;
    default:
      return 4.8;
  }
}

export function getStreetDesignOsmSideWidthMeters(args: {
  tags: Record<string, string>;
  kind: 'sidewalk' | 'bike_lane' | 'parking';
  side: 'left' | 'right';
}) {
  const { tags, kind, side } = args;
  const explicit = finiteNumber(
    sidePropertyTag(tags, kind === 'bike_lane' ? 'cycleway' : kind, 'width', side)
  );
  if (explicit && explicit > 0) return explicit;

  if (kind === 'sidewalk') return 2.4;
  if (kind === 'bike_lane') {
    const cycleway = sideTag(tags, 'cycleway', side);
    return cycleway === 'track' || cycleway === 'sidepath' ? 2.4 : 1.8;
  }

  const orientation = sidePropertyTag(tags, 'parking', 'orientation', side);
  if (orientation === 'perpendicular') return 4.8;
  if (orientation === 'diagonal') return 3.6;
  return 2.3;
}

export function getStreetDesignOsmSemanticMapping(
  feature: Pick<
    StreetDesignOsmFeature,
    'kind' | 'geometryKind' | 'subkind' | 'tags' | 'source' | 'semanticUse' | 'level' | 'side'
  >
): StreetDesignOsmSemanticMapping {
  const tags = feature.tags ?? {};
  const confidence: StreetDesignOsmMappingConfidence =
    feature.source === 'derived' ? 'derived' : Object.keys(tags).length > 0 ? 'exact' : 'generic';
  const base = (
    objectType: StreetDesignObjectType | null,
    renderProfile: StreetDesignOsmRenderProfile,
    properties: Record<string, StreetDesignPropertyValue | undefined> = {}
  ): StreetDesignOsmSemanticMapping => ({
    objectType,
    renderProfile,
    properties: compactProperties(properties),
    confidence: objectType ? confidence : 'generic',
  });

  switch (feature.kind) {
    case 'road':
      return base('street', 'road', {
        roadClass: ROAD_CLASS_BY_HIGHWAY[tags.highway] ?? 'residential',
        lanes:
          integer(tags.lanes) ??
          Math.max(1, Math.round(getStreetDesignOsmRoadWidthMeters(tags) / 3.25)),
        direction: tags.oneway === 'yes' || tags.oneway === '1' ? 'one_way' : 'two_way',
        surface: stringValue(tags.surface) ?? 'asphalt',
        maxspeed: finiteNumber(tags.maxspeed),
        turnLanes: stringValue(tags['turn:lanes']),
        busLanes: integer(tags['lanes:bus']),
        taxiLanes: integer(tags['lanes:taxi']),
        laneMarkings: tags.lane_markings !== 'no',
        access: stringValue(tags.access) ?? 'public',
        level: feature.level ?? 'surface',
        status: tags.highway === 'construction' ? 'construction' : 'open',
      });
    case 'sidewalk':
      if (feature.subkind === 'steps') {
        return base('stairs', 'tactile', {
          steps: integer(tags.step_count ?? tags.steps) ?? 6,
          incline: stringValue(tags.incline) ?? 'up',
          material: stringValue(tags.surface) ?? 'beton',
          tactilePaving: tags.tactile_paving === 'yes',
        });
      }
      return base('sidewalk', tags.tactile_paving === 'yes' ? 'tactile' : 'sidewalk', {
        surface:
          stringValue(sidePropertyTag(tags, 'sidewalk', 'surface', feature.side)) ??
          stringValue(tags.surface) ??
          'pflaster',
        pathType: tags.highway === 'pedestrian' ? 'promenade' : 'sidewalk',
        accessibility: tags.wheelchair !== 'no',
        tactilePaving: tags.tactile_paving === 'yes',
        lit: tags.lit === 'yes',
      });
    case 'bike_lane': {
      const cycleway = sideTag(tags, 'cycleway', feature.side);
      return base('bike_lane', 'bike_lane', {
        protection: cycleway === 'track' || tags.segregated === 'yes' ? 'protected' : 'painted',
        surface: stringValue(tags.surface) ?? 'asphalt',
        direction: tags.oneway === '-1' || tags['oneway:bicycle'] === '-1' ? 'backward' : 'forward',
        segregated: tags.segregated === 'yes',
      });
    }
    case 'parking': {
      const loading = feature.subkind === 'loading_zone';
      return base(loading ? 'loading_zone' : 'parking_area', loading ? 'loading_zone' : 'parking', {
        orientation:
          (sidePropertyTag(tags, 'parking', 'orientation', feature.side) ?? tags.orientation) ===
          'diagonal'
            ? 'angled'
            : (sidePropertyTag(tags, 'parking', 'orientation', feature.side) ??
              tags.orientation ??
              'parallel'),
        restriction: loading
          ? 'loading_only'
          : (sidePropertyTag(tags, 'parking', 'restriction', feature.side) ?? tags.restriction),
        parkingSpaces: integer(tags.capacity),
        disabledSpaces: integer(tags['capacity:disabled']),
        chargingSpaces: integer(tags['capacity:charging']),
        surface: stringValue(tags.surface) ?? 'asphalt',
      });
    }
    case 'tree':
    case 'tree_row':
      return base('tree', 'green', {
        species: stringValue(tags.species) ?? stringValue(tags.genus) ?? 'stadtbaum',
        height: finiteNumber(tags.height) ?? 4,
        spacing: finiteNumber(tags.spacing) ?? 6,
      });
    case 'building':
      return base('building', 'building', {
        use: feature.semanticUse ?? 'mixed',
        levels: integer(tags['building:levels']),
        height: finiteNumber(tags.height),
      });
    case 'rail':
      return base('rail_track', 'road', {
        railType:
          tags.railway === 'light_rail' ? 'light_rail' : tags.railway === 'rail' ? 'rail' : 'tram',
        level: feature.level ?? 'surface',
      });
    case 'transit':
      if (tags.railway === 'subway_entrance') {
        return base('building_entrance', 'transit', {
          entranceType: 'transit',
          wheelchair: tags.wheelchair !== 'no',
        });
      }
      if (feature.geometryKind !== 'point' || tags.railway === 'platform') {
        return base('station_platform', 'transit', {
          platformType:
            tags.railway === 'platform'
              ? 'rail_platform'
              : tags.tram === 'yes'
                ? 'tram_stop'
                : 'bus_platform',
          shelter: tags.shelter === 'yes',
          wheelchair: tags.wheelchair !== 'no',
        });
      }
      return base('bus_stop', 'transit', {
        transportMode: tags.tram === 'yes' || tags.railway === 'tram_stop' ? 'tram' : 'bus',
        shelter: tags.shelter !== 'no',
        bench: tags.bench === 'yes',
        wheelchair: tags.wheelchair !== 'no',
      });
    case 'barrier':
      if (feature.subkind === 'kerb')
        return base('kerb', 'barrier', {
          kerbType: tags.kerb ?? 'raised',
          tactilePaving: tags.tactile_paving === 'yes',
        });
      if (feature.subkind === 'hedge') return base('hedge', 'green');
      if (feature.subkind === 'wall')
        return base('wall', 'barrier', { material: tags.material ?? 'stein' });
      if (feature.subkind === 'fence')
        return base('fence', 'barrier', { material: tags.material ?? 'metall' });
      if (
        feature.subkind === 'gate' ||
        feature.subkind === 'lift_gate' ||
        feature.subkind === 'cycle_barrier'
      ) {
        return base('gate', 'barrier', { gateType: feature.subkind });
      }
      return base('bollard', 'barrier', { bollardType: feature.subkind ?? 'fixed' });
    case 'traffic':
      if (tags['area:highway'] === 'traffic_island' || tags.traffic_calming === 'island') {
        return base('traffic_island', 'crossing', {
          islandType: tags['crossing:island'] === 'yes' ? 'refuge' : 'calming',
          surface: tags.surface ?? 'paving_stones',
        });
      }
      if (feature.subkind === 'crossing') {
        return base('crossing', 'crossing', {
          crossingType:
            tags['crossing:island'] === 'yes'
              ? 'refuge'
              : tags.crossing === 'traffic_signals'
                ? 'signalized'
                : 'zebra',
          tactilePaving: tags.tactile_paving === 'yes',
          kerbType: tags.kerb,
        });
      }
      if (tags.traffic_calming)
        return base('traffic_calming', 'crossing', { calmingType: tags.traffic_calming });
      if (tags.highway === 'stop' || tags.highway === 'give_way' || tags.traffic_sign) {
        return base('traffic_sign', 'utility', {
          signType: tags.highway ?? tags.traffic_sign,
          direction: tags.direction,
        });
      }
      return base('traffic_signal', 'utility', { signalType: tags.traffic_signals ?? 'vehicle' });
    case 'street_furniture':
      if (feature.subkind === 'street_lamp') return base('street_lamp', 'utility');
      if (feature.subkind === 'bicycle_parking')
        return base('bicycle_parking', 'utility', { stands: integer(tags.capacity) ?? 6 });
      return base('bank', 'utility', { material: tags.material ?? 'holz' });
    case 'utility':
      if (tags.entrance)
        return base('building_entrance', 'utility', {
          entranceType: tags.entrance,
          wheelchair: tags.wheelchair !== 'no',
        });
      if (feature.subkind === 'fire_hydrant') return base('hydrant', 'utility');
      if (feature.subkind === 'post_box') return base('post_box', 'utility');
      if (feature.subkind === 'recycling') return base('recycling_container', 'utility');
      if (feature.subkind === 'waste_basket') return base('waste_bin', 'utility');
      if (feature.subkind === 'charging_station')
        return base('charging_station', 'utility', { capacity: integer(tags.capacity) ?? 2 });
      if (feature.subkind === 'toilets')
        return base('public_toilet', 'utility', { wheelchair: tags.wheelchair !== 'no' });
      if (feature.subkind === 'taxi')
        return base('taxi_stand', 'parking', { capacity: integer(tags.capacity) });
      return base('fountain', 'water');
    case 'water':
      return feature.geometryKind === 'point'
        ? base('fountain', 'water', {
            waterType: tags.amenity === 'drinking_water' ? 'drinking' : 'decorative',
          })
        : base(feature.subkind === 'wetland' ? 'wetland_area' : 'water_area', 'water', {
            intermittent: tags.intermittent === 'yes',
          });
    case 'green': {
      const type: StreetDesignObjectType =
        feature.subkind === 'scrub'
          ? 'scrub_area'
          : feature.subkind === 'heath'
            ? 'heath_area'
            : feature.subkind === 'flower_bed'
              ? 'flower_bed'
              : feature.subkind === 'orchard'
                ? 'orchard_area'
                : feature.subkind === 'vineyard'
                  ? 'vineyard_area'
                  : 'grass_strip';
      return base(type, 'green', { surface: tags.surface });
    }
    case 'playground':
      return base('playground', 'green', { surface: tags.surface, equipment: tags.playground });
    case 'sports':
      return base('sports_pitch', 'green', { sport: tags.sport ?? 'multi', surface: tags.surface });
    case 'construction':
      return base('construction_area', 'public_space', {
        status: 'construction',
        surface: tags.surface ?? 'unsealed',
      });
    case 'civic_area':
      return base('civic_area', 'public_space', { civicType: tags.amenity ?? 'community_center' });
    case 'landuse_context':
      if (
        tags.place === 'square' ||
        tags.amenity === 'marketplace' ||
        tags.highway === 'pedestrian'
      ) {
        return base('public_space', 'public_space', {
          publicSpaceType: tags.amenity === 'marketplace' ? 'marketplace' : 'square',
          surface: tags.surface ?? 'paving_stones',
        });
      }
      return base('landuse_context_area', 'public_space', { landuseType: tags.landuse ?? 'mixed' });
    default:
      return base(null, 'utility');
  }
}

export function applyStreetDesignOsmSemanticMapping(
  feature: StreetDesignOsmFeature
): StreetDesignOsmFeature {
  const mapping = getStreetDesignOsmSemanticMapping(feature);
  return {
    ...feature,
    ...(mapping.objectType ? { mappedObjectType: mapping.objectType } : {}),
    mappedProperties: mapping.properties,
    mappingConfidence: mapping.confidence,
    renderProfile: mapping.renderProfile,
  };
}
