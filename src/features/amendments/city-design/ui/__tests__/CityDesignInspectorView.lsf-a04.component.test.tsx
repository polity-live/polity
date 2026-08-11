/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPointCityDesignObject } from '../../logic/cityDesignPlacement';
import { getCityDesignObjectDefinition } from '../../logic/cityDesignObjectRegistry';
import { CityDesignInspectorView } from '../CityDesignInspectorView';

afterEach(cleanup);

function base(overrides: Record<string, unknown> = {}) {
  return {
    selectedObject: null,
    selectedOsmWay: null,
    selectedObjectCostLine: null,
    selectedTool: 'sidewalk',
    interactionMode: 'place',
    placementSettings: {
      type: 'sidewalk',
      width: 2,
      rotationDeg: 0,
      rotationLocked: false,
      properties: getCityDesignObjectDefinition('sidewalk').defaultProperties,
      customUnitCostMinor: null,
    },
    placementPreview: null,
    placementMode: 'drag_band',
    readOnly: false,
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
    ...overrides,
  } as any;
}

describe('CityDesignInspectorView LSF input callbacks', () => {
  it('dispatches placement width and point-object rotation changes', () => {
    const onPlacementWidthChange = vi.fn();
    const placement = render(<CityDesignInspectorView {...base({ onPlacementWidthChange })} />);
    fireEvent.change(placement.container.querySelector('input[min="0.1"]')!, {
      target: { value: '4' },
    });
    expect(onPlacementWidthChange).toHaveBeenCalledWith(4);
    placement.unmount();

    const onRotationChange = vi.fn();
    const point = createPointCityDesignObject({
      id: 'point-1',
      type: 'tree',
      point: { x: 0, z: 0 },
    });
    const object = render(
      <CityDesignInspectorView
        {...base({
          interactionMode: 'select',
          selectedObject: point,
          onRotationChange,
        })}
      />
    );
    const rotation = Array.from(object.container.querySelectorAll('input[type="number"]')).find(
      input => input.getAttribute('step') === '1'
    );
    fireEvent.change(rotation!, { target: { value: '60' } });
    expect(onRotationChange).toHaveBeenCalledWith('point-1', 60);
  });

  it('dispatches an object combobox value', () => {
    const onPropertyChange = vi.fn();
    const tree = createPointCityDesignObject({
      id: 'tree-1',
      type: 'tree',
      point: { x: 0, z: 0 },
    });
    const { container } = render(
      <CityDesignInspectorView
        {...base({
          interactionMode: 'select',
          selectedObject: tree,
          onPropertyChange,
        })}
      />
    );
    const combobox = container.querySelector('input[list]');
    expect(combobox).toBeTruthy();
    fireEvent.change(combobox!, { target: { value: 'oak' } });
    expect(onPropertyChange).toHaveBeenCalledWith('tree-1', expect.any(String), 'oak');
  });
});
