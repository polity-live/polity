import { describe, expect, it } from 'vitest';
import {
  getStreetDesignCostLine,
  getStreetDesignCostSummary,
  updateObjectUnitCost,
} from '../streetDesignCosting';
import {
  createCorridorStreetDesignObject,
  createPathCorridorStreetDesignObject,
  createPointStreetDesignObject,
} from '../streetDesignPlacement';

describe('streetDesignCosting', () => {
  it('calculates per-item costs', () => {
    const tree = createPointStreetDesignObject({
      id: 'tree-1',
      type: 'tree',
      point: { x: 0, z: 0 },
    });

    const line = getStreetDesignCostLine(tree);
    expect(line.quantity).toBe(1);
    expect(line.totalCostMinor).toBe(45000);
  });

  it('calculates planting row item counts from path length and spacing', () => {
    const treeRow = createPathCorridorStreetDesignObject({
      id: 'tree-row-1',
      type: 'tree',
      points: [
        { x: 0, z: 0 },
        { x: 12, z: 0 },
      ],
    });

    const line = getStreetDesignCostLine(treeRow);
    expect(line.quantity).toBe(3);
    expect(line.totalCostMinor).toBe(135000);
  });

  it('calculates square-meter costs for corridor elements', () => {
    const grass = createCorridorStreetDesignObject({
      id: 'grass-1',
      type: 'grass_strip',
      start: { x: 0, z: 0 },
      end: { x: 10, z: 0 },
      width: 2,
    });

    const line = getStreetDesignCostLine(grass);
    expect(line.quantity).toBe(20);
    expect(line.totalCostMinor).toBe(24000);
  });

  it('calculates square-meter costs for curved path corridors', () => {
    const street = createPathCorridorStreetDesignObject({
      id: 'street-1',
      type: 'street',
      points: [
        { x: 0, z: 0 },
        { x: 10, z: 0 },
        { x: 10, z: 10 },
      ],
      width: 4,
    });

    const line = getStreetDesignCostLine(street);
    expect(line.quantity).toBeGreaterThan(0);
    expect(line.totalCostMinor).toBeGreaterThan(0);
  });

  it('calculates parking costs from parking space count', () => {
    const parking = createCorridorStreetDesignObject({
      id: 'parking-1',
      type: 'parking_area',
      start: { x: 0, z: 0 },
      end: { x: 20, z: 0 },
      width: 2.5,
    });

    const line = getStreetDesignCostLine(parking);
    expect(line.quantity).toBe(4);
    expect(line.totalCostMinor).toBe(1_400_000);
  });

  it('calculates building costs from footprint square meters', () => {
    const building = createCorridorStreetDesignObject({
      id: 'building-1',
      type: 'building',
      start: { x: 0, z: 0 },
      end: { x: 10, z: 0 },
      width: 10,
    });

    const line = getStreetDesignCostLine(building);
    expect(line.quantity).toBe(100);
    expect(line.totalCostMinor).toBe(25_000_000);
  });

  it('uses overridden unit prices and aggregates totals', () => {
    const bank = updateObjectUnitCost(
      createPointStreetDesignObject({
        id: 'bank-1',
        type: 'bank',
        point: { x: 2, z: 3 },
      }),
      100000
    );
    const bikeLane = createCorridorStreetDesignObject({
      id: 'bike-1',
      type: 'bike_lane',
      start: { x: 0, z: 0 },
      end: { x: 10, z: 0 },
      width: 2,
    });

    const summary = getStreetDesignCostSummary([bank, bikeLane]);

    expect(summary.totalCostMinor).toBe(280000);
    expect(summary.lines).toHaveLength(2);
    expect(summary.categories.map(category => category.category).sort()).toEqual([
      'furniture',
      'mobility',
    ]);
  });
});
