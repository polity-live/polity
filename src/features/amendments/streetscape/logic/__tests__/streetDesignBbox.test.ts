import { describe, expect, it } from 'vitest';
import {
  MAX_STREET_DESIGN_BBOX_SPAN_DEGREES,
  createStreetDesignBboxFromCenter,
  createStreetDesignMapSelection,
  getStreetDesignBboxCenter,
  getStreetDesignBboxDimensionsMeters,
  getStreetDesignMapSelectionBoundingBox,
  getStreetDesignMapSelectionDimensions,
  rotateStreetDesignMapSelectionToPoint,
  moveStreetDesignBboxToCenter,
  resizeStreetDesignBboxByHandle,
  resizeStreetDesignBboxMeters,
} from '../streetDesignBbox';

describe('streetDesignBbox', () => {
  it('creates a bbox around a center with meter dimensions', () => {
    const bbox = createStreetDesignBboxFromCenter({
      center: { lat: 52.52, lon: 13.405 },
      widthMeters: 240,
      heightMeters: 80,
    });
    const center = getStreetDesignBboxCenter(bbox);
    const dimensions = getStreetDesignBboxDimensionsMeters(bbox);

    expect(center.lat).toBeCloseTo(52.52);
    expect(center.lon).toBeCloseTo(13.405);
    expect(dimensions.widthMeters).toBeGreaterThanOrEqual(235);
    expect(dimensions.widthMeters).toBeLessThanOrEqual(245);
    expect(dimensions.heightMeters).toBeGreaterThanOrEqual(75);
    expect(dimensions.heightMeters).toBeLessThanOrEqual(85);
  });

  it('moves a bbox while preserving its dimensions', () => {
    const bbox = createStreetDesignBboxFromCenter({
      center: { lat: 52.52, lon: 13.405 },
      widthMeters: 180,
      heightMeters: 60,
    });
    const moved = moveStreetDesignBboxToCenter(bbox, { lat: 52.53, lon: 13.41 });

    expect(getStreetDesignBboxCenter(moved).lat).toBeCloseTo(52.53);
    expect(getStreetDesignBboxCenter(moved).lon).toBeCloseTo(13.41);
    expect(getStreetDesignBboxDimensionsMeters(moved).heightMeters).toBe(60);
  });

  it('resizes a bbox from meter inputs and enforces the Overpass max span', () => {
    const bbox = createStreetDesignBboxFromCenter({
      center: { lat: 52.52, lon: 13.405 },
      widthMeters: 120,
      heightMeters: 120,
    });
    const resized = resizeStreetDesignBboxMeters({
      bbox,
      widthMeters: 100_000,
      heightMeters: 100_000,
    });

    expect(resized.north - resized.south).toBeLessThanOrEqual(
      MAX_STREET_DESIGN_BBOX_SPAN_DEGREES + 1e-9
    );
    expect(resized.east - resized.west).toBeLessThanOrEqual(
      MAX_STREET_DESIGN_BBOX_SPAN_DEGREES + 1e-9
    );
  });

  it('resizes from a map handle drag point', () => {
    const bbox = createStreetDesignBboxFromCenter({
      center: { lat: 52.52, lon: 13.405 },
      widthMeters: 120,
      heightMeters: 120,
    });
    const resized = resizeStreetDesignBboxByHandle({
      bbox,
      handle: 'e',
      point: { lat: 52.52, lon: bbox.east + 0.001 },
    });

    expect(getStreetDesignBboxDimensionsMeters(resized).widthMeters).toBeGreaterThan(
      getStreetDesignBboxDimensionsMeters(bbox).widthMeters
    );
  });

  it('keeps a rotated map selection as a bounded Overpass envelope', () => {
    const selection = createStreetDesignMapSelection({
      center: { lat: 52.52, lon: 13.405 },
      widthMeters: 240,
      heightMeters: 60,
      rotationDeg: 35,
    });
    const bbox = getStreetDesignMapSelectionBoundingBox(selection);
    const dimensions = getStreetDesignMapSelectionDimensions(selection);

    expect(dimensions.widthMeters).toBe(240);
    expect(dimensions.heightMeters).toBe(60);
    expect(bbox.north).toBeGreaterThan(bbox.south);
    expect(bbox.east).toBeGreaterThan(bbox.west);
  });

  it('rotates a selection from the top handle without a 90 degree jump', () => {
    const selection = createStreetDesignMapSelection({
      center: { lat: 52.52, lon: 13.405 },
      widthMeters: 120,
      heightMeters: 80,
      rotationDeg: 0,
    });
    const rotated = rotateStreetDesignMapSelectionToPoint({
      selection,
      point: { lat: 52.5208, lon: 13.405 },
    });

    expect(rotated.rotationDeg).toBeCloseTo(0);
  });
});
