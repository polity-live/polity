import { describe, expect, it } from 'vitest';
import { DEFAULT_CITY_DESIGN_OSM_LAYER_VISIBILITY } from '../cityDesignOsm';
import {
  cityDesignAddableObjectTypes,
  cityDesignElementSectionLayers,
  cityDesignElementSections,
} from '../cityDesignElementSections';
import { cityDesignObjectRegistry, cityDesignObjectTypes } from '../cityDesignObjectRegistry';
import { getCityDesignVariantLabelKey } from '../cityDesignVariantCatalog';

describe('cityDesignElementSections', () => {
  it('uses the OSM overlay order for addable element sections', () => {
    expect(cityDesignElementSectionLayers).toEqual([
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

    expect(new Set(cityDesignElementSectionLayers)).toEqual(
      new Set(Object.keys(DEFAULT_CITY_DESIGN_OSM_LAYER_VISIBILITY))
    );
  });

  it('maps every manual object type to exactly one add-menu section', () => {
    expect(new Set(cityDesignAddableObjectTypes).size).toBe(cityDesignAddableObjectTypes.length);
    expect([...cityDesignAddableObjectTypes].sort()).toEqual([...cityDesignObjectTypes].sort());

    for (const type of cityDesignAddableObjectTypes) {
      expect(cityDesignObjectRegistry[type]).toBeTruthy();
    }
  });

  it('keeps every physical OSM layer manually addable or property-editable', () => {
    for (const section of cityDesignElementSections) {
      expect(section.labelKey).toContain('features.amendments.cityDesign.osmLayers.');
      expect(section.objectTypes.length + (section.propertyCoverage?.length ?? 0)).toBeGreaterThan(
        0
      );
    }

    expect(
      cityDesignElementSections.find(section => section.layer === 'road')?.propertyCoverage
    ).toEqual(expect.arrayContaining(['street.access', 'street.level', 'street.status']));
    expect(
      cityDesignElementSections.find(section => section.layer === 'building')?.propertyCoverage
    ).toEqual(expect.arrayContaining(['building.semanticUse/use', 'building.renderColor/color']));
    expect(cityDesignElementSections.find(section => section.layer === 'trees')?.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectType: 'tree',
          propertyOverrides: expect.objectContaining({ species: 'conifer' }),
        }),
      ])
    );
  });

  it('exposes bridge presets as add-menu variants with OSM-compatible height properties', () => {
    const roadTools = cityDesignElementSections.find(section => section.layer === 'road')?.tools;
    const sidewalkTools = cityDesignElementSections.find(
      section => section.layer === 'sidewalk'
    )?.tools;
    const bikeLaneTools = cityDesignElementSections.find(
      section => section.layer === 'bike_lane'
    )?.tools;
    const railTools = cityDesignElementSections.find(section => section.layer === 'rail')?.tools;
    const transitTools = cityDesignElementSections.find(
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
      getCityDesignVariantLabelKey('street', {
        structureKind: 'bridge',
        roadClass: 'residential',
      })
    ).toBe('features.amendments.cityDesign.variantLabels.street.bridge');
    expect(getCityDesignVariantLabelKey('rail_track', { structureKind: 'viaduct' })).toBe(
      'features.amendments.cityDesign.variantLabels.rail.viaduct'
    );
    expect(
      getCityDesignVariantLabelKey('station_platform', {
        deckElevationMeters: 0.32,
        platformType: 'bus_platform',
        shelter: true,
      })
    ).toBe('features.amendments.cityDesign.variantLabels.transit.elevated_sheltered_bus_stop');
  });
});
