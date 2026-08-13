import { describe, expect, it } from 'vitest';
import {
  getCityDesignCostLine,
  getCityDesignCostSummary,
  updateObjectUnitCost,
} from '../cityDesignCosting';
import {
  createCorridorCityDesignObject,
  createPathCorridorCityDesignObject,
  createPointCityDesignObject,
} from '../cityDesignPlacement';

describe('cityDesignCosting', () => {
  it('calculates per-item costs', () => {
    const tree = createPointCityDesignObject({
      id: 'tree-1',
      type: 'tree',
      point: { x: 0, z: 0 },
    });

    const line = getCityDesignCostLine(tree);
    expect(line.quantity).toBe(1);
    expect(line.totalCostMinor).toBe(45000);
  });

  it('calculates planting row item counts from path length and spacing', () => {
    const treeRow = createPathCorridorCityDesignObject({
      id: 'tree-row-1',
      type: 'tree',
      points: [
        { x: 0, z: 0 },
        { x: 12, z: 0 },
      ],
    });

    const line = getCityDesignCostLine(treeRow);
    expect(line.quantity).toBe(3);
    expect(line.totalCostMinor).toBe(135000);
  });

  it('calculates square-meter costs for corridor elements', () => {
    const grass = createCorridorCityDesignObject({
      id: 'grass-1',
      type: 'grass_strip',
      start: { x: 0, z: 0 },
      end: { x: 10, z: 0 },
      width: 2,
    });

    const line = getCityDesignCostLine(grass);
    expect(line.quantity).toBe(20);
    expect(line.totalCostMinor).toBe(24000);
  });

  it('calculates square-meter costs for curved path corridors', () => {
    const street = createPathCorridorCityDesignObject({
      id: 'street-1',
      type: 'street',
      points: [
        { x: 0, z: 0 },
        { x: 10, z: 0 },
        { x: 10, z: 10 },
      ],
      width: 4,
    });

    const line = getCityDesignCostLine(street);
    expect(line.quantity).toBeGreaterThan(0);
    expect(line.totalCostMinor).toBeGreaterThan(0);
  });

  it('calculates parking costs from parking space count', () => {
    const parking = createCorridorCityDesignObject({
      id: 'parking-1',
      type: 'parking_area',
      start: { x: 0, z: 0 },
      end: { x: 20, z: 0 },
      width: 2.5,
    });

    const line = getCityDesignCostLine(parking);
    expect(line.quantity).toBe(4);
    expect(line.totalCostMinor).toBe(1_400_000);
  });

  it('calculates building costs from footprint square meters', () => {
    const building = createCorridorCityDesignObject({
      id: 'building-1',
      type: 'building',
      start: { x: 0, z: 0 },
      end: { x: 10, z: 0 },
      width: 10,
    });

    const line = getCityDesignCostLine(building);
    expect(line.quantity).toBe(100);
    expect(line.totalCostMinor).toBe(25_000_000);
  });

  it('attaches variant display label keys to cost lines', () => {
    const building = createCorridorCityDesignObject({
      id: 'building-1',
      type: 'building',
      start: { x: 0, z: 0 },
      end: { x: 10, z: 0 },
      width: 10,
      overrides: { properties: { use: 'office' } },
    });
    const conifer = createPointCityDesignObject({
      id: 'tree-1',
      type: 'tree',
      point: { x: 0, z: 0 },
      overrides: { properties: { species: 'conifer' } },
    });
    const floweringPlum = createPointCityDesignObject({
      id: 'tree-2',
      type: 'tree',
      point: { x: 1, z: 0 },
      overrides: { properties: { species: 'flowering_plum' } },
    });

    const line = getCityDesignCostLine(building);
    const treeLine = getCityDesignCostLine(conifer);
    const floweringTreeLine = getCityDesignCostLine(floweringPlum);

    expect(line.displayLabelKey).toBe(
      'features.amendments.cityDesign.variantLabels.building.office'
    );
    expect(treeLine.displayLabelKey).toBe(
      'features.amendments.cityDesign.variantLabels.tree.conifer'
    );
    expect(floweringTreeLine.displayLabelKey).toBe(
      'features.amendments.cityDesign.variantLabels.tree.flowering_plum'
    );
  });

  it('uses overridden unit prices and aggregates totals', () => {
    const bank = updateObjectUnitCost(
      createPointCityDesignObject({
        id: 'bank-1',
        type: 'bank',
        point: { x: 2, z: 3 },
      }),
      100000
    );
    const bikeLane = createCorridorCityDesignObject({
      id: 'bike-1',
      type: 'bike_lane',
      start: { x: 0, z: 0 },
      end: { x: 10, z: 0 },
      width: 2,
    });

    const summary = getCityDesignCostSummary([bank, bikeLane]);

    expect(summary.totalCostMinor).toBe(280000);
    expect(summary.lines).toHaveLength(2);
    expect(summary.categories.map(category => category.category).sort()).toEqual([
      'furniture',
      'mobility',
    ]);
  });
});
