import type {
  CityDesignObjectType,
  CityDesignOsmLayerVisibility,
  CityDesignPropertyValue,
} from '../types';
import { cityDesignVariantToolsBySection } from './cityDesignVariantCatalog';

export type CityDesignElementSectionId = keyof CityDesignOsmLayerVisibility;

export type CityDesignElementSectionIcon =
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

export interface CityDesignElementSection {
  layer: CityDesignElementSectionId;
  labelKey: string;
  icon: CityDesignElementSectionIcon;
  objectTypes: CityDesignObjectType[];
  tools?: CityDesignElementTool[];
  propertyCoverage?: string[];
}

export interface CityDesignElementTool {
  id: string;
  objectType: CityDesignObjectType;
  labelKey?: string;
  propertyOverrides?: Record<string, CityDesignPropertyValue>;
  selectionPropertyKeys?: string[];
  widthOverride?: number;
}

export const cityDesignElementSections = [
  {
    layer: 'building',
    labelKey: 'features.amendments.cityDesign.osmLayers.building',
    icon: 'Building2',
    objectTypes: ['building', 'building_entrance'],
    tools: cityDesignVariantToolsBySection.building,
    propertyCoverage: ['building.semanticUse/use', 'building.renderColor/color'],
  },
  {
    layer: 'road',
    labelKey: 'features.amendments.cityDesign.osmLayers.road',
    icon: 'Route',
    objectTypes: ['street', 'car_lane'],
    tools: cityDesignVariantToolsBySection.road,
    propertyCoverage: ['street.roadClass', 'street.access', 'street.level', 'street.status'],
  },
  {
    layer: 'sidewalk',
    labelKey: 'features.amendments.cityDesign.osmLayers.sidewalk',
    icon: 'Footprints',
    objectTypes: ['sidewalk', 'stairs'],
    tools: cityDesignVariantToolsBySection.sidewalk,
    propertyCoverage: ['sidewalk.pathType'],
  },
  {
    layer: 'bike_lane',
    labelKey: 'features.amendments.cityDesign.osmLayers.bikeLane',
    icon: 'Bike',
    objectTypes: ['bike_lane'],
    tools: cityDesignVariantToolsBySection.bike_lane,
  },
  {
    layer: 'parking',
    labelKey: 'features.amendments.cityDesign.osmLayers.parking',
    icon: 'ParkingSquare',
    objectTypes: ['parking_area', 'loading_zone', 'taxi_stand'],
    tools: cityDesignVariantToolsBySection.parking,
  },
  {
    layer: 'trees',
    labelKey: 'features.amendments.cityDesign.osmLayers.trees',
    icon: 'TreePine',
    objectTypes: ['tree'],
    tools: cityDesignVariantToolsBySection.trees,
  },
  {
    layer: 'green',
    labelKey: 'features.amendments.cityDesign.osmLayers.green',
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
    labelKey: 'features.amendments.cityDesign.osmLayers.water',
    icon: 'Waves',
    objectTypes: ['water_area', 'wetland_area', 'fountain'],
    tools: cityDesignVariantToolsBySection.water,
    propertyCoverage: ['water_area.intermittent'],
  },
  {
    layer: 'rail',
    labelKey: 'features.amendments.cityDesign.osmLayers.rail',
    icon: 'Route',
    objectTypes: ['rail_track'],
    tools: cityDesignVariantToolsBySection.rail,
    propertyCoverage: ['rail_track.level'],
  },
  {
    layer: 'transit',
    labelKey: 'features.amendments.cityDesign.osmLayers.transit',
    icon: 'Route',
    objectTypes: ['bus_stop', 'station_platform'],
    tools: cityDesignVariantToolsBySection.transit,
  },
  {
    layer: 'barrier',
    labelKey: 'features.amendments.cityDesign.osmLayers.barrier',
    icon: 'Layers',
    objectTypes: ['bollard', 'gate', 'fence', 'wall', 'hedge', 'kerb'],
  },
  {
    layer: 'street_furniture',
    labelKey: 'features.amendments.cityDesign.osmLayers.streetFurniture',
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
    labelKey: 'features.amendments.cityDesign.osmLayers.traffic',
    icon: 'Highlighter',
    objectTypes: [
      'traffic_signal',
      'traffic_sign',
      'crossing',
      'traffic_calming',
      'traffic_island',
    ],
    tools: cityDesignVariantToolsBySection.traffic,
  },
  {
    layer: 'sports',
    labelKey: 'features.amendments.cityDesign.osmLayers.sports',
    icon: 'Sprout',
    objectTypes: ['playground', 'sports_pitch'],
    tools: cityDesignVariantToolsBySection.sports,
  },
  {
    layer: 'construction',
    labelKey: 'features.amendments.cityDesign.osmLayers.construction',
    icon: 'Highlighter',
    objectTypes: ['construction_area'],
    tools: cityDesignVariantToolsBySection.construction,
    propertyCoverage: ['street.status=construction'],
  },
  {
    layer: 'landuse_context',
    labelKey: 'features.amendments.cityDesign.osmLayers.landuseContext',
    icon: 'Layers',
    objectTypes: ['landuse_context_area', 'civic_area', 'public_space'],
    tools: cityDesignVariantToolsBySection.landuse_context,
  },
] satisfies CityDesignElementSection[];

export const cityDesignElementSectionLayers = cityDesignElementSections.map(
  section => section.layer
);

export const cityDesignAddableObjectTypes = cityDesignElementSections.flatMap(
  section => section.objectTypes
);
