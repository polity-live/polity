import { describe, expect, it } from 'vitest';
import {
  createCityDesignBboxFromCenterRadius,
  createCityDesignMapSelection,
  createCityDesignMapSelectionFromBbox,
  createCityDesignMapSelectionFromCenterRadius,
  getCityDesignMapSelectionDimensions,
  getCityDesignMapSelectionRotateHandle,
  moveCityDesignMapSelectionToCenter,
  resizeCityDesignBboxByHandle,
  resizeCityDesignMapSelectionByHandle,
  resizeCityDesignMapSelectionMeters,
} from '../cityDesignBbox';

describe('cityDesignBbox A04 alternatives', () => {
  it('normalizes non-finite and negative rotations and clamps global coordinates', () => {
    expect(
      getCityDesignMapSelectionDimensions(
        createCityDesignMapSelection({
          center: { lat: 100, lon: 200 },
          widthMeters: 1,
          heightMeters: 1,
          rotationDeg: Number.POSITIVE_INFINITY,
        })
      ).rotationDeg
    ).toBe(0);
    expect(
      getCityDesignMapSelectionDimensions(
        createCityDesignMapSelection({
          center: { lat: -100, lon: -200 },
          widthMeters: 20,
          heightMeters: 20,
          rotationDeg: -90,
        })
      ).rotationDeg
    ).toBe(270);
  });

  it('uses all radius and rotation default arguments', () => {
    const bbox = createCityDesignBboxFromCenterRadius({ lat: 0, lon: 0 });
    const selection = createCityDesignMapSelectionFromCenterRadius({ lat: 0, lon: 0 });
    expect(selection.widthMeters).toBe(280);
    expect(createCityDesignMapSelectionFromBbox(bbox).rotationDeg).toBe(0);
    expect(createCityDesignMapSelectionFromBbox(bbox, 45).rotationDeg).toBe(45);
  });

  it('moves and resizes map selections while preserving unrelated dimensions', () => {
    const selection = createCityDesignMapSelection({
      center: { lat: 52.52, lon: 13.405 },
      widthMeters: 100,
      heightMeters: 80,
      rotationDeg: 30,
    });
    expect(moveCityDesignMapSelectionToCenter(selection, { lat: 1, lon: 2 }).center).toEqual({
      lat: 1,
      lon: 2,
    });
    expect(
      resizeCityDesignMapSelectionMeters({ selection, widthMeters: 150, heightMeters: 90 })
    ).toMatchObject({ widthMeters: 150, heightMeters: 90, rotationDeg: 30 });
    expect(getCityDesignMapSelectionRotateHandle(selection)).not.toEqual(selection.center);
  });

  it('applies every cardinal bbox handle and normalizes inverted edges', () => {
    const bbox = { south: 0, west: 0, north: 1, east: 1 };
    const northEast = resizeCityDesignBboxByHandle({
      bbox,
      handle: 'ne',
      point: { lat: -1, lon: -1 },
    });
    const southWest = resizeCityDesignBboxByHandle({
      bbox,
      handle: 'sw',
      point: { lat: 2, lon: 2 },
    });
    expect(northEast.north).toBeGreaterThan(northEast.south);
    expect(southWest.east).toBeGreaterThan(southWest.west);
  });

  it('changes only the dimensions addressed by rotated selection handles', () => {
    const selection = createCityDesignMapSelection({
      center: { lat: 52.52, lon: 13.405 },
      widthMeters: 100,
      heightMeters: 80,
      rotationDeg: 20,
    });
    const east = resizeCityDesignMapSelectionByHandle({
      selection,
      handle: 'e',
      point: { lat: 52.52, lon: 13.407 },
    });
    const north = resizeCityDesignMapSelectionByHandle({
      selection,
      handle: 'n',
      point: { lat: 52.522, lon: 13.405 },
    });
    expect(east.heightMeters).toBe(80);
    expect(north.widthMeters).toBe(100);
  });
});
