/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CityDesignInspectorView } from '../CityDesignInspectorView';

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
  });
});
