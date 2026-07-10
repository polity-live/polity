import type {
  StreetDesignObjectType,
  StreetDesignOsmLayerVisibility,
  StreetDesignPropertyValue,
} from '../types';
import { streetDesignVariantToolsBySection } from './streetDesignVariantCatalog';

export type StreetDesignElementSectionId = keyof StreetDesignOsmLayerVisibility;

export type StreetDesignElementSectionIcon =
  | 'Armchair'
  | 'Bike'
  | 'Building2'
  | 'Footprints'
  | 'Highlighter'
  | 'Layers'
  | 'ParkingSquare'
  | 'Route'
  | 'Shrub'
  | 'Sprout'
  | 'TreePine'
  | 'Waves';

export interface StreetDesignElementSection {
  layer: StreetDesignElementSectionId;
  labelKey: string;
  icon: StreetDesignElementSectionIcon;
  objectTypes: StreetDesignObjectType[];
  tools?: StreetDesignElementTool[];
  propertyCoverage?: string[];
}

export interface StreetDesignElementTool {
  id: string;
  objectType: StreetDesignObjectType;
  labelKey?: string;
  propertyOverrides?: Record<string, StreetDesignPropertyValue>;
  selectionPropertyKeys?: string[];
  widthOverride?: number;
}

export const streetDesignElementSections = [
  {
    layer: 'building',
    labelKey: 'features.amendments.streetscape.osmLayers.building',
    icon: 'Building2',
    objectTypes: ['building', 'building_entrance'],
    tools: streetDesignVariantToolsBySection.building,
    propertyCoverage: ['building.semanticUse/use', 'building.renderColor/color'],
  },
  {
    layer: 'road',
    labelKey: 'features.amendments.streetscape.osmLayers.road',
    icon: 'Route',
    objectTypes: ['street', 'car_lane'],
    tools: streetDesignVariantToolsBySection.road,
    propertyCoverage: ['street.roadClass', 'street.access', 'street.level', 'street.status'],
  },
  {
    layer: 'sidewalk',
    labelKey: 'features.amendments.streetscape.osmLayers.sidewalk',
    icon: 'Footprints',
    objectTypes: ['sidewalk', 'stairs'],
    tools: streetDesignVariantToolsBySection.sidewalk,
    propertyCoverage: ['sidewalk.pathType'],
  },
  {
    layer: 'bike_lane',
    labelKey: 'features.amendments.streetscape.osmLayers.bikeLane',
    icon: 'Bike',
    objectTypes: ['bike_lane'],
    tools: streetDesignVariantToolsBySection.bike_lane,
  },
  {
    layer: 'parking',
    labelKey: 'features.amendments.streetscape.osmLayers.parking',
    icon: 'ParkingSquare',
    objectTypes: ['parking_area', 'loading_zone', 'taxi_stand'],
    tools: streetDesignVariantToolsBySection.parking,
  },
  {
    layer: 'trees',
    labelKey: 'features.amendments.streetscape.osmLayers.trees',
    icon: 'TreePine',
    objectTypes: ['tree'],
    tools: streetDesignVariantToolsBySection.trees,
  },
  {
    layer: 'green',
    labelKey: 'features.amendments.streetscape.osmLayers.green',
    icon: 'Sprout',
    objectTypes: [
      'grass_strip',
      'bush',
      'flower_bed',
      'scrub_area',
      'heath_area',
      'orchard_area',
      'vineyard_area',
    ],
  },
  {
    layer: 'water',
    labelKey: 'features.amendments.streetscape.osmLayers.water',
    icon: 'Waves',
    objectTypes: ['water_area', 'wetland_area', 'fountain'],
    tools: streetDesignVariantToolsBySection.water,
    propertyCoverage: ['water_area.intermittent'],
  },
  {
    layer: 'rail',
    labelKey: 'features.amendments.streetscape.osmLayers.rail',
    icon: 'Route',
    objectTypes: ['rail_track'],
    tools: streetDesignVariantToolsBySection.rail,
    propertyCoverage: ['rail_track.level'],
  },
  {
    layer: 'transit',
    labelKey: 'features.amendments.streetscape.osmLayers.transit',
    icon: 'Route',
    objectTypes: ['bus_stop', 'station_platform'],
    tools: streetDesignVariantToolsBySection.transit,
  },
  {
    layer: 'barrier',
    labelKey: 'features.amendments.streetscape.osmLayers.barrier',
    icon: 'Layers',
    objectTypes: ['bollard', 'gate', 'fence', 'wall', 'hedge', 'kerb'],
  },
  {
    layer: 'street_furniture',
    labelKey: 'features.amendments.streetscape.osmLayers.streetFurniture',
    icon: 'Armchair',
    objectTypes: [
      'bank',
      'street_lamp',
      'hydrant',
      'bicycle_parking',
      'waste_bin',
      'recycling_container',
      'post_box',
      'charging_station',
      'public_toilet',
    ],
  },
  {
    layer: 'traffic',
    labelKey: 'features.amendments.streetscape.osmLayers.traffic',
    icon: 'Highlighter',
    objectTypes: [
      'traffic_signal',
      'traffic_sign',
      'crossing',
      'traffic_calming',
      'traffic_island',
    ],
    tools: streetDesignVariantToolsBySection.traffic,
  },
  {
    layer: 'sports',
    labelKey: 'features.amendments.streetscape.osmLayers.sports',
    icon: 'Sprout',
    objectTypes: ['playground', 'sports_pitch'],
    tools: streetDesignVariantToolsBySection.sports,
  },
  {
    layer: 'construction',
    labelKey: 'features.amendments.streetscape.osmLayers.construction',
    icon: 'Highlighter',
    objectTypes: ['construction_area'],
    tools: streetDesignVariantToolsBySection.construction,
    propertyCoverage: ['street.status=construction'],
  },
  {
    layer: 'landuse_context',
    labelKey: 'features.amendments.streetscape.osmLayers.landuseContext',
    icon: 'Layers',
    objectTypes: ['landuse_context_area', 'civic_area', 'public_space'],
    tools: streetDesignVariantToolsBySection.landuse_context,
  },
] satisfies StreetDesignElementSection[];

export const streetDesignElementSectionLayers = streetDesignElementSections.map(
  section => section.layer
);

export const streetDesignAddableObjectTypes = streetDesignElementSections.flatMap(
  section => section.objectTypes
);
