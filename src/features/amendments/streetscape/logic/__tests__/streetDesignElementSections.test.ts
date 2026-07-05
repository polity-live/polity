import { describe, expect, it } from 'vitest';
import { DEFAULT_STREET_DESIGN_OSM_LAYER_VISIBILITY } from '../streetDesignOsm';
import {
  streetDesignAddableObjectTypes,
  streetDesignElementSectionLayers,
  streetDesignElementSections,
} from '../streetDesignElementSections';
import { streetDesignObjectRegistry, streetDesignObjectTypes } from '../streetDesignObjectRegistry';
import { getStreetDesignVariantLabelKey } from '../streetDesignVariantCatalog';

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

  it('exposes bridge presets as add-menu variants with OSM-compatible height properties', () => {
    const roadTools = streetDesignElementSections.find(section => section.layer === 'road')?.tools;
    const sidewalkTools = streetDesignElementSections.find(
      section => section.layer === 'sidewalk'
    )?.tools;
    const bikeLaneTools = streetDesignElementSections.find(
      section => section.layer === 'bike_lane'
    )?.tools;
    const railTools = streetDesignElementSections.find(section => section.layer === 'rail')?.tools;
    const transitTools = streetDesignElementSections.find(
      section => section.layer === 'transit'
    )?.tools;

    expect(roadTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'street-bridge',
          objectType: 'street',
          propertyOverrides: expect.objectContaining({
            deckElevationMeters: 3.5,
            layerIndex: 1,
            level: 'bridge',
            structureKind: 'bridge',
          }),
          widthOverride: 6,
        }),
        expect.objectContaining({
          id: 'car_lane-bridge',
          objectType: 'car_lane',
          propertyOverrides: expect.objectContaining({
            deckElevationMeters: 3.5,
            direction: 'two_way',
            level: 'bridge',
            structureKind: 'bridge',
          }),
        }),
      ])
    );
    expect(sidewalkTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'sidewalk-bridge',
          objectType: 'sidewalk',
          propertyOverrides: expect.objectContaining({
            deckElevationMeters: 3.2,
            level: 'bridge',
            structureKind: 'bridge',
          }),
        }),
      ])
    );
    expect(bikeLaneTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'bike_lane-bridge',
          objectType: 'bike_lane',
          propertyOverrides: expect.objectContaining({
            deckElevationMeters: 3.2,
            level: 'bridge',
            structureKind: 'bridge',
          }),
        }),
      ])
    );
    expect(railTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'rail_track-bridge',
          objectType: 'rail_track',
          propertyOverrides: expect.objectContaining({
            deckElevationMeters: 5,
            level: 'bridge',
            structureKind: 'bridge',
          }),
        }),
        expect.objectContaining({
          id: 'rail_track-viaduct',
          objectType: 'rail_track',
          propertyOverrides: expect.objectContaining({
            deckElevationMeters: 7.5,
            layerIndex: 2,
            level: 'bridge',
            structureKind: 'viaduct',
          }),
        }),
      ])
    );
    expect(transitTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'station_platform-elevated_sheltered_bus_stop',
          objectType: 'station_platform',
          propertyOverrides: expect.objectContaining({
            deckElevationMeters: 0.32,
            platformType: 'bus_platform',
            shelter: true,
          }),
          widthOverride: 3,
        }),
        expect.objectContaining({
          id: 'station_platform-elevated_sheltered_rail_stop',
          objectType: 'station_platform',
          propertyOverrides: expect.objectContaining({
            deckElevationMeters: 0.48,
            platformType: 'rail_platform',
            shelter: true,
          }),
          widthOverride: 3.4,
        }),
      ])
    );

    expect(
      getStreetDesignVariantLabelKey('street', {
        structureKind: 'bridge',
        roadClass: 'residential',
      })
    ).toBe('features.amendments.streetscape.variantLabels.street.bridge');
    expect(getStreetDesignVariantLabelKey('rail_track', { structureKind: 'viaduct' })).toBe(
      'features.amendments.streetscape.variantLabels.rail.viaduct'
    );
    expect(
      getStreetDesignVariantLabelKey('station_platform', {
        deckElevationMeters: 0.32,
        platformType: 'bus_platform',
        shelter: true,
      })
    ).toBe('features.amendments.streetscape.variantLabels.transit.elevated_sheltered_bus_stop');
  });
});
