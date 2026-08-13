import { describe, expect, it } from 'vitest';
import {
  getCityDesignObjectDefinition,
  cityDesignObjectRegistry,
  cityDesignObjectTypes,
} from '../cityDesignObjectRegistry';
import { cityDesignPropertyOptions } from '../cityDesignVariantCatalog';

describe('cityDesignObjectRegistry', () => {
  it('defines all MVP object types with required editor metadata', () => {
    expect(cityDesignObjectTypes).toEqual([
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

    for (const type of cityDesignObjectTypes) {
      const definition = getCityDesignObjectDefinition(type);
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
    for (const type of cityDesignObjectTypes) {
      const definition = getCityDesignObjectDefinition(type);

      for (const field of definition.propertySchema) {
        expect(field.fieldType).not.toBe('text');
        if (field.fieldType === 'combobox') {
          expect(field.options?.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('offers the tree species used by placeable tree variants', () => {
    const speciesField = cityDesignObjectRegistry.tree.propertySchema.find(
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
    expect(cityDesignObjectRegistry.tree.geometryKind).toBe('point');
    expect(cityDesignObjectRegistry.bush.geometryKind).toBe('point');
    expect(cityDesignObjectRegistry.bank.geometryKind).toBe('point');
    expect(cityDesignObjectRegistry.street_lamp.geometryKind).toBe('point');
    expect(cityDesignObjectRegistry.hydrant.geometryKind).toBe('point');
    expect(cityDesignObjectRegistry.bollard.geometryKind).toBe('point');
    expect(cityDesignObjectRegistry.gate.geometryKind).toBe('point');
    expect(cityDesignObjectRegistry.traffic_signal.geometryKind).toBe('point');
    expect(cityDesignObjectRegistry.bus_stop.geometryKind).toBe('point');
    expect(cityDesignObjectRegistry.waste_bin.geometryKind).toBe('point');
    expect(cityDesignObjectRegistry.recycling_container.geometryKind).toBe('point');
    expect(cityDesignObjectRegistry.post_box.geometryKind).toBe('point');
    expect(cityDesignObjectRegistry.fountain.geometryKind).toBe('point');

    expect(cityDesignObjectRegistry.grass_strip.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.flower_bed.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.scrub_area.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.heath_area.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.orchard_area.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.vineyard_area.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.water_area.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.wetland_area.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.parking_area.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.loading_zone.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.street.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.car_lane.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.bike_lane.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.sidewalk.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.building.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.bicycle_parking.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.fence.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.wall.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.crossing.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.traffic_calming.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.rail_track.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.station_platform.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.playground.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.sports_pitch.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.stairs.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.hedge.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.construction_area.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.landuse_context_area.geometryKind).toBe('corridor');
    expect(cityDesignObjectRegistry.civic_area.geometryKind).toBe('corridor');
  });

  it('uses path tools for curved greenery, water, buildings, and streets', () => {
    expect(cityDesignObjectRegistry.tree.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.bush.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.grass_strip.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.flower_bed.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.scrub_area.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.heath_area.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.orchard_area.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.vineyard_area.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.water_area.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.wetland_area.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.street.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.car_lane.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.bike_lane.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.sidewalk.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.building.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.parking_area.toolMode).toBe('drag-band');
    expect(cityDesignObjectRegistry.loading_zone.toolMode).toBe('drag-band');
    expect(cityDesignObjectRegistry.bicycle_parking.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.rail_track.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.station_platform.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.playground.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.sports_pitch.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.stairs.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.hedge.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.construction_area.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.landuse_context_area.toolMode).toBe('path');
    expect(cityDesignObjectRegistry.civic_area.toolMode).toBe('path');
  });

  it('exposes editable elevation properties for bridge and viaduct-capable objects', () => {
    for (const type of ['street', 'car_lane', 'bike_lane', 'sidewalk', 'rail_track'] as const) {
      const definition = cityDesignObjectRegistry[type];
      const schemaKeys = definition.propertySchema.map(field => field.key);
      const structureKindField = definition.propertySchema.find(
        field => field.key === 'structureKind'
      );

      expect(definition.defaultProperties.layerIndex).toBe(0);
      expect(definition.defaultProperties.deckElevationMeters).toBe(0);
      expect(definition.defaultProperties.structureKind).toBe('surface');
      expect(structureKindField?.options).toBe(cityDesignPropertyOptions.structureKind);
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

    expect(cityDesignObjectRegistry.stairs.defaultProperties.deckElevationMeters).toBe(1);
    expect(cityDesignObjectRegistry.stairs.defaultProperties.incline).toBe('up');
    expect(cityDesignObjectRegistry.stairs.propertySchema.map(field => field.key)).toEqual(
      expect.arrayContaining(['incline', 'deckElevationMeters'])
    );

    const stationPlatformSchema = cityDesignObjectRegistry.station_platform.propertySchema;
    expect(cityDesignObjectRegistry.station_platform.defaultProperties.deckElevationMeters).toBe(0);
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
