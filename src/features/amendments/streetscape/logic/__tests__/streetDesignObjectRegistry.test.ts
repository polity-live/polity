import { describe, expect, it } from 'vitest';
import {
  getStreetDesignObjectDefinition,
  streetDesignObjectRegistry,
  streetDesignObjectTypes,
} from '../streetDesignObjectRegistry';
import { streetDesignPropertyOptions } from '../streetDesignVariantCatalog';

describe('streetDesignObjectRegistry', () => {
  it('defines all MVP object types with required editor metadata', () => {
    expect(streetDesignObjectTypes).toEqual([
      'tree',
      'bush',
      'bank',
      'grass_strip',
      'flower_bed',
      'scrub_area',
      'heath_area',
      'orchard_area',
      'vineyard_area',
      'water_area',
      'wetland_area',
      'parking_area',
      'loading_zone',
      'street',
      'car_lane',
      'bike_lane',
      'sidewalk',
      'building',
      'street_lamp',
      'hydrant',
      'bicycle_parking',
      'bollard',
      'gate',
      'fence',
      'wall',
      'traffic_signal',
      'crossing',
      'traffic_calming',
      'bus_stop',
      'rail_track',
      'station_platform',
      'playground',
      'sports_pitch',
      'waste_bin',
      'recycling_container',
      'post_box',
      'fountain',
      'stairs',
      'hedge',
      'construction_area',
      'landuse_context_area',
      'civic_area',
      'kerb',
      'traffic_sign',
      'traffic_island',
      'public_space',
      'building_entrance',
      'charging_station',
      'public_toilet',
      'taxi_stand',
    ]);

    for (const type of streetDesignObjectTypes) {
      const definition = getStreetDesignObjectDefinition(type);
      expect(definition.type).toBe(type);
      expect(definition.labelKey).toBeTruthy();
      expect(definition.icon).toBeTruthy();
      expect(definition.renderKind).toBeTruthy();
      expect(definition.toolMode).toBeTruthy();
      expect(definition.costRule).toMatch(
        /^(per_item|per_meter|per_square_meter|per_parking_space)$/
      );
      expect(definition.defaultProperties).toBeTypeOf('object');
      expect(definition.propertySchema).toBeInstanceOf(Array);
      expect(definition.suggestedUnitCostMinor).toBeGreaterThan(0);
    }
  });

  it('uses combobox schemas with suggestions for free-form string attributes', () => {
    for (const type of streetDesignObjectTypes) {
      const definition = getStreetDesignObjectDefinition(type);

      for (const field of definition.propertySchema) {
        expect(field.fieldType).not.toBe('text');
        if (field.fieldType === 'combobox') {
          expect(field.options?.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('offers the tree species used by placeable tree variants', () => {
    const speciesField = streetDesignObjectRegistry.tree.propertySchema.find(
      field => field.key === 'species'
    );

    expect(speciesField?.fieldType).toBe('combobox');
    expect(speciesField?.options?.map(option => option.value)).toEqual(
      expect.arrayContaining([
        'deciduous',
        'conifer',
        'fruit',
        'columnar_poplar',
        'ornamental_cherry',
        'flowering_plum',
      ])
    );
  });

  it('uses point geometry for single objects and corridor geometry for drag-band elements', () => {
    expect(streetDesignObjectRegistry.tree.geometryKind).toBe('point');
    expect(streetDesignObjectRegistry.bush.geometryKind).toBe('point');
    expect(streetDesignObjectRegistry.bank.geometryKind).toBe('point');
    expect(streetDesignObjectRegistry.street_lamp.geometryKind).toBe('point');
    expect(streetDesignObjectRegistry.hydrant.geometryKind).toBe('point');
    expect(streetDesignObjectRegistry.bollard.geometryKind).toBe('point');
    expect(streetDesignObjectRegistry.gate.geometryKind).toBe('point');
    expect(streetDesignObjectRegistry.traffic_signal.geometryKind).toBe('point');
    expect(streetDesignObjectRegistry.bus_stop.geometryKind).toBe('point');
    expect(streetDesignObjectRegistry.waste_bin.geometryKind).toBe('point');
    expect(streetDesignObjectRegistry.recycling_container.geometryKind).toBe('point');
    expect(streetDesignObjectRegistry.post_box.geometryKind).toBe('point');
    expect(streetDesignObjectRegistry.fountain.geometryKind).toBe('point');

    expect(streetDesignObjectRegistry.grass_strip.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.flower_bed.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.scrub_area.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.heath_area.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.orchard_area.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.vineyard_area.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.water_area.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.wetland_area.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.parking_area.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.loading_zone.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.street.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.car_lane.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.bike_lane.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.sidewalk.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.building.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.bicycle_parking.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.fence.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.wall.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.crossing.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.traffic_calming.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.rail_track.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.station_platform.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.playground.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.sports_pitch.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.stairs.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.hedge.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.construction_area.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.landuse_context_area.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.civic_area.geometryKind).toBe('corridor');
  });

  it('uses path tools for curved greenery, water, buildings, and streets', () => {
    expect(streetDesignObjectRegistry.tree.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.bush.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.grass_strip.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.flower_bed.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.scrub_area.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.heath_area.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.orchard_area.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.vineyard_area.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.water_area.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.wetland_area.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.street.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.car_lane.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.bike_lane.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.sidewalk.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.building.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.parking_area.toolMode).toBe('drag-band');
    expect(streetDesignObjectRegistry.loading_zone.toolMode).toBe('drag-band');
    expect(streetDesignObjectRegistry.bicycle_parking.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.rail_track.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.station_platform.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.playground.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.sports_pitch.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.stairs.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.hedge.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.construction_area.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.landuse_context_area.toolMode).toBe('path');
    expect(streetDesignObjectRegistry.civic_area.toolMode).toBe('path');
  });

  it('exposes editable elevation properties for bridge and viaduct-capable objects', () => {
    for (const type of ['street', 'car_lane', 'bike_lane', 'sidewalk', 'rail_track'] as const) {
      const definition = streetDesignObjectRegistry[type];
      const schemaKeys = definition.propertySchema.map(field => field.key);
      const structureKindField = definition.propertySchema.find(
        field => field.key === 'structureKind'
      );

      expect(definition.defaultProperties.layerIndex).toBe(0);
      expect(definition.defaultProperties.deckElevationMeters).toBe(0);
      expect(definition.defaultProperties.structureKind).toBe('surface');
      expect(structureKindField?.options).toBe(streetDesignPropertyOptions.structureKind);
      expect(structureKindField?.options?.map(option => option.value)).toEqual([
        'surface',
        'bridge',
        'viaduct',
        'embankment',
        'tunnel',
      ]);
      expect(schemaKeys).toEqual(
        expect.arrayContaining(['layerIndex', 'deckElevationMeters', 'structureKind'])
      );
    }

    expect(streetDesignObjectRegistry.stairs.defaultProperties.deckElevationMeters).toBe(1);
    expect(streetDesignObjectRegistry.stairs.defaultProperties.incline).toBe('up');
    expect(streetDesignObjectRegistry.stairs.propertySchema.map(field => field.key)).toEqual(
      expect.arrayContaining(['incline', 'deckElevationMeters'])
    );

    const stationPlatformSchema = streetDesignObjectRegistry.station_platform.propertySchema;
    expect(streetDesignObjectRegistry.station_platform.defaultProperties.deckElevationMeters).toBe(
      0
    );
    expect(stationPlatformSchema.map(field => field.key)).toEqual(
      expect.arrayContaining(['platformType', 'shelter', 'deckElevationMeters'])
    );
    expect(
      stationPlatformSchema
        .find(field => field.key === 'platformType')
        ?.options?.map(option => option.value)
    ).toEqual(expect.arrayContaining(['bus_platform', 'tram_stop', 'rail_platform']));
  });
});
