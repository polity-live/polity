/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCorridorCityDesignObject } from '../../logic/cityDesignPlacement';
import { CityDesignInspectorView } from '../CityDesignInspectorView';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('CityDesignInspectorView', () => {
  it('renders combobox suggestions while allowing custom placement values', () => {
    const onPlacementPropertyChange = vi.fn();
    const onPlacementUnitCostChange = vi.fn();

    render(
      <CityDesignInspectorView
        selectedObject={null}
        selectedOsmWay={null}
        selectedObjectCostLine={null}
        selectedTool="sidewalk"
        interactionMode="place"
        placementSettings={{
          type: 'sidewalk',
          width: 2.4,
          rotationDeg: 0,
          rotationLocked: false,
          properties: {
            accessibility: true,
            deckElevationMeters: 0,
            layerIndex: 0,
            pathType: 'sidewalk',
            structureKind: 'surface',
            surface: 'pflaster',
          },
          customUnitCostMinor: 12_000,
        }}
        placementPreview={null}
        placementMode={null}
        readOnly={false}
        onPlacementPropertyChange={onPlacementPropertyChange}
        onPlacementWidthChange={vi.fn()}
        onPlacementRotationChange={vi.fn()}
        onPlacementUnitCostChange={onPlacementUnitCostChange}
        onPropertyChange={vi.fn()}
        onWidthChange={vi.fn()}
        onRotationChange={vi.fn()}
        onUnitCostChange={vi.fn()}
        onDeleteObject={vi.fn()}
        onHideOsmWay={vi.fn()}
      />
    );

    const pathTypeInput = screen.getByRole('combobox', { name: /path type/i });
    expect(pathTypeInput.getAttribute('list')).toBe('city-design-placement-pathType');
    expect(document.querySelector('option[value="promenade"]')).toBeTruthy();

    fireEvent.change(pathTypeInput, { target: { value: 'shared_space' } });

    expect(onPlacementPropertyChange).toHaveBeenCalledWith('pathType', 'shared_space');

    const priceInput = screen.getByRole('spinbutton', { name: /price/i });
    expect(priceInput.getAttribute('step')).toBe('0.01');
    fireEvent.change(priceInput, { target: { value: '123.45' } });
    expect(onPlacementUnitCostChange).toHaveBeenCalledWith(12_345);
    fireEvent.change(priceInput, { target: { value: '' } });
    expect(onPlacementUnitCostChange).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByRole('button', { name: /suggested price/i }));
    expect(onPlacementUnitCostChange).toHaveBeenLastCalledWith(null);

    const placementToggle = document.querySelector<HTMLInputElement>(
      '[data-action-id="amendments.city-inspector.toggle.placement-property"]'
    );
    expect(placementToggle).toBeTruthy();
    fireEvent.click(placementToggle as HTMLInputElement);
    expect(onPlacementPropertyChange).toHaveBeenCalledWith('accessibility', false);
  });

  it('dispatches selected-object controls through stable inspector actions', () => {
    const sidewalk = createCorridorCityDesignObject({
      id: 'sidewalk-inspector-1',
      type: 'sidewalk',
      start: { x: 0, z: 0 },
      end: { x: 8, z: 0 },
      width: 2.4,
      overrides: {
        properties: {
          accessibility: true,
          deckElevationMeters: 0,
          layerIndex: 0,
          pathType: 'sidewalk',
          structureKind: 'surface',
          surface: 'paving_stones',
        },
      },
    });
    const selectedObject = {
      ...sidewalk,
      cost: { ...sidewalk.cost, customUnitCostMinor: 9_900 },
    };
    const onPropertyChange = vi.fn();
    const onUnitCostChange = vi.fn();
    const onDeleteObject = vi.fn();

    render(
      <CityDesignInspectorView
        selectedObject={selectedObject}
        selectedOsmWay={null}
        selectedObjectCostLine={null}
        selectedTool="sidewalk"
        interactionMode="select"
        placementSettings={{
          type: 'sidewalk',
          width: 2.4,
          rotationDeg: 0,
          rotationLocked: false,
          properties: {},
          customUnitCostMinor: null,
        }}
        placementPreview={null}
        placementMode={null}
        readOnly={false}
        onPlacementPropertyChange={vi.fn()}
        onPlacementWidthChange={vi.fn()}
        onPlacementRotationChange={vi.fn()}
        onPlacementUnitCostChange={vi.fn()}
        onPropertyChange={onPropertyChange}
        onWidthChange={vi.fn()}
        onRotationChange={vi.fn()}
        onUnitCostChange={onUnitCostChange}
        onDeleteObject={onDeleteObject}
        onHideOsmWay={vi.fn()}
      />
    );

    fireEvent.click(
      document.querySelector<HTMLInputElement>(
        '[data-action-id="amendments.city-inspector.toggle.object-property"]'
      ) as HTMLInputElement
    );
    fireEvent.click(
      document.querySelector<HTMLElement>(
        '[data-action-id="amendments.city-inspector.reset.object-cost"]'
      ) as HTMLElement
    );
    fireEvent.click(screen.getByRole('button', { name: /remove sidewalk/i }));

    expect(onPropertyChange).toHaveBeenCalledWith('sidewalk-inspector-1', 'accessibility', false);
    expect(onUnitCostChange).toHaveBeenCalledWith('sidewalk-inspector-1', null);
    expect(onDeleteObject).toHaveBeenCalledWith('sidewalk-inspector-1');
  });

  it('hides a selected OSM way through a stable inspector action', () => {
    const onHideOsmWay = vi.fn();
    render(
      <CityDesignInspectorView
        selectedObject={null}
        selectedOsmWay={{
          id: 'osm-way-1',
          kind: 'road',
          geometryKind: 'line',
          points: [
            { lat: 52.52, lon: 13.405 },
            { lat: 52.521, lon: 13.406 },
          ],
          source: 'osm',
        }}
        selectedObjectCostLine={null}
        selectedTool="sidewalk"
        interactionMode="select"
        placementSettings={{
          type: 'sidewalk',
          width: 2.4,
          rotationDeg: 0,
          rotationLocked: false,
          properties: {},
          customUnitCostMinor: null,
        }}
        placementPreview={null}
        placementMode={null}
        readOnly={false}
        onPlacementPropertyChange={vi.fn()}
        onPlacementWidthChange={vi.fn()}
        onPlacementRotationChange={vi.fn()}
        onPlacementUnitCostChange={vi.fn()}
        onPropertyChange={vi.fn()}
        onWidthChange={vi.fn()}
        onRotationChange={vi.fn()}
        onUnitCostChange={vi.fn()}
        onDeleteObject={vi.fn()}
        onHideOsmWay={onHideOsmWay}
      />
    );

    fireEvent.click(
      document.querySelector<HTMLElement>(
        '[data-action-id="amendments.city-inspector.hide.osm-way"]'
      ) as HTMLElement
    );

    expect(onHideOsmWay).toHaveBeenCalledWith('osm-way-1');
  });

  it('dispatches placement and object property selections through stable actions', async () => {
    const onPlacementPropertyChange = vi.fn();
    const { rerender } = render(
      <CityDesignInspectorView
        selectedObject={null}
        selectedOsmWay={null}
        selectedObjectCostLine={null}
        selectedTool="building"
        interactionMode="place"
        placementSettings={{
          type: 'building',
          width: 8,
          rotationDeg: 0,
          rotationLocked: false,
          properties: {
            color: '#b6aa9b',
            floors: 3,
            height: 9,
            renderColor: '#b6aa9b',
            semanticUse: 'mixed',
            use: 'mixed',
          },
          customUnitCostMinor: null,
        }}
        placementPreview={null}
        placementMode={null}
        readOnly={false}
        onPlacementPropertyChange={onPlacementPropertyChange}
        onPlacementWidthChange={vi.fn()}
        onPlacementRotationChange={vi.fn()}
        onPlacementUnitCostChange={vi.fn()}
        onPropertyChange={vi.fn()}
        onWidthChange={vi.fn()}
        onRotationChange={vi.fn()}
        onUnitCostChange={vi.fn()}
        onDeleteObject={vi.fn()}
        onHideOsmWay={vi.fn()}
      />
    );

    const placementTrigger = document.querySelector<HTMLElement>(
      '[data-action-id="amendments.city-inspector.select.placement-property"]'
    );
    expect(placementTrigger).toBeTruthy();
    fireEvent.keyDown(placementTrigger as HTMLElement, { key: 'Enter' });
    const placementOption = await screen.findByRole('option', { name: 'Brick' });
    expect(placementOption.getAttribute('data-action-id')).toBe(
      'amendments.city-inspector.select.placement-property-option'
    );
    fireEvent.click(placementOption);
    expect(onPlacementPropertyChange).toHaveBeenCalled();

    const building = createCorridorCityDesignObject({
      id: 'building-inspector-1',
      type: 'building',
      start: { x: 0, z: 0 },
      end: { x: 8, z: 0 },
      width: 8,
    });
    const onPropertyChange = vi.fn();
    rerender(
      <CityDesignInspectorView
        selectedObject={building}
        selectedOsmWay={null}
        selectedObjectCostLine={null}
        selectedTool="building"
        interactionMode="select"
        placementSettings={{
          type: 'building',
          width: 8,
          rotationDeg: 0,
          rotationLocked: false,
          properties: {},
          customUnitCostMinor: null,
        }}
        placementPreview={null}
        placementMode={null}
        readOnly={false}
        onPlacementPropertyChange={vi.fn()}
        onPlacementWidthChange={vi.fn()}
        onPlacementRotationChange={vi.fn()}
        onPlacementUnitCostChange={vi.fn()}
        onPropertyChange={onPropertyChange}
        onWidthChange={vi.fn()}
        onRotationChange={vi.fn()}
        onUnitCostChange={vi.fn()}
        onDeleteObject={vi.fn()}
        onHideOsmWay={vi.fn()}
      />
    );

    const objectTrigger = document.querySelector<HTMLElement>(
      '[data-action-id="amendments.city-inspector.select.object-property"]'
    );
    expect(objectTrigger).toBeTruthy();
    fireEvent.keyDown(objectTrigger as HTMLElement, { key: 'Enter' });
    const objectOption = await screen.findByRole('option', { name: 'Brick' });
    expect(objectOption.getAttribute('data-action-id')).toBe(
      'amendments.city-inspector.select.object-property-option'
    );
    fireEvent.click(objectOption);
    expect(onPropertyChange).toHaveBeenCalled();
  });
});
