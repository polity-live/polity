import { describe, expect, it } from 'vitest';
import {
  getStreetDesignObjectDefinition,
  streetDesignObjectRegistry,
  streetDesignObjectTypes,
} from '../streetDesignObjectRegistry';

describe('streetDesignObjectRegistry', () => {
  it('defines all MVP object types with required editor metadata', () => {
    expect(streetDesignObjectTypes).toEqual([
      'tree',
      'bush',
      'bank',
      'grass_strip',
      'flower_bed',
      'parking_area',
      'street',
      'car_lane',
      'bike_lane',
      'sidewalk',
    ]);

    for (const type of streetDesignObjectTypes) {
      const definition = getStreetDesignObjectDefinition(type);
      expect(definition.type).toBe(type);
      expect(definition.label).toBeTruthy();
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

  it('uses point geometry for single objects and corridor geometry for drag-band elements', () => {
    expect(streetDesignObjectRegistry.tree.geometryKind).toBe('point');
    expect(streetDesignObjectRegistry.bush.geometryKind).toBe('point');
    expect(streetDesignObjectRegistry.bank.geometryKind).toBe('point');

    expect(streetDesignObjectRegistry.grass_strip.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.flower_bed.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.parking_area.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.street.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.car_lane.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.bike_lane.geometryKind).toBe('corridor');
    expect(streetDesignObjectRegistry.sidewalk.geometryKind).toBe('corridor');
  });
});
