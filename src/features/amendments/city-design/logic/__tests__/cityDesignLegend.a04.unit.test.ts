import { describe, expect, it } from 'vitest';
import type { CityDesignStateV1 } from '../../types';
import { createEmptyCityDesignState } from '../../state/cityDesignReducer';
import type { CityDesignOsmFeatureLayer } from '../../types';
import { buildCityDesignLegendSections, cityDesignLegendInternals } from '../cityDesignLegend';

describe('cityDesignLegend A04 alternatives', () => {
  it('mutes valid colors and preserves unsupported formats', () => {
    expect(cityDesignLegendInternals.muteExistingColor('#ff0000')).toMatch(/^#[0-9a-f]{6}$/);
    expect(cityDesignLegendInternals.muteExistingColor('red')).toBe('red');
    expect(cityDesignLegendInternals.stringProperty('')).toBeNull();
    expect(cityDesignLegendInternals.stringProperty(1)).toBeNull();
    expect(cityDesignLegendInternals.stringProperty('#fff')).toBe('#fff');
  });

  it('selects explicit, registry, and generic existing colors', () => {
    const feature = { id: 'road', kind: 'road' as const, geometryKind: 'line' as const };
    expect(
      cityDesignLegendInternals.getExistingLegendColor(
        { ...feature, renderColor: '#123456' },
        'road'
      )
    ).toBe('#123456');
    expect(cityDesignLegendInternals.getExistingLegendColor(feature, 'road')).toMatch(/^#/);
    expect(
      cityDesignLegendInternals.getExistingLegendColor(
        feature,
        'unknown' as CityDesignOsmFeatureLayer
      )
    ).toBe('#64748b');
  });

  it('uses render color, color, and registry fallbacks for planned entries', () => {
    expect(
      cityDesignLegendInternals.getPlannedLegendColor('tree', { renderColor: '#111111' })
    ).toBe('#111111');
    expect(cityDesignLegendInternals.getPlannedLegendColor('tree', { color: '#222222' })).toBe(
      '#222222'
    );
    expect(cityDesignLegendInternals.getPlannedLegendColor('tree', {})).toMatch(/^#/);
    const fallback = cityDesignLegendInternals.createPlannedPresetLegendEntry({
      id: 'fallback',
      kind: 'placement-fallback',
      objectType: 'street_lamp',
      sectionId: 'street_furniture',
    });
    expect(fallback.labelKey).toContain('streetLamp');
    expect(fallback.width).toBeUndefined();
    const preset = cityDesignLegendInternals.createPlannedPresetLegendEntry({
      id: 'preset',
      kind: 'placement-preset',
      objectType: 'tree',
      sectionId: 'trees',
      labelKey: 'custom.label',
      propertyOverrides: { color: '#333333' },
      width: 4,
    });
    expect(preset).toMatchObject({ labelKey: 'custom.label', width: 4, color: '#333333' });
  });

  it('creates multiple occurrence-based entries in one existing layer', () => {
    const design: CityDesignStateV1 = {
      ...createEmptyCityDesignState(),
      osmSnapshot: {
        fetchedAt: 1,
        bbox: { south: 0, west: 0, north: 1, east: 1 },
        features: [
          {
            id: 'traffic-one',
            kind: 'traffic' as const,
            geometryKind: 'line' as const,
            points: [
              { lat: 0, lon: 0 },
              { lat: 1, lon: 1 },
            ],
            subkind: 'crossing',
            tags: { crossing: 'zebra' },
            widthMeters: 8,
          },
          {
            id: 'traffic-two',
            kind: 'traffic' as const,
            geometryKind: 'line' as const,
            points: [
              { lat: 0, lon: 0 },
              { lat: 1, lon: 1 },
            ],
            tags: { highway: 'stop' },
          },
        ],
      },
    };
    const existing = buildCityDesignLegendSections({ design }).find(
      section => section.id === 'existing'
    );
    expect(existing?.entries.map(entry => entry.id)).toEqual([
      'existing:traffic',
      'existing:traffic:traffic_sign',
    ]);
    expect(existing?.entries[0].width).toBe(8);
  });

  it('builds both preset and fallback planned groups without duplicate IDs', () => {
    const groups = cityDesignLegendInternals.buildPlannedLegendEntryGroups();
    const entries = groups.flatMap(group => group.entries);
    expect(entries.some(entry => entry.kind === 'placement-preset')).toBe(true);
    expect(entries.some(entry => entry.kind === 'placement-fallback')).toBe(true);
    expect(new Set(entries.map(entry => entry.id)).size).toBe(entries.length);
  });

  it('ignores normalized features without a configured legend section', () => {
    const design: CityDesignStateV1 = {
      ...createEmptyCityDesignState(),
      osmSnapshot: {
        fetchedAt: 1,
        bbox: { south: 0, west: 0, north: 1, east: 1 },
        features: [
          {
            id: 'unknown',
            kind: 'unknown' as never,
            geometryKind: 'line' as const,
            points: [
              { lat: 0, lon: 0 },
              { lat: 1, lon: 1 },
            ],
          },
        ],
      },
    };
    expect(cityDesignLegendInternals.buildExistingLegendEntries(design)).toEqual([]);
  });
});
