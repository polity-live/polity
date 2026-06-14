import type { StreetDesignObjectDefinition, StreetDesignObjectType } from '../types';

export const STREET_DESIGN_CURRENCY = 'EUR';
export const STREET_DESIGN_COST_CATALOG_VERSION = '2026-06-mvp';

export const streetDesignObjectRegistry = {
  tree: {
    type: 'tree',
    label: 'Baum',
    icon: 'TreePine',
    category: 'greenery',
    geometryKind: 'point',
    defaultProperties: {
      species: 'stadtbaum',
      height: 4,
      canopyDiameter: 3,
    },
    propertySchema: [
      { key: 'species', label: 'Art', fieldType: 'text' },
      { key: 'height', label: 'Hoehe', fieldType: 'number', unit: 'm', min: 1, step: 0.5 },
      {
        key: 'canopyDiameter',
        label: 'Kronendurchmesser',
        fieldType: 'number',
        unit: 'm',
        min: 0.5,
        step: 0.5,
      },
    ],
    costRule: 'per_item',
    suggestedUnitCostMinor: 45000,
    renderKind: 'tree',
    toolMode: 'point',
    color: '#3f7d3b',
  },
  bush: {
    type: 'bush',
    label: 'Busch',
    icon: 'Shrub',
    category: 'greenery',
    geometryKind: 'point',
    defaultProperties: {
      species: 'strauch',
      diameter: 1.4,
      height: 1.2,
    },
    propertySchema: [
      { key: 'species', label: 'Art', fieldType: 'text' },
      {
        key: 'diameter',
        label: 'Durchmesser',
        fieldType: 'number',
        unit: 'm',
        min: 0.3,
        step: 0.1,
      },
      { key: 'height', label: 'Hoehe', fieldType: 'number', unit: 'm', min: 0.2, step: 0.1 },
    ],
    costRule: 'per_item',
    suggestedUnitCostMinor: 8500,
    renderKind: 'bush',
    toolMode: 'point',
    color: '#5c8f46',
  },
  bank: {
    type: 'bank',
    label: 'Bank',
    icon: 'Armchair',
    category: 'furniture',
    geometryKind: 'point',
    defaultProperties: {
      material: 'holz',
      seats: 3,
    },
    propertySchema: [
      { key: 'material', label: 'Material', fieldType: 'text' },
      { key: 'seats', label: 'Sitzplaetze', fieldType: 'number', min: 1, step: 1 },
    ],
    costRule: 'per_item',
    suggestedUnitCostMinor: 120000,
    renderKind: 'bench',
    toolMode: 'point',
    color: '#8a6a42',
  },
  grass_strip: {
    type: 'grass_strip',
    label: 'Rasen',
    icon: 'Sprout',
    category: 'greenery',
    geometryKind: 'corridor',
    defaultProperties: {
      material: 'rasen',
      maintenance: 'standard',
    },
    propertySchema: [
      { key: 'material', label: 'Material', fieldType: 'text' },
      { key: 'maintenance', label: 'Pflege', fieldType: 'text' },
    ],
    costRule: 'per_square_meter',
    suggestedUnitCostMinor: 1200,
    renderKind: 'surface',
    toolMode: 'drag-band',
    defaultWidth: 2,
    color: '#79a857',
  },
  flower_bed: {
    type: 'flower_bed',
    label: 'Blumenbeet',
    icon: 'Flower2',
    category: 'greenery',
    geometryKind: 'corridor',
    defaultProperties: {
      planting: 'staudenmix',
      maintenance: 'intensiv',
    },
    propertySchema: [
      { key: 'planting', label: 'Bepflanzung', fieldType: 'text' },
      { key: 'maintenance', label: 'Pflege', fieldType: 'text' },
    ],
    costRule: 'per_square_meter',
    suggestedUnitCostMinor: 8000,
    renderKind: 'surface',
    toolMode: 'drag-band',
    defaultWidth: 1.6,
    color: '#c95f8a',
  },
  parking_area: {
    type: 'parking_area',
    label: 'Parkplatzflaeche',
    icon: 'ParkingSquare',
    category: 'mobility',
    geometryKind: 'corridor',
    defaultProperties: {
      parkingSpaces: 4,
      orientation: 'parallel',
    },
    propertySchema: [
      { key: 'parkingSpaces', label: 'Stellplaetze', fieldType: 'number', min: 1, step: 1 },
      {
        key: 'orientation',
        label: 'Ausrichtung',
        fieldType: 'select',
        options: [
          { label: 'Parallel', value: 'parallel' },
          { label: 'Schraeg', value: 'angled' },
          { label: 'Senkrecht', value: 'perpendicular' },
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
    label: 'Strasse',
    icon: 'Route',
    category: 'street',
    geometryKind: 'corridor',
    defaultProperties: {
      surface: 'asphalt',
      lanes: 2,
    },
    propertySchema: [
      { key: 'surface', label: 'Belag', fieldType: 'text' },
      { key: 'lanes', label: 'Spuren', fieldType: 'number', min: 1, step: 1 },
    ],
    costRule: 'per_square_meter',
    suggestedUnitCostMinor: 18000,
    renderKind: 'road',
    toolMode: 'drag-band',
    defaultWidth: 6.5,
    color: '#4e565c',
  },
  car_lane: {
    type: 'car_lane',
    label: 'Fahrspur',
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
        label: 'Richtung',
        fieldType: 'select',
        options: [
          { label: 'Eine Richtung', value: 'one_way' },
          { label: 'Beide Richtungen', value: 'two_way' },
        ],
      },
      { key: 'surface', label: 'Belag', fieldType: 'text' },
    ],
    costRule: 'per_square_meter',
    suggestedUnitCostMinor: 13000,
    renderKind: 'lane',
    toolMode: 'drag-band',
    defaultWidth: 3.25,
    color: '#586069',
  },
  bike_lane: {
    type: 'bike_lane',
    label: 'Radweg',
    icon: 'Bike',
    category: 'mobility',
    geometryKind: 'corridor',
    defaultProperties: {
      protection: 'markiert',
      surface: 'asphalt',
    },
    propertySchema: [
      { key: 'protection', label: 'Schutz', fieldType: 'text' },
      { key: 'surface', label: 'Belag', fieldType: 'text' },
    ],
    costRule: 'per_square_meter',
    suggestedUnitCostMinor: 9000,
    renderKind: 'lane',
    toolMode: 'drag-band',
    defaultWidth: 2,
    color: '#2f8f87',
  },
  sidewalk: {
    type: 'sidewalk',
    label: 'Gehweg',
    icon: 'Footprints',
    category: 'mobility',
    geometryKind: 'corridor',
    defaultProperties: {
      surface: 'pflaster',
      accessibility: true,
    },
    propertySchema: [
      { key: 'surface', label: 'Belag', fieldType: 'text' },
      { key: 'accessibility', label: 'Barrierearm', fieldType: 'boolean' },
    ],
    costRule: 'per_square_meter',
    suggestedUnitCostMinor: 11000,
    renderKind: 'surface',
    toolMode: 'drag-band',
    defaultWidth: 2.4,
    color: '#c8bda7',
  },
} satisfies Record<StreetDesignObjectType, StreetDesignObjectDefinition>;

export const streetDesignObjectTypes = Object.keys(
  streetDesignObjectRegistry
) as StreetDesignObjectType[];

export function getStreetDesignObjectDefinition(type: StreetDesignObjectType) {
  return streetDesignObjectRegistry[type];
}
