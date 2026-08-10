import { describe, expect, it } from 'vitest';
import type { CityDesignCostRule, CityDesignObject } from '../../types';
import {
  getCityDesignCostLine,
  getCityDesignCostSummary,
  getCityDesignObjectQuantity,
  updateObjectUnitCost,
} from '../cityDesignCosting';
import {
  createCorridorCityDesignObject,
  createPathCorridorCityDesignObject,
  createPointCityDesignObject,
  createPolygonGeometry,
} from '../cityDesignPlacement';

const point = () =>
  createPointCityDesignObject({
    id: 'lamp',
    type: 'street_lamp',
    point: { x: 0, z: 0 },
  });

describe('cityDesignCosting A04 alternatives', () => {
  it('covers per-item defaults and non-planting path items', () => {
    const row = createPathCorridorCityDesignObject({
      id: 'bush-row',
      type: 'bush',
      points: [
        { x: 0, z: 0 },
        { x: 4, z: 0 },
      ],
      overrides: { properties: { spacing: Number.NaN } },
    });
    expect(getCityDesignObjectQuantity(row, 'per_item')).toBeGreaterThan(1);
    const pathLamp = { ...point(), geometry: row.geometry } as CityDesignObject;
    expect(getCityDesignObjectQuantity(pathLamp, 'per_item')).toBe(1);
  });

  it('covers every per-meter, area, parking, and unknown-rule geometry', () => {
    const corridor = createCorridorCityDesignObject({
      id: 'corridor',
      type: 'bike_lane',
      start: { x: 0, z: 0 },
      end: { x: 5, z: 0 },
      width: 2,
    });
    const path = createPathCorridorCityDesignObject({
      id: 'path',
      type: 'sidewalk',
      points: [
        { x: 0, z: 0 },
        { x: 5, z: 0 },
      ],
      width: 2,
    });
    const polygon = {
      ...point(),
      geometry: createPolygonGeometry([
        { x: 0, z: 0 },
        { x: 5, z: 0 },
        { x: 0, z: 5 },
      ]),
    } as CityDesignObject;
    const lamp = point();
    expect(getCityDesignObjectQuantity(corridor, 'per_meter')).toBe(5);
    expect(getCityDesignObjectQuantity(path, 'per_meter')).toBe(5);
    expect(getCityDesignObjectQuantity(lamp, 'per_meter')).toBe(0);
    expect(getCityDesignObjectQuantity(polygon, 'per_square_meter')).toBe(12.5);
    expect(getCityDesignObjectQuantity(lamp, 'per_square_meter')).toBe(0);
    expect(
      getCityDesignObjectQuantity(
        { ...corridor, properties: { parkingSpaces: 9 } },
        'per_parking_space'
      )
    ).toBe(9);
    expect(getCityDesignObjectQuantity(path, 'per_parking_space')).toBe(1);
    expect(getCityDesignObjectQuantity(polygon, 'per_parking_space')).toBe(1);
    expect(getCityDesignObjectQuantity(lamp, 'per_parking_space')).toBe(1);
    expect(getCityDesignObjectQuantity(lamp, 'unknown' as CityDesignCostRule)).toBe(0);
  });

  it('omits absent variant labels, merges same-category summaries, and resets prices', () => {
    const first = point();
    const second = { ...point(), id: 'lamp-2' };
    expect(getCityDesignCostLine(first).displayLabelKey).toBeUndefined();
    const summary = getCityDesignCostSummary([first, second], 'USD');
    expect(summary.currency).toBe('USD');
    expect(summary.categories).toHaveLength(1);
    expect(summary.categories[0].quantity).toBe(2);
    expect(updateObjectUnitCost(first, -10).cost.customUnitCostMinor).toBe(0);
    expect(updateObjectUnitCost(first, null).cost.customUnitCostMinor).toBeUndefined();
  });
});
