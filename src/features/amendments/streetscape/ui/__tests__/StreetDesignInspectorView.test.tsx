/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StreetDesignInspectorView } from '../StreetDesignInspectorView';

describe('StreetDesignInspectorView', () => {
  it('renders combobox suggestions while allowing custom placement values', () => {
    const onPlacementPropertyChange = vi.fn();

    render(
      <StreetDesignInspectorView
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

    const pathTypeInput = screen.getByRole('combobox', { name: /path type/i });
    expect(pathTypeInput.getAttribute('list')).toBe('street-design-placement-pathType');
    expect(document.querySelector('option[value="promenade"]')).toBeTruthy();

    fireEvent.change(pathTypeInput, { target: { value: 'shared_space' } });

    expect(onPlacementPropertyChange).toHaveBeenCalledWith('pathType', 'shared_space');
  });
});
