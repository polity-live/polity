import type { CityDesignObject, CityDesignObjectType, CityDesignPropertyValue } from '../types';
import {
  getCityDesignBuildingUseProperties,
  cityDesignBuildingUses,
} from './cityDesignBuildingUse';

export interface CityDesignVariantToolDefinition {
  id: string;
  objectType: CityDesignObjectType;
  labelKey: string;
  propertyOverrides?: Record<string, CityDesignPropertyValue>;
  selectionPropertyKeys?: string[];
  widthOverride?: number;
}

export interface CityDesignPropertyOption {
  labelKey: string;
  value: string;
}

const variantOption = (group: string, value: string): CityDesignPropertyOption => ({
  labelKey: `features.amendments.cityDesign.variantOptions.${group}.${value}`,
  value,
});

const variantLabelKey = (group: string, value: string) =>
  `features.amendments.cityDesign.variantLabels.${group}.${value}`;

const stringProperty = (
  properties: Record<string, CityDesignPropertyValue>,
  key: string,
  fallback: string
) => {
  const value = properties[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
};

const numberProperty = (
  properties: Record<string, CityDesignPropertyValue>,
  key: string,
  fallback: number
) => {
  const value = properties[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const createVariantTool = (args: {
  objectType: CityDesignObjectType;
  variantGroup: string;
  value: string;
  propertyOverrides?: Record<string, CityDesignPropertyValue>;
  selectionPropertyKeys?: string[];
  widthOverride?: number;
}): CityDesignVariantToolDefinition => ({
  id: `${args.objectType}-${args.value}`,
  objectType: args.objectType,
  labelKey: variantLabelKey(args.variantGroup, args.value),
  propertyOverrides: args.propertyOverrides,
  selectionPropertyKeys: args.selectionPropertyKeys,
  widthOverride: args.widthOverride,
});

const createPropertyVariantTools = (args: {
  objectType: CityDesignObjectType;
  variantGroup: string;
  propertyKey: string;
  values: string[];
  widthByValue?: Partial<Record<string, number>>;
  extraPropertiesByValue?: Partial<Record<string, Record<string, CityDesignPropertyValue>>>;
}) =>
  args.values.map(value =>
    createVariantTool({
      objectType: args.objectType,
      variantGroup: args.variantGroup,
      value,
      propertyOverrides: {
        [args.propertyKey]: value,
        ...(args.extraPropertiesByValue?.[value] ?? {}),
      },
      selectionPropertyKeys: [args.propertyKey],
      widthOverride: args.widthByValue?.[value],
    })
  );

export const cityDesignPropertyOptions = {
  access: ['public', 'private', 'destination', 'emergency'].map(value =>
    variantOption('access', value)
  ),
  calmingType: ['table', 'hump', 'chicane', 'narrowing'].map(value =>
    variantOption('calmingType', value)
  ),
  civicType: ['school', 'library', 'townhall', 'hospital', 'community_center'].map(value =>
    variantOption('civicType', value)
  ),
  crossingType: ['zebra', 'signalized', 'raised', 'refuge'].map(value =>
    variantOption('crossingType', value)
  ),
  crop: ['fruit', 'grapes', 'berries', 'nuts'].map(value => variantOption('crop', value)),
  equipment: ['mixed', 'climbing', 'swings', 'sand', 'inclusive'].map(value =>
    variantOption('equipment', value)
  ),
  fountainWaterType: ['drinking', 'decorative', 'splash'].map(value =>
    variantOption('fountainWaterType', value)
  ),
  incline: ['up', 'down'].map(value => variantOption('incline', value)),
  landuseType: ['commercial', 'residential', 'mixed', 'civic', 'industrial', 'retail', 'green'].map(
    value => variantOption('landuseType', value)
  ),
  level: ['surface', 'bridge', 'tunnel'].map(value => variantOption('level', value)),
  structureKind: ['surface', 'bridge', 'viaduct', 'embankment', 'tunnel'].map(value =>
    variantOption('structureKind', value)
  ),
  maintenance: ['standard', 'extensiv', 'intensiv'].map(value =>
    variantOption('maintenance', value)
  ),
  material: ['holz', 'stahl', 'metall', 'beton', 'stein', 'glas/papier', 'recycling'].map(value =>
    variantOption('material', value)
  ),
  operator: ['post', 'dhl', 'municipal'].map(value => variantOption('operator', value)),
  pathType: ['standard', 'accessible', 'promenade', 'sidewalk'].map(value =>
    variantOption('pathType', value)
  ),
  planting: ['staudenmix', 'scrub', 'heide', 'wildflowers', 'grasses', 'shrubs'].map(value =>
    variantOption('planting', value)
  ),
  platformType: ['bus_platform', 'tram_stop', 'rail_platform'].map(value =>
    variantOption('platformType', value)
  ),
  protection: ['painted', 'protected', 'raised'].map(value => variantOption('protection', value)),
  railType: ['tram', 'light_rail', 'rail'].map(value => variantOption('railType', value)),
  restriction: ['loading_only', 'delivery_window', 'short_stop'].map(value =>
    variantOption('restriction', value)
  ),
  roadClass: ['residential', 'primary', 'living_street', 'pedestrian', 'construction'].map(value =>
    variantOption('roadClass', value)
  ),
  signalType: ['vehicle', 'pedestrian', 'bicycle'].map(value => variantOption('signalType', value)),
  species: [
    'deciduous',
    'conifer',
    'fruit',
    'columnar_poplar',
    'ornamental_cherry',
    'flowering_plum',
    'stadtbaum',
    'allee',
    'obstbaum',
    'strauch',
    'hecke',
    'native',
  ].map(value => variantOption('species', value)),
  sport: ['multi', 'football', 'basketball', 'skate', 'fitness'].map(value =>
    variantOption('sport', value)
  ),
  status: ['open', 'planned', 'active', 'closed', 'construction'].map(value =>
    variantOption('status', value)
  ),
  surface: [
    'asphalt',
    'pflaster',
    'paving_stones',
    'fallschutz',
    'kunststoff',
    'unsealed',
    'gravel',
    'rasen',
  ].map(value => variantOption('surface', value)),
  wetlandType: ['reedbed', 'marsh', 'wet_meadow'].map(value => variantOption('wetlandType', value)),
} satisfies Record<string, CityDesignPropertyOption[]>;

const buildingTools = cityDesignBuildingUses.map(use =>
  createVariantTool({
    objectType: 'building',
    variantGroup: 'building',
    value: use,
    propertyOverrides: getCityDesignBuildingUseProperties(use),
    selectionPropertyKeys: ['use'],
  })
);

const treeTools = [
  createVariantTool({
    objectType: 'tree',
    variantGroup: 'tree',
    value: 'deciduous',
    propertyOverrides: { species: 'deciduous', height: 5, canopyDiameter: 3.5, spacing: 7 },
    selectionPropertyKeys: ['species'],
  }),
  createVariantTool({
    objectType: 'tree',
    variantGroup: 'tree',
    value: 'conifer',
    propertyOverrides: { species: 'conifer', height: 6, canopyDiameter: 2.8, spacing: 6 },
    selectionPropertyKeys: ['species'],
  }),
  createVariantTool({
    objectType: 'tree',
    variantGroup: 'tree',
    value: 'fruit',
    propertyOverrides: { species: 'fruit', height: 3.5, canopyDiameter: 3, spacing: 5 },
    selectionPropertyKeys: ['species'],
  }),
  createVariantTool({
    objectType: 'tree',
    variantGroup: 'tree',
    value: 'columnar_poplar',
    propertyOverrides: { species: 'columnar_poplar', height: 8, canopyDiameter: 1.8, spacing: 4 },
    selectionPropertyKeys: ['species'],
  }),
  createVariantTool({
    objectType: 'tree',
    variantGroup: 'tree',
    value: 'ornamental_cherry',
    propertyOverrides: { species: 'ornamental_cherry', height: 4, canopyDiameter: 3.4, spacing: 5 },
    selectionPropertyKeys: ['species'],
  }),
  createVariantTool({
    objectType: 'tree',
    variantGroup: 'tree',
    value: 'flowering_plum',
    propertyOverrides: { species: 'flowering_plum', height: 4.5, canopyDiameter: 3.2, spacing: 5 },
    selectionPropertyKeys: ['species'],
  }),
];

export const cityDesignVariantToolsBySection = {
  building: buildingTools,
  trees: treeTools,
  road: [
    ...createPropertyVariantTools({
      objectType: 'street',
      variantGroup: 'street',
      propertyKey: 'roadClass',
      values: ['residential', 'primary', 'living_street', 'pedestrian'],
      widthByValue: { primary: 8.5, living_street: 4.5, pedestrian: 5 },
      extraPropertiesByValue: {
        primary: { lanes: 2, status: 'open', surface: 'asphalt' },
        living_street: { lanes: 1, status: 'open', surface: 'paving_stones' },
        pedestrian: { lanes: 1, status: 'open', surface: 'paving_stones' },
      },
    }),
    createVariantTool({
      objectType: 'street',
      variantGroup: 'street',
      value: 'construction',
      propertyOverrides: {
        roadClass: 'construction',
        status: 'construction',
        surface: 'unsealed',
      },
      selectionPropertyKeys: ['status'],
      widthOverride: 6,
    }),
    createVariantTool({
      objectType: 'street',
      variantGroup: 'street',
      value: 'bridge',
      propertyOverrides: {
        deckElevationMeters: 3.5,
        layerIndex: 1,
        level: 'bridge',
        roadClass: 'residential',
        status: 'open',
        structureKind: 'bridge',
        surface: 'asphalt',
      },
      selectionPropertyKeys: ['structureKind'],
      widthOverride: 6,
    }),
    ...createPropertyVariantTools({
      objectType: 'car_lane',
      variantGroup: 'carLane',
      propertyKey: 'direction',
      values: ['one_way', 'two_way'],
      widthByValue: { one_way: 3.25, two_way: 6.5 },
    }),
    createVariantTool({
      objectType: 'car_lane',
      variantGroup: 'carLane',
      value: 'bus_lane',
      propertyOverrides: { direction: 'one_way', laneUse: 'bus' },
      selectionPropertyKeys: ['laneUse'],
      widthOverride: 3.25,
    }),
    createVariantTool({
      objectType: 'car_lane',
      variantGroup: 'carLane',
      value: 'taxi_lane',
      propertyOverrides: { direction: 'one_way', laneUse: 'taxi' },
      selectionPropertyKeys: ['laneUse'],
      widthOverride: 3.25,
    }),
    createVariantTool({
      objectType: 'car_lane',
      variantGroup: 'carLane',
      value: 'bridge',
      propertyOverrides: {
        deckElevationMeters: 3.5,
        direction: 'two_way',
        layerIndex: 1,
        level: 'bridge',
        status: 'open',
        structureKind: 'bridge',
        surface: 'asphalt',
      },
      selectionPropertyKeys: ['structureKind'],
      widthOverride: 6.5,
    }),
  ],
  sidewalk: [
    ...createPropertyVariantTools({
      objectType: 'sidewalk',
      variantGroup: 'sidewalk',
      propertyKey: 'pathType',
      values: ['standard', 'accessible', 'promenade'],
      widthByValue: { promenade: 4 },
      extraPropertiesByValue: {
        accessible: { accessibility: true },
        standard: { accessibility: false },
        promenade: { accessibility: true, surface: 'paving_stones' },
      },
    }),
    createVariantTool({
      objectType: 'stairs',
      variantGroup: 'stairs',
      value: 'standard',
      propertyOverrides: { material: 'beton' },
      selectionPropertyKeys: ['material'],
    }),
    createVariantTool({
      objectType: 'sidewalk',
      variantGroup: 'sidewalk',
      value: 'bridge',
      propertyOverrides: {
        deckElevationMeters: 3.2,
        layerIndex: 1,
        level: 'bridge',
        pathType: 'accessible',
        structureKind: 'bridge',
        surface: 'paving_stones',
      },
      selectionPropertyKeys: ['structureKind'],
      widthOverride: 2.4,
    }),
  ],
  bike_lane: [
    ...createPropertyVariantTools({
      objectType: 'bike_lane',
      variantGroup: 'bikeLane',
      propertyKey: 'protection',
      values: ['painted', 'protected', 'raised'],
      widthByValue: { protected: 2.2, raised: 2.4 },
    }),
    createVariantTool({
      objectType: 'bike_lane',
      variantGroup: 'bikeLane',
      value: 'bridge',
      propertyOverrides: {
        deckElevationMeters: 3.2,
        layerIndex: 1,
        level: 'bridge',
        protection: 'protected',
        structureKind: 'bridge',
      },
      selectionPropertyKeys: ['structureKind'],
      widthOverride: 2.2,
    }),
  ],
  parking: [
    ...createPropertyVariantTools({
      objectType: 'parking_area',
      variantGroup: 'parking',
      propertyKey: 'orientation',
      values: ['parallel', 'angled', 'perpendicular'],
      widthByValue: { angled: 4.2, perpendicular: 5.2 },
    }),
    createVariantTool({
      objectType: 'loading_zone',
      variantGroup: 'loadingZone',
      value: 'loading_only',
      propertyOverrides: { restriction: 'loading_only' },
      selectionPropertyKeys: ['restriction'],
    }),
  ],
  water: [
    ...createPropertyVariantTools({
      objectType: 'water_area',
      variantGroup: 'water',
      propertyKey: 'waterType',
      values: ['retention', 'pond', 'stream'],
      widthByValue: { stream: 2.4, pond: 6 },
    }),
    ...createPropertyVariantTools({
      objectType: 'wetland_area',
      variantGroup: 'wetland',
      propertyKey: 'wetlandType',
      values: ['reedbed', 'marsh', 'wet_meadow'],
    }),
    createVariantTool({
      objectType: 'fountain',
      variantGroup: 'fountain',
      value: 'decorative',
      propertyOverrides: { waterType: 'decorative' },
      selectionPropertyKeys: ['waterType'],
    }),
  ],
  rail: [
    ...createPropertyVariantTools({
      objectType: 'rail_track',
      variantGroup: 'rail',
      propertyKey: 'railType',
      values: ['tram', 'light_rail', 'rail'],
      widthByValue: { light_rail: 2, rail: 2.4 },
    }),
    createVariantTool({
      objectType: 'rail_track',
      variantGroup: 'rail',
      value: 'bridge',
      propertyOverrides: {
        deckElevationMeters: 5,
        layerIndex: 1,
        level: 'bridge',
        railType: 'rail',
        structureKind: 'bridge',
      },
      selectionPropertyKeys: ['structureKind'],
      widthOverride: 2.4,
    }),
    createVariantTool({
      objectType: 'rail_track',
      variantGroup: 'rail',
      value: 'viaduct',
      propertyOverrides: {
        deckElevationMeters: 7.5,
        layerIndex: 2,
        level: 'bridge',
        railType: 'rail',
        structureKind: 'viaduct',
      },
      selectionPropertyKeys: ['structureKind'],
      widthOverride: 2.4,
    }),
  ],
  transit: [
    createVariantTool({
      objectType: 'bus_stop',
      variantGroup: 'transit',
      value: 'bus_stop',
      propertyOverrides: { shelter: false },
      selectionPropertyKeys: ['shelter'],
    }),
    createVariantTool({
      objectType: 'bus_stop',
      variantGroup: 'transit',
      value: 'sheltered_bus_stop',
      propertyOverrides: { shelter: true },
      selectionPropertyKeys: ['shelter'],
    }),
    createVariantTool({
      objectType: 'station_platform',
      variantGroup: 'transit',
      value: 'tram_platform',
      propertyOverrides: { deckElevationMeters: 0, platformType: 'tram_stop', shelter: true },
      selectionPropertyKeys: ['platformType', 'deckElevationMeters'],
    }),
    createVariantTool({
      objectType: 'station_platform',
      variantGroup: 'transit',
      value: 'rail_platform',
      propertyOverrides: { deckElevationMeters: 0, platformType: 'rail_platform', shelter: true },
      selectionPropertyKeys: ['platformType', 'deckElevationMeters'],
    }),
    createVariantTool({
      objectType: 'station_platform',
      variantGroup: 'transit',
      value: 'elevated_sheltered_bus_stop',
      propertyOverrides: {
        deckElevationMeters: 0.32,
        platformType: 'bus_platform',
        shelter: true,
      },
      selectionPropertyKeys: ['platformType', 'deckElevationMeters', 'shelter'],
      widthOverride: 3,
    }),
    createVariantTool({
      objectType: 'station_platform',
      variantGroup: 'transit',
      value: 'elevated_sheltered_rail_stop',
      propertyOverrides: {
        deckElevationMeters: 0.48,
        platformType: 'rail_platform',
        shelter: true,
      },
      selectionPropertyKeys: ['platformType', 'deckElevationMeters', 'shelter'],
      widthOverride: 3.4,
    }),
  ],
  traffic: [
    ...createPropertyVariantTools({
      objectType: 'traffic_signal',
      variantGroup: 'trafficSignal',
      propertyKey: 'signalType',
      values: ['vehicle', 'pedestrian', 'bicycle'],
    }),
    ...createPropertyVariantTools({
      objectType: 'crossing',
      variantGroup: 'crossing',
      propertyKey: 'crossingType',
      values: ['zebra', 'signalized', 'raised', 'refuge'],
      widthByValue: { raised: 3.5, refuge: 4 },
    }),
    ...createPropertyVariantTools({
      objectType: 'traffic_calming',
      variantGroup: 'trafficCalming',
      propertyKey: 'calmingType',
      values: ['table', 'hump', 'chicane', 'narrowing'],
      widthByValue: { chicane: 4, narrowing: 2 },
    }),
  ],
  sports: [
    ...createPropertyVariantTools({
      objectType: 'playground',
      variantGroup: 'playground',
      propertyKey: 'equipment',
      values: ['mixed', 'climbing', 'swings', 'sand', 'inclusive'],
    }),
    ...createPropertyVariantTools({
      objectType: 'sports_pitch',
      variantGroup: 'sports',
      propertyKey: 'sport',
      values: ['multi', 'football', 'basketball', 'skate', 'fitness'],
    }),
  ],
  construction: createPropertyVariantTools({
    objectType: 'construction_area',
    variantGroup: 'construction',
    propertyKey: 'status',
    values: ['planned', 'active', 'closed'],
  }),
  landuse_context: [
    ...createPropertyVariantTools({
      objectType: 'landuse_context_area',
      variantGroup: 'landuse',
      propertyKey: 'landuseType',
      values: ['commercial', 'residential', 'mixed', 'civic', 'industrial', 'retail', 'green'],
    }),
    ...createPropertyVariantTools({
      objectType: 'civic_area',
      variantGroup: 'civic',
      propertyKey: 'civicType',
      values: ['school', 'library', 'townhall', 'hospital', 'community_center'],
    }),
  ],
} satisfies Partial<Record<string, CityDesignVariantToolDefinition[]>>;

const knownVariantValues = {
  bikeLane: ['painted', 'protected', 'raised', 'bridge'],
  building: cityDesignBuildingUses,
  carLane: ['one_way', 'two_way', 'bus_lane', 'taxi_lane', 'bridge'],
  civic: ['school', 'library', 'townhall', 'hospital', 'community_center'],
  construction: ['planned', 'active', 'closed'],
  crossing: ['zebra', 'signalized', 'raised', 'refuge'],
  fountain: ['drinking', 'decorative', 'splash'],
  landuse: ['commercial', 'residential', 'mixed', 'civic', 'industrial', 'retail', 'green'],
  loadingZone: ['loading_only', 'delivery_window', 'short_stop'],
  parking: ['parallel', 'angled', 'perpendicular'],
  playground: ['mixed', 'climbing', 'swings', 'sand', 'inclusive'],
  rail: ['tram', 'light_rail', 'rail', 'bridge', 'viaduct'],
  sidewalk: ['standard', 'accessible', 'promenade', 'sidewalk', 'bridge'],
  sports: ['multi', 'football', 'basketball', 'skate', 'fitness'],
  street: ['residential', 'primary', 'living_street', 'pedestrian', 'construction', 'bridge'],
  trafficCalming: ['table', 'hump', 'chicane', 'narrowing'],
  trafficSignal: ['vehicle', 'pedestrian', 'bicycle'],
  transit: [
    'bus_stop',
    'sheltered_bus_stop',
    'bus_platform',
    'tram_platform',
    'rail_platform',
    'elevated_sheltered_bus_stop',
    'elevated_sheltered_rail_stop',
  ],
  tree: ['deciduous', 'conifer', 'fruit', 'columnar_poplar', 'ornamental_cherry', 'flowering_plum'],
  water: ['retention', 'pond', 'stream'],
  wetland: ['reedbed', 'marsh', 'wet_meadow'],
} satisfies Record<string, readonly string[]>;

const knownVariantLabelKey = (
  group: keyof typeof knownVariantValues,
  value: string
): string | null =>
  (knownVariantValues[group] as readonly string[]).includes(value)
    ? variantLabelKey(group, value)
    : null;

const propertyVariantLabelKey = (
  object: Pick<CityDesignObject, 'properties'>,
  group: keyof typeof knownVariantValues,
  propertyKey: string,
  fallback: string
) => knownVariantLabelKey(group, stringProperty(object.properties, propertyKey, fallback));

const normalizedTreeSpecies = (object: Pick<CityDesignObject, 'properties'>) => {
  const species = stringProperty(object.properties, 'species', 'deciduous').trim().toLowerCase();
  if (species === 'stadtbaum' || species === 'allee' || species === 'native') return 'deciduous';
  if (species === 'obstbaum') return 'fruit';
  if (species === 'zierkirsche' || species === 'japanese_cherry') return 'ornamental_cherry';
  if (species === 'pflaume' || species === 'plum') return 'flowering_plum';
  return species;
};

type CityDesignVariantLabelInput = Pick<CityDesignObject, 'type' | 'properties'>;

const labelLookup: Partial<
  Record<CityDesignObjectType, (object: CityDesignVariantLabelInput) => string | null>
> = {
  bike_lane: object =>
    stringProperty(object.properties, 'structureKind', 'surface') === 'bridge'
      ? variantLabelKey('bikeLane', 'bridge')
      : propertyVariantLabelKey(object, 'bikeLane', 'protection', 'painted'),
  building: object => propertyVariantLabelKey(object, 'building', 'use', 'mixed'),
  bus_stop: object =>
    knownVariantLabelKey(
      'transit',
      object.properties.shelter === false ? 'bus_stop' : 'sheltered_bus_stop'
    ),
  car_lane: object =>
    stringProperty(object.properties, 'structureKind', 'surface') === 'bridge'
      ? variantLabelKey('carLane', 'bridge')
      : propertyVariantLabelKey(object, 'carLane', 'direction', 'one_way'),
  civic_area: object => propertyVariantLabelKey(object, 'civic', 'civicType', 'school'),
  construction_area: object => propertyVariantLabelKey(object, 'construction', 'status', 'planned'),
  crossing: object => propertyVariantLabelKey(object, 'crossing', 'crossingType', 'zebra'),
  fountain: object => propertyVariantLabelKey(object, 'fountain', 'waterType', 'decorative'),
  landuse_context_area: object =>
    propertyVariantLabelKey(object, 'landuse', 'landuseType', 'commercial'),
  loading_zone: object =>
    propertyVariantLabelKey(object, 'loadingZone', 'restriction', 'loading_only'),
  parking_area: object => propertyVariantLabelKey(object, 'parking', 'orientation', 'parallel'),
  playground: object => propertyVariantLabelKey(object, 'playground', 'equipment', 'mixed'),
  rail_track: object => {
    const structureKind = stringProperty(object.properties, 'structureKind', 'surface');
    if (structureKind === 'bridge') return variantLabelKey('rail', 'bridge');
    if (structureKind === 'viaduct') return variantLabelKey('rail', 'viaduct');
    return propertyVariantLabelKey(object, 'rail', 'railType', 'tram');
  },
  sidewalk: object =>
    stringProperty(object.properties, 'structureKind', 'surface') === 'bridge'
      ? variantLabelKey('sidewalk', 'bridge')
      : propertyVariantLabelKey(object, 'sidewalk', 'pathType', 'standard'),
  sports_pitch: object => propertyVariantLabelKey(object, 'sports', 'sport', 'multi'),
  station_platform: object => {
    const platformType = stringProperty(object.properties, 'platformType', 'tram_stop');
    const isElevated = numberProperty(object.properties, 'deckElevationMeters', 0) > 0.1;
    const isSheltered = object.properties.shelter !== false;
    if (platformType === 'bus_platform' && isElevated && isSheltered) {
      return knownVariantLabelKey('transit', 'elevated_sheltered_bus_stop');
    }
    if (platformType === 'rail_platform' && isElevated && isSheltered) {
      return knownVariantLabelKey('transit', 'elevated_sheltered_rail_stop');
    }
    return knownVariantLabelKey(
      'transit',
      platformType === 'rail_platform'
        ? 'rail_platform'
        : platformType === 'bus_platform'
          ? 'bus_platform'
          : 'tram_platform'
    );
  },
  street: object => {
    if (stringProperty(object.properties, 'structureKind', 'surface') === 'bridge') {
      return variantLabelKey('street', 'bridge');
    }
    const status = stringProperty(object.properties, 'status', 'open');
    if (status === 'construction') return variantLabelKey('street', 'construction');
    return propertyVariantLabelKey(object, 'street', 'roadClass', 'residential');
  },
  traffic_calming: object =>
    propertyVariantLabelKey(object, 'trafficCalming', 'calmingType', 'table'),
  traffic_signal: object =>
    propertyVariantLabelKey(object, 'trafficSignal', 'signalType', 'vehicle'),
  tree: object => knownVariantLabelKey('tree', normalizedTreeSpecies(object)),
  water_area: object => propertyVariantLabelKey(object, 'water', 'waterType', 'retention'),
  wetland_area: object => propertyVariantLabelKey(object, 'wetland', 'wetlandType', 'reedbed'),
};

export function getCityDesignVariantLabelKey(
  type: CityDesignObjectType,
  properties: Record<string, CityDesignPropertyValue>
) {
  return labelLookup[type]?.({ type, properties }) ?? null;
}

export function getCityDesignObjectVariantLabelKey(object: CityDesignObject) {
  return getCityDesignVariantLabelKey(object.type, object.properties);
}
