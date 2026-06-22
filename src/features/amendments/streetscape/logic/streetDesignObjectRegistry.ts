import type { StreetDesignObjectDefinition, StreetDesignObjectType } from '../types';

export const STREET_DESIGN_CURRENCY = 'EUR';
export const STREET_DESIGN_COST_CATALOG_VERSION = '2026-06-mvp';

export const streetDesignObjectRegistry = {
  tree: {
    type: 'tree',
    labelKey: 'features.amendments.streetscape.objects.tree.label',
    icon: 'TreePine',
    category: 'greenery',
    geometryKind: 'point',
    defaultProperties: {
      species: 'stadtbaum',
      height: 4,
      canopyDiameter: 3,
      spacing: 6,
    },
    propertySchema: [
      {
        key: 'species',
        labelKey: 'features.amendments.streetscape.objects.tree.properties.species',
        fieldType: 'text',
      },
      {
        key: 'height',
        labelKey: 'features.amendments.streetscape.objects.common.properties.height',
        fieldType: 'number',
        unit: 'm',
        min: 1,
        step: 0.5,
      },
      {
        key: 'canopyDiameter',
        labelKey: 'features.amendments.streetscape.objects.tree.properties.canopyDiameter',
        fieldType: 'number',
        unit: 'm',
        min: 0.5,
        step: 0.5,
      },
      {
        key: 'spacing',
        labelKey: 'features.amendments.streetscape.objects.common.properties.spacing',
        fieldType: 'number',
        unit: 'm',
        min: 2,
        step: 0.5,
      },
    ],
    costRule: 'per_item',
    suggestedUnitCostMinor: 45000,
    renderKind: 'tree',
    toolMode: 'path',
    defaultWidth: 1.8,
    color: '#3f7d3b',
  },
  bush: {
    type: 'bush',
    labelKey: 'features.amendments.streetscape.objects.bush.label',
    icon: 'Shrub',
    category: 'greenery',
    geometryKind: 'point',
    defaultProperties: {
      species: 'strauch',
      diameter: 1.4,
      height: 1.2,
      spacing: 1.5,
    },
    propertySchema: [
      {
        key: 'species',
        labelKey: 'features.amendments.streetscape.objects.bush.properties.species',
        fieldType: 'text',
      },
      {
        key: 'diameter',
        labelKey: 'features.amendments.streetscape.objects.bush.properties.diameter',
        fieldType: 'number',
        unit: 'm',
        min: 0.3,
        step: 0.1,
      },
      {
        key: 'height',
        labelKey: 'features.amendments.streetscape.objects.common.properties.height',
        fieldType: 'number',
        unit: 'm',
        min: 0.2,
        step: 0.1,
      },
      {
        key: 'spacing',
        labelKey: 'features.amendments.streetscape.objects.common.properties.spacing',
        fieldType: 'number',
        unit: 'm',
        min: 0.4,
        step: 0.1,
      },
    ],
    costRule: 'per_item',
    suggestedUnitCostMinor: 8500,
    renderKind: 'bush',
    toolMode: 'path',
    defaultWidth: 1.2,
    color: '#5c8f46',
  },
  bank: {
    type: 'bank',
    labelKey: 'features.amendments.streetscape.objects.bank.label',
    icon: 'Armchair',
    category: 'furniture',
    geometryKind: 'point',
    defaultProperties: {
      material: 'holz',
      seats: 3,
    },
    propertySchema: [
      {
        key: 'material',
        labelKey: 'features.amendments.streetscape.objects.common.properties.material',
        fieldType: 'text',
      },
      {
        key: 'seats',
        labelKey: 'features.amendments.streetscape.objects.bank.properties.seats',
        fieldType: 'number',
        min: 1,
        step: 1,
      },
    ],
    costRule: 'per_item',
    suggestedUnitCostMinor: 120000,
    renderKind: 'bench',
    toolMode: 'point',
    color: '#8a6a42',
  },
  grass_strip: {
    type: 'grass_strip',
    labelKey: 'features.amendments.streetscape.objects.grassStrip.label',
    icon: 'Sprout',
    category: 'greenery',
    geometryKind: 'corridor',
    defaultProperties: {
      material: 'rasen',
      maintenance: 'standard',
    },
    propertySchema: [
      {
        key: 'material',
        labelKey: 'features.amendments.streetscape.objects.common.properties.material',
        fieldType: 'text',
      },
      {
        key: 'maintenance',
        labelKey: 'features.amendments.streetscape.objects.common.properties.maintenance',
        fieldType: 'text',
      },
    ],
    costRule: 'per_square_meter',
    suggestedUnitCostMinor: 1200,
    renderKind: 'surface',
    toolMode: 'path',
    defaultWidth: 2,
    color: '#79a857',
  },
  flower_bed: {
    type: 'flower_bed',
    labelKey: 'features.amendments.streetscape.objects.flowerBed.label',
    icon: 'Flower2',
    category: 'greenery',
    geometryKind: 'corridor',
    defaultProperties: {
      planting: 'staudenmix',
      maintenance: 'intensiv',
    },
    propertySchema: [
      {
        key: 'planting',
        labelKey: 'features.amendments.streetscape.objects.flowerBed.properties.planting',
        fieldType: 'text',
      },
      {
        key: 'maintenance',
        labelKey: 'features.amendments.streetscape.objects.common.properties.maintenance',
        fieldType: 'text',
      },
    ],
    costRule: 'per_square_meter',
    suggestedUnitCostMinor: 8000,
    renderKind: 'surface',
    toolMode: 'path',
    defaultWidth: 1.6,
    color: '#c95f8a',
  },
  water_area: {
    type: 'water_area',
    labelKey: 'features.amendments.streetscape.objects.waterArea.label',
    icon: 'Waves',
    category: 'water',
    geometryKind: 'corridor',
    defaultProperties: {
      waterType: 'retention',
      edge: 'naturnah',
    },
    propertySchema: [
      {
        key: 'waterType',
        labelKey: 'features.amendments.streetscape.objects.waterArea.properties.waterType.label',
        fieldType: 'select',
        options: [
          {
            labelKey:
              'features.amendments.streetscape.objects.waterArea.properties.waterType.options.retention',
            value: 'retention',
          },
          {
            labelKey:
              'features.amendments.streetscape.objects.waterArea.properties.waterType.options.pond',
            value: 'pond',
          },
          {
            labelKey:
              'features.amendments.streetscape.objects.waterArea.properties.waterType.options.stream',
            value: 'stream',
          },
        ],
      },
      {
        key: 'edge',
        labelKey: 'features.amendments.streetscape.objects.waterArea.properties.edge.label',
        fieldType: 'select',
        options: [
          {
            labelKey:
              'features.amendments.streetscape.objects.waterArea.properties.edge.options.natural',
            value: 'naturnah',
          },
          {
            labelKey:
              'features.amendments.streetscape.objects.waterArea.properties.edge.options.framed',
            value: 'gefasst',
          },
          {
            labelKey:
              'features.amendments.streetscape.objects.waterArea.properties.edge.options.seatingEdge',
            value: 'sitzkante',
          },
        ],
      },
    ],
    costRule: 'per_square_meter',
    suggestedUnitCostMinor: 6000,
    renderKind: 'surface',
    toolMode: 'path',
    defaultWidth: 4,
    color: '#4f9ed9',
  },
  parking_area: {
    type: 'parking_area',
    labelKey: 'features.amendments.streetscape.objects.parkingArea.label',
    icon: 'ParkingSquare',
    category: 'mobility',
    geometryKind: 'corridor',
    defaultProperties: {
      parkingSpaces: 4,
      orientation: 'parallel',
    },
    propertySchema: [
      {
        key: 'parkingSpaces',
        labelKey: 'features.amendments.streetscape.objects.parkingArea.properties.parkingSpaces',
        fieldType: 'number',
        min: 1,
        step: 1,
      },
      {
        key: 'orientation',
        labelKey:
          'features.amendments.streetscape.objects.parkingArea.properties.orientation.label',
        fieldType: 'select',
        options: [
          {
            labelKey:
              'features.amendments.streetscape.objects.parkingArea.properties.orientation.options.parallel',
            value: 'parallel',
          },
          {
            labelKey:
              'features.amendments.streetscape.objects.parkingArea.properties.orientation.options.angled',
            value: 'angled',
          },
          {
            labelKey:
              'features.amendments.streetscape.objects.parkingArea.properties.orientation.options.perpendicular',
            value: 'perpendicular',
          },
        ],
      },
    ],
    costRule: 'per_parking_space',
    suggestedUnitCostMinor: 350000,
    renderKind: 'parking',
    toolMode: 'drag-band',
    defaultWidth: 2.5,
    color: '#7f8da3',
  },
  street: {
    type: 'street',
    labelKey: 'features.amendments.streetscape.objects.street.label',
    icon: 'Route',
    category: 'street',
    geometryKind: 'corridor',
    defaultProperties: {
      surface: 'asphalt',
      lanes: 2,
    },
    propertySchema: [
      {
        key: 'surface',
        labelKey: 'features.amendments.streetscape.objects.common.properties.surface',
        fieldType: 'text',
      },
      {
        key: 'lanes',
        labelKey: 'features.amendments.streetscape.objects.street.properties.lanes',
        fieldType: 'number',
        min: 1,
        step: 1,
      },
    ],
    costRule: 'per_square_meter',
    suggestedUnitCostMinor: 18000,
    renderKind: 'road',
    toolMode: 'path',
    defaultWidth: 6.5,
    color: '#4e565c',
  },
  car_lane: {
    type: 'car_lane',
    labelKey: 'features.amendments.streetscape.objects.carLane.label',
    icon: 'CarFront',
    category: 'street',
    geometryKind: 'corridor',
    defaultProperties: {
      direction: 'one_way',
      surface: 'asphalt',
    },
    propertySchema: [
      {
        key: 'direction',
        labelKey: 'features.amendments.streetscape.objects.carLane.properties.direction.label',
        fieldType: 'select',
        options: [
          {
            labelKey:
              'features.amendments.streetscape.objects.carLane.properties.direction.options.oneWay',
            value: 'one_way',
          },
          {
            labelKey:
              'features.amendments.streetscape.objects.carLane.properties.direction.options.twoWay',
            value: 'two_way',
          },
        ],
      },
      {
        key: 'surface',
        labelKey: 'features.amendments.streetscape.objects.common.properties.surface',
        fieldType: 'text',
      },
    ],
    costRule: 'per_square_meter',
    suggestedUnitCostMinor: 13000,
    renderKind: 'lane',
    toolMode: 'path',
    defaultWidth: 3.25,
    color: '#586069',
  },
  bike_lane: {
    type: 'bike_lane',
    labelKey: 'features.amendments.streetscape.objects.bikeLane.label',
    icon: 'Bike',
    category: 'mobility',
    geometryKind: 'corridor',
    defaultProperties: {
      protection: 'markiert',
      surface: 'asphalt',
    },
    propertySchema: [
      {
        key: 'protection',
        labelKey: 'features.amendments.streetscape.objects.bikeLane.properties.protection',
        fieldType: 'text',
      },
      {
        key: 'surface',
        labelKey: 'features.amendments.streetscape.objects.common.properties.surface',
        fieldType: 'text',
      },
    ],
    costRule: 'per_square_meter',
    suggestedUnitCostMinor: 9000,
    renderKind: 'lane',
    toolMode: 'path',
    defaultWidth: 2,
    color: '#2f8f87',
  },
  sidewalk: {
    type: 'sidewalk',
    labelKey: 'features.amendments.streetscape.objects.sidewalk.label',
    icon: 'Footprints',
    category: 'mobility',
    geometryKind: 'corridor',
    defaultProperties: {
      surface: 'pflaster',
      accessibility: true,
    },
    propertySchema: [
      {
        key: 'surface',
        labelKey: 'features.amendments.streetscape.objects.common.properties.surface',
        fieldType: 'text',
      },
      {
        key: 'accessibility',
        labelKey: 'features.amendments.streetscape.objects.sidewalk.properties.accessibility',
        fieldType: 'boolean',
      },
    ],
    costRule: 'per_square_meter',
    suggestedUnitCostMinor: 11000,
    renderKind: 'surface',
    toolMode: 'path',
    defaultWidth: 2.4,
    color: '#c8bda7',
  },
  building: {
    type: 'building',
    labelKey: 'features.amendments.streetscape.objects.building.label',
    icon: 'Building2',
    category: 'building',
    geometryKind: 'corridor',
    defaultProperties: {
      height: 9,
      floors: 3,
      color: '#b6aa9b',
      use: 'mixed',
    },
    propertySchema: [
      {
        key: 'height',
        labelKey: 'features.amendments.streetscape.objects.common.properties.height',
        fieldType: 'number',
        unit: 'm',
        min: 1,
        step: 0.5,
      },
      {
        key: 'floors',
        labelKey: 'features.amendments.streetscape.objects.building.properties.floors',
        fieldType: 'number',
        min: 1,
        step: 1,
      },
      {
        key: 'color',
        labelKey: 'features.amendments.streetscape.objects.building.properties.color.label',
        fieldType: 'select',
        options: [
          {
            labelKey:
              'features.amendments.streetscape.objects.building.properties.color.options.sand',
            value: '#b6aa9b',
          },
          {
            labelKey:
              'features.amendments.streetscape.objects.building.properties.color.options.brick',
            value: '#b46b55',
          },
          {
            labelKey:
              'features.amendments.streetscape.objects.building.properties.color.options.slate',
            value: '#6f7a82',
          },
          {
            labelKey:
              'features.amendments.streetscape.objects.building.properties.color.options.blue',
            value: '#7aa0bd',
          },
          {
            labelKey:
              'features.amendments.streetscape.objects.building.properties.color.options.green',
            value: '#8ba77f',
          },
        ],
      },
      {
        key: 'use',
        labelKey: 'features.amendments.streetscape.objects.building.properties.use.label',
        fieldType: 'select',
        options: [
          {
            labelKey:
              'features.amendments.streetscape.objects.building.properties.use.options.mixed',
            value: 'mixed',
          },
          {
            labelKey:
              'features.amendments.streetscape.objects.building.properties.use.options.residential',
            value: 'residential',
          },
          {
            labelKey:
              'features.amendments.streetscape.objects.building.properties.use.options.commercial',
            value: 'commercial',
          },
          {
            labelKey:
              'features.amendments.streetscape.objects.building.properties.use.options.civic',
            value: 'civic',
          },
        ],
      },
    ],
    costRule: 'per_square_meter',
    suggestedUnitCostMinor: 250000,
    renderKind: 'building',
    toolMode: 'path',
    defaultWidth: 10,
    color: '#b6aa9b',
  },
} satisfies Record<StreetDesignObjectType, StreetDesignObjectDefinition>;

export const streetDesignObjectTypes = Object.keys(
  streetDesignObjectRegistry
) as StreetDesignObjectType[];

export function getStreetDesignObjectDefinition(
  type: StreetDesignObjectType
): StreetDesignObjectDefinition {
  return streetDesignObjectRegistry[type];
}
