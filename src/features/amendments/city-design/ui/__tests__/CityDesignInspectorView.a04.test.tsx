/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPathCorridorCityDesignObject,
  createPointCityDesignObject,
} from '../../logic/cityDesignPlacement';
import { getCityDesignObjectDefinition } from '../../logic/cityDesignObjectRegistry';
import * as objectRegistry from '../../logic/cityDesignObjectRegistry';
import type {
  CityDesignObject,
  CityDesignObjectDefinition,
  CityDesignPlacementSettings,
} from '../../types';
import { CityDesignInspectorView, cityDesignInspectorInternals } from '../CityDesignInspectorView';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

const callbacks = {
  onPlacementPropertyChange: vi.fn(),
  onPlacementWidthChange: vi.fn(),
  onPlacementRotationChange: vi.fn(),
  onPlacementUnitCostChange: vi.fn(),
  onPropertyChange: vi.fn(),
  onWidthChange: vi.fn(),
  onRotationChange: vi.fn(),
  onUnitCostChange: vi.fn(),
  onDeleteObject: vi.fn(),
  onHideOsmWay: vi.fn(),
};

function props(
  overrides: Partial<ComponentProps<typeof CityDesignInspectorView>> = {}
): ComponentProps<typeof CityDesignInspectorView> {
  return {
    selectedObject: null,
    selectedOsmWay: null,
    selectedObjectCostLine: null,
    selectedTool: 'tree',
    interactionMode: 'select',
    placementSettings: {
      type: 'tree',
      width: 1,
      rotationDeg: 12,
      rotationLocked: false,
      properties: getCityDesignObjectDefinition('tree').defaultProperties,
      customUnitCostMinor: null,
    },
    placementPreview: null,
    placementMode: null,
    readOnly: false,
    ...callbacks,
    ...overrides,
  };
}

