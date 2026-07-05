import type {
  StreetDesignObject,
  StreetDesignObjectType,
  StreetDesignPropertyValue,
} from '../types';
import {
  getStreetDesignBuildingUseProperties,
  streetDesignBuildingUses,
} from './streetDesignBuildingUse';

export interface StreetDesignVariantToolDefinition {
  id: string;
  objectType: StreetDesignObjectType;
  labelKey: string;
  propertyOverrides?: Record<string, StreetDesignPropertyValue>;
  selectionPropertyKeys?: string[];
  widthOverride?: number;
}

export interface StreetDesignPropertyOption {
  labelKey: string;
  value: string;
}

const variantOption = (group: string, value: string): StreetDesignPropertyOption => ({
  labelKey: `features.amendments.streetscape.variantOptions.${group}.${value}`,
  value,
});

const variantLabelKey = (group: string, value: string) =>
  `features.amendments.streetscape.variantLabels.${group}.${value}`;

const stringProperty = (
  properties: Record<string, StreetDesignPropertyValue>,
  key: string,
  fallback: string
) => {
  const value = properties[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
};

const createVariantTool = (args: {
  objectType: StreetDesignObjectType;
  variantGroup: string;
  value: string;
  propertyOverrides?: Record<string, StreetDesignPropertyValue>;
  selectionPropertyKeys?: string[];
  widthOverride?: number;
}): StreetDesignVariantToolDefinition => ({
  id: `${args.objectType}-${args.value}`,
  objectType: args.objectType,
  labelKey: variantLabelKey(args.variantGroup, args.value),
  propertyOverrides: args.propertyOverrides,
  selectionPropertyKeys: args.selectionPropertyKeys,
  widthOverride: args.widthOverride,
});

const createPropertyVariantTools = (args: {
  objectType: StreetDesignObjectType;
  variantGroup: string;
  propertyKey: string;
  values: string[];
  widthByValue?: Partial<Record<string, number>>;
  extraPropertiesByValue?: Partial<Record<string, Record<string, StreetDesignPropertyValue>>>;
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

export const streetDesignPropertyOptions = {
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
  platformType: ['tram_stop', 'rail_platform'].map(value => variantOption('platformType', value)),
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
} satisfies Record<string, StreetDesignPropertyOption[]>;

const buildingTools = streetDesignBuildingUses.map(use =>
  createVariantTool({
    objectType: 'building',
    variantGroup: 'building',
    value: use,
    propertyOverrides: getStreetDesignBuildingUseProperties(use),
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

export const streetDesignVariantToolsBySection = {
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
    ...createPropertyVariantTools({
      objectType: 'car_lane',
      variantGroup: 'carLane',
      propertyKey: 'direction',
      values: ['one_way', 'two_way'],
      widthByValue: { one_way: 3.25, two_way: 6.5 },
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
  ],
  bike_lane: createPropertyVariantTools({
    objectType: 'bike_lane',
    variantGroup: 'bikeLane',
    propertyKey: 'protection',
    values: ['painted', 'protected', 'raised'],
    widthByValue: { protected: 2.2, raised: 2.4 },
  }),
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
  rail: createPropertyVariantTools({
    objectType: 'rail_track',
    variantGroup: 'rail',
    propertyKey: 'railType',
    values: ['tram', 'light_rail', 'rail'],
    widthByValue: { light_rail: 2, rail: 2.4 },
  }),
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
      propertyOverrides: { platformType: 'tram_stop', shelter: true },
      selectionPropertyKeys: ['platformType'],
    }),
    createVariantTool({
      objectType: 'station_platform',
      variantGroup: 'transit',
      value: 'rail_platform',
      propertyOverrides: { platformType: 'rail_platform', shelter: true },
      selectionPropertyKeys: ['platformType'],
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
} satisfies Partial<Record<string, StreetDesignVariantToolDefinition[]>>;

const knownVariantValues = {
  bikeLane: ['painted', 'protected', 'raised'],
  building: streetDesignBuildingUses,
  carLane: ['one_way', 'two_way'],
  civic: ['school', 'library', 'townhall', 'hospital', 'community_center'],
  construction: ['planned', 'active', 'closed'],
  crossing: ['zebra', 'signalized', 'raised', 'refuge'],
  fountain: ['drinking', 'decorative', 'splash'],
  landuse: ['commercial', 'residential', 'mixed', 'civic', 'industrial', 'retail', 'green'],
  loadingZone: ['loading_only', 'delivery_window', 'short_stop'],
  parking: ['parallel', 'angled', 'perpendicular'],
  playground: ['mixed', 'climbing', 'swings', 'sand', 'inclusive'],
  rail: ['tram', 'light_rail', 'rail'],
  sidewalk: ['standard', 'accessible', 'promenade', 'sidewalk'],
  sports: ['multi', 'football', 'basketball', 'skate', 'fitness'],
  street: ['residential', 'primary', 'living_street', 'pedestrian', 'construction'],
  trafficCalming: ['table', 'hump', 'chicane', 'narrowing'],
  trafficSignal: ['vehicle', 'pedestrian', 'bicycle'],
  transit: ['bus_stop', 'sheltered_bus_stop', 'tram_platform', 'rail_platform'],
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
  object: Pick<StreetDesignObject, 'properties'>,
  group: keyof typeof knownVariantValues,
  propertyKey: string,
  fallback: string
) => knownVariantLabelKey(group, stringProperty(object.properties, propertyKey, fallback));

const normalizedTreeSpecies = (object: Pick<StreetDesignObject, 'properties'>) => {
  const species = stringProperty(object.properties, 'species', 'deciduous').trim().toLowerCase();
  if (species === 'stadtbaum' || species === 'allee' || species === 'native') return 'deciduous';
  if (species === 'obstbaum') return 'fruit';
  if (species === 'zierkirsche' || species === 'japanese_cherry') return 'ornamental_cherry';
  if (species === 'pflaume' || species === 'plum') return 'flowering_plum';
  return species;
};

type StreetDesignVariantLabelInput = Pick<StreetDesignObject, 'type' | 'properties'>;

const labelLookup: Partial<
  Record<StreetDesignObjectType, (object: StreetDesignVariantLabelInput) => string | null>
> = {
  bike_lane: object => propertyVariantLabelKey(object, 'bikeLane', 'protection', 'painted'),
  building: object => propertyVariantLabelKey(object, 'building', 'use', 'mixed'),
  bus_stop: object =>
    knownVariantLabelKey(
      'transit',
      object.properties.shelter === false ? 'bus_stop' : 'sheltered_bus_stop'
    ),
  car_lane: object => propertyVariantLabelKey(object, 'carLane', 'direction', 'one_way'),
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
  rail_track: object => propertyVariantLabelKey(object, 'rail', 'railType', 'tram'),
  sidewalk: object => propertyVariantLabelKey(object, 'sidewalk', 'pathType', 'standard'),
  sports_pitch: object => propertyVariantLabelKey(object, 'sports', 'sport', 'multi'),
  station_platform: object => {
    const platformType = stringProperty(object.properties, 'platformType', 'tram_stop');
    return knownVariantLabelKey(
      'transit',
      platformType === 'rail_platform' ? 'rail_platform' : 'tram_platform'
    );
  },
  street: object => {
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

export function getStreetDesignVariantLabelKey(
  type: StreetDesignObjectType,
  properties: Record<string, StreetDesignPropertyValue>
) {
  return labelLookup[type]?.({ type, properties }) ?? null;
}

export function getStreetDesignObjectVariantLabelKey(object: StreetDesignObject) {
  return getStreetDesignVariantLabelKey(object.type, object.properties);
}
