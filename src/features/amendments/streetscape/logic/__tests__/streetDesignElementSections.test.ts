import { describe, expect, it } from 'vitest';
import { DEFAULT_STREET_DESIGN_OSM_LAYER_VISIBILITY } from '../streetDesignOsm';
import {
  streetDesignAddableObjectTypes,
  streetDesignElementSectionLayers,
  streetDesignElementSections,
} from '../streetDesignElementSections';
import { streetDesignObjectRegistry, streetDesignObjectTypes } from '../streetDesignObjectRegistry';

describe('streetDesignElementSections', () => {
  it('uses the OSM overlay order for addable element sections', () => {
    expect(streetDesignElementSectionLayers).toEqual([
      'building',
      'road',
      'sidewalk',
      'bike_lane',
      'parking',
      'trees',
      'green',
      'water',
      'rail',
      'transit',
      'barrier',
      'street_furniture',
      'traffic',
      'sports',
      'construction',
      'landuse_context',
    ]);

    expect(new Set(streetDesignElementSectionLayers)).toEqual(
      new Set(Object.keys(DEFAULT_STREET_DESIGN_OSM_LAYER_VISIBILITY))
    );
  });

  it('maps every manual object type to exactly one add-menu section', () => {
    expect(new Set(streetDesignAddableObjectTypes).size).toBe(
      streetDesignAddableObjectTypes.length
    );
    expect([...streetDesignAddableObjectTypes].sort()).toEqual([...streetDesignObjectTypes].sort());

    for (const type of streetDesignAddableObjectTypes) {
      expect(streetDesignObjectRegistry[type]).toBeTruthy();
    }
  });

  it('keeps every physical OSM layer manually addable or property-editable', () => {
    for (const section of streetDesignElementSections) {
      expect(section.labelKey).toContain('features.amendments.streetscape.osmLayers.');
      expect(section.objectTypes.length + (section.propertyCoverage?.length ?? 0)).toBeGreaterThan(
        0
      );
    }

    expect(
      streetDesignElementSections.find(section => section.layer === 'road')?.propertyCoverage
    ).toEqual(expect.arrayContaining(['street.access', 'street.level', 'street.status']));
    expect(
      streetDesignElementSections.find(section => section.layer === 'building')?.propertyCoverage
    ).toEqual(expect.arrayContaining(['building.semanticUse/use', 'building.renderColor/color']));
    expect(streetDesignElementSections.find(section => section.layer === 'trees')?.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectType: 'tree',
          propertyOverrides: expect.objectContaining({ species: 'conifer' }),
        }),
      ])
    );
  });
});