describe('CityDesignInspectorView A04 alternatives', () => {
  it('covers the inspector formatting and placement helpers', () => {
    const {
      asInputValue,
      formatMeters,
      getOsmLayerLabelKey,
      getPlacementRotationValue,
      getPlacementTotalMinor,
      getRelevantOsmTags,
      isFiniteNumber,
    } = cityDesignInspectorInternals;
    const settings: CityDesignPlacementSettings = {
      type: 'sidewalk',
      width: 2,
      rotationDeg: 27,
      rotationLocked: false,
      properties: getCityDesignObjectDefinition('sidewalk').defaultProperties,
      customUnitCostMinor: null,
    };
    const preview = {
      kind: 'corridor' as const,
      start: { x: 0, z: 0 },
      end: { x: 4, z: 0 },
      width: 2,
      polygon: [],
      length: 4,
      area: 8,
      rotation: Math.PI / 2,
    };

    expect(asInputValue(undefined)).toBe('');
    expect(asInputValue(false)).toBe('false');
    expect(formatMeters(0.125)).toBe('0.13 m');
    expect(formatMeters(12)).toBe('12.0 m');
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isFiniteNumber('1')).toBe(false);
    expect(getOsmLayerLabelKey('bike_lane')).toContain('bikeLane');
    expect(getOsmLayerLabelKey('street_furniture')).toContain('streetFurniture');
    expect(getOsmLayerLabelKey('landuse_context')).toContain('landuseContext');
    expect(getOsmLayerLabelKey('road')).toContain('.road');
    expect(getRelevantOsmTags(undefined)).toEqual([]);
    expect(
      getRelevantOsmTags({
        highway: 'residential',
        'sidewalk:left': 'yes',
        name: 'ignored',
        surface: 'asphalt',
      })
    ).toEqual([
      ['highway', 'residential'],
      ['sidewalk:left', 'yes'],
      ['surface', 'asphalt'],
    ]);
    expect(getPlacementRotationValue({ ...settings, rotationLocked: true }, preview)).toBe(27);
    expect(getPlacementRotationValue(settings, null)).toBe(27);
    expect(getPlacementRotationValue(settings, preview)).toBe(90);
    expect(
      getPlacementTotalMinor({
        placementSettings: settings,
        placementPreview: null,
        currency: 'EUR',
      })
    ).toBeGreaterThan(0);
    expect(
      getPlacementTotalMinor({
        placementSettings: { ...settings, customUnitCostMinor: 500 },
        placementPreview: preview,
        currency: 'EUR',
      })
    ).toBe(4_000);
  });

  it('renders an active placement preview for a point tool and dispatches numeric controls', () => {
    const onPlacementRotationChange = vi.fn();
    const onPlacementPropertyChange = vi.fn();
    const onPlacementUnitCostChange = vi.fn();
    const preview = {
      kind: 'corridor' as const,
      start: { x: 0, z: 0 },
      end: { x: 2, z: 0 },
      width: 1,
      polygon: [],
      length: 2,
      area: 2,
      rotation: 0,
    };

    render(
      <CityDesignInspectorView
        {...props({
          selectedTool: 'street_lamp',
          interactionMode: 'place',
          placementSettings: {
            type: 'street_lamp',
            width: 1,
            rotationDeg: 12,
            rotationLocked: false,
            properties: getCityDesignObjectDefinition('street_lamp').defaultProperties,
            customUnitCostMinor: null,
          },
          placementPreview: preview,
          placementMode: 'drag_band',
          onPlacementRotationChange,
          onPlacementPropertyChange,
          onPlacementUnitCostChange,
        })}
      />
    );

    expect(screen.getByText(/active draft/i)).toBeTruthy();
    expect(screen.queryByText(/^width$/i)).toBeNull();
    const numericInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(numericInputs[0], { target: { value: '33' } });
    expect(onPlacementRotationChange).toHaveBeenCalledWith(33);
    const editableProperty = numericInputs.find(input => input.getAttribute('aria-label'));
    if (editableProperty) fireEvent.change(editableProperty, { target: { value: '8' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: /price/i }), {
      target: { value: '-2' },
    });
    expect(onPlacementUnitCostChange).toHaveBeenCalledWith(0);
    expect(onPlacementPropertyChange).toHaveBeenCalled();
  });

  it('shows every optional OSM detail and relevant tag', () => {
    const onHideOsmWay = vi.fn();
    render(
      <CityDesignInspectorView
        {...props({
          selectedOsmWay: {
            id: 'osm-rich',
            kind: 'stairs' as never,
            geometryKind: 'line',
            label: 'Rich feature',
            subkind: 'outdoor',
            points: [
              { lat: 1, lon: 2 },
              { lat: 2, lon: 3 },
            ],
            widthMeters: 2.5,
            height: 4,
            deckElevationMeters: 0,
            baseElevationMeters: -1,
            layerIndex: 2,
            structureKind: 'bridge',
            elevationSource: 'osm',
            incline: '5%',
            stepCount: 12,
            clearanceMeters: 0.75,
            semanticUse: 'pedestrian',
            level: 'bridge',
            access: 'public',
            tags: { highway: 'steps', 'cycleway:left': 'no', name: 'ignored' },
            source: 'osm',
          },
          onHideOsmWay,
        })}
      />
    );

    expect(screen.getByText('Rich feature')).toBeTruthy();
    expect(screen.getByText(/highway=steps/)).toBeTruthy();
    fireEvent.click(
      document.querySelector('[data-action-id="amendments.city-inspector.hide.osm-way"]') as Element
    );
    expect(onHideOsmWay).toHaveBeenCalledWith('osm-rich');
  });

  it('renders the no-selection, path-corridor, and point-object states', () => {
    const { rerender } = render(<CityDesignInspectorView {...props()} />);
    expect(screen.getByText(/no element selected/i)).toBeTruthy();

    const pathObject = createPathCorridorCityDesignObject({
      id: 'path-object',
      type: 'sidewalk',
      points: [
        { x: 0, z: 0 },
        { x: 4, z: 0 },
        { x: 4, z: 3 },
      ],
      overrides: { customUnitCostMinor: undefined },
    });
    const onWidthChange = vi.fn();
    const onRotationChange = vi.fn();
    const onUnitCostChange = vi.fn();
    rerender(
      <CityDesignInspectorView
        {...props({
          selectedObject: pathObject,
          selectedObjectCostLine: {
            objectId: pathObject.id,
            type: pathObject.type,
            labelKey: 'sidewalk',
            category: 'mobility',
            rule: 'per_square_meter',
            quantity: 12,
            unitCostMinor: 100,
            totalCostMinor: 1_200,
            currency: 'EUR',
          },
          onWidthChange,
          onRotationChange,
          onUnitCostChange,
        })}
      />
    );
    const pathSpins = screen.getAllByRole('spinbutton');
    fireEvent.change(pathSpins[0], { target: { value: '3' } });
    fireEvent.change(pathSpins[1], { target: { value: '45' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: /price/i }), {
      target: { value: '' },
    });
    expect(onWidthChange).toHaveBeenCalledWith('path-object', 3);
    expect(onRotationChange).toHaveBeenCalledWith('path-object', 45);
    expect(onUnitCostChange).toHaveBeenCalledWith('path-object', null);

    const pointObject = createPointCityDesignObject({
      id: 'point-object',
      type: 'tree',
      point: { x: 1, z: 2 },
    });
    delete pointObject.properties.species;
    rerender(<CityDesignInspectorView {...props({ selectedObject: pointObject })} />);
    expect(screen.getAllByText(/rotation/i).length).toBeGreaterThan(0);
  });

  it('accepts sparse property schemas and converts text and numeric object values', () => {
    const definition: CityDesignObjectDefinition = {
      type: 'street_lamp',
      labelKey: 'test.object',
      icon: 'TreePine',
      category: 'greenery',
      geometryKind: 'point',
      defaultProperties: { select: '', combo: '', text: '', number: 0 },
      propertySchema: [
        { key: 'select', labelKey: 'test.select', fieldType: 'select' },
        { key: 'combo', labelKey: 'test.combo', fieldType: 'combobox' },
        { key: 'text', labelKey: 'test.text', fieldType: 'text' },
        { key: 'number', labelKey: 'test.number', fieldType: 'number' },
      ],
      costRule: 'per_item',
      suggestedUnitCostMinor: 100,
      renderKind: 'tree',
      toolMode: 'point',
      color: '#000000',
    };
    vi.spyOn(objectRegistry, 'getCityDesignObjectDefinition').mockReturnValue(definition);
    const onPlacementPropertyChange = vi.fn();
    const placementSettings: CityDesignPlacementSettings = {
      type: 'street_lamp',
      width: 1,
      rotationDeg: 0,
      rotationLocked: true,
      properties: definition.defaultProperties,
      customUnitCostMinor: null,
    };
    const { rerender } = render(
      <CityDesignInspectorView
        {...props({
          interactionMode: 'place',
          selectedTool: 'street_lamp',
          placementSettings,
          onPlacementPropertyChange,
        })}
      />
    );
    const placementText = document.querySelector<HTMLInputElement>(
      'input[type="text"]:not([list])'
    );
    const placementNumber = document.querySelector<HTMLInputElement>(
      'input[type="number"][aria-label="test.number"]'
    );
    expect(placementText).toBeTruthy();
    expect(placementNumber).toBeTruthy();
    fireEvent.change(placementText as HTMLInputElement, { target: { value: 'words' } });
    fireEvent.change(placementNumber as HTMLInputElement, { target: { value: '7' } });
    expect(onPlacementPropertyChange).toHaveBeenCalledWith('text', 'words');
    expect(onPlacementPropertyChange).toHaveBeenCalledWith('number', 7);

    const selectedObject: CityDesignObject = {
      id: 'sparse-object',
      type: 'street_lamp',
      geometry: { kind: 'point', point: { x: 0, z: 0 }, rotation: 0 },
      properties: definition.defaultProperties,
      cost: { rule: 'per_item', currency: 'EUR', suggestedUnitCostMinor: 100 },
    };
    const onPropertyChange = vi.fn();
    const onUnitCostChange = vi.fn();
    rerender(
      <CityDesignInspectorView {...props({ selectedObject, onPropertyChange, onUnitCostChange })} />
    );
    const objectText = document.querySelector<HTMLInputElement>('input[type="text"]:not([list])');
    const objectNumber = document.querySelector<HTMLInputElement>(
      'input[type="number"][aria-label="test.number"]'
    );
    fireEvent.change(objectText as HTMLInputElement, { target: { value: 'object words' } });
    fireEvent.change(objectNumber as HTMLInputElement, { target: { value: '9' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: /price/i }), {
      target: { value: '2.5' },
    });
    expect(onPropertyChange).toHaveBeenCalledWith('sparse-object', 'text', 'object words');
    expect(onPropertyChange).toHaveBeenCalledWith('sparse-object', 'number', 9);
    expect(onUnitCostChange).toHaveBeenCalledWith('sparse-object', 250);
  });
});
