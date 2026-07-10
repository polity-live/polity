import { describe, expect, it } from 'vitest';
import { createEmptyStreetDesignState } from '../../state/streetDesignReducer';
import { buildStreetDesignLegendSections } from '../streetDesignLegend';
import { DEFAULT_STREET_DESIGN_OSM_LAYER_VISIBILITY } from '../streetDesignOsm';

describe('buildStreetDesignLegendSections', () => {
  it('builds placement preset legend entries with stable preset ids', () => {
    const sections = buildStreetDesignLegendSections({
      design: createEmptyStreetDesignState(),
    });
    const planned = sections.find(section => section.id === 'planned');
    const ids = planned?.entries.map(entry => entry.id) ?? [];
    const labelKeys = planned?.entries.map(entry => entry.labelKey) ?? [];

    expect(planned?.labelKey).toBe('features.amendments.streetscape.canvas.legendPlanned');
    expect(ids).toContain('planned-preset:building-office');
    expect(ids).toContain('planned-preset:building-residential');
    expect(ids).toContain('planned-preset:tree-conifer');
    expect(ids).toContain('planned-preset:tree-fruit');
    expect(ids).toContain('planned-preset:street-primary');
    expect(ids).toContain('planned-preset:street-residential');
    expect(ids).toContain('planned-fallback:bank');
    expect(ids).toContain('planned-fallback:bollard');
    expect(ids).toContain('planned-fallback:hydrant');
    expect(labelKeys).toContain('features.amendments.streetscape.variantLabels.building.office');
    expect(labelKeys).toContain(
      'features.amendments.streetscape.variantLabels.building.residential'
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps existing OSM layers occurrence-based, visible, and deduplicated', () => {
    const sections = buildStreetDesignLegendSections({
      design: {
        ...createEmptyStreetDesignState(),
        hiddenOsmFeatureIds: ['water-hidden'],
        osmLayerVisibility: {
          ...DEFAULT_STREET_DESIGN_OSM_LAYER_VISIBILITY,
          building: false,
        },
        osmSnapshot: {
          fetchedAt: 1,
          bbox: { south: 52.51, west: 13.4, north: 52.52, east: 13.41 },
          features: [
            {
              id: 'road-1',
              kind: 'road',
              geometryKind: 'line',
              points: [
                { lat: 52.51, lon: 13.4 },
                { lat: 52.52, lon: 13.41 },
              ],
            },
            {
              id: 'road-2',
              kind: 'road',
              geometryKind: 'line',
              points: [
                { lat: 52.511, lon: 13.4 },
                { lat: 52.521, lon: 13.41 },
              ],
            },
            {
              id: 'building-hidden-by-layer',
              kind: 'building',
              geometryKind: 'polygon',
              points: [
                { lat: 52.51, lon: 13.4 },
                { lat: 52.51, lon: 13.401 },
                { lat: 52.511, lon: 13.401 },
                { lat: 52.51, lon: 13.4 },
              ],
            },
            {
              id: 'water-hidden',
              kind: 'water',
              geometryKind: 'polygon',
              points: [
                { lat: 52.512, lon: 13.4 },
                { lat: 52.512, lon: 13.401 },
                { lat: 52.513, lon: 13.401 },
                { lat: 52.512, lon: 13.4 },
              ],
            },
          ],
        },
      },
    });
    const existing = sections.find(section => section.id === 'existing');

    expect(existing?.entries.map(entry => entry.id)).toEqual(['existing:road']);
    expect(existing?.entries[0]?.labelKey).toBe(
      'features.amendments.streetscape.objects.street.label'
    );
  });
});
