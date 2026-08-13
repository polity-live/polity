/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CITY_DESIGN_OSM_LAYER_VISIBILITY } from '../../logic/cityDesignOsm';
import { createPointCityDesignObject } from '../../logic/cityDesignPlacement';
import { CityDesignToolbarView, cityDesignToolbarInternals } from '../CityDesignToolbarView';

afterEach(cleanup);

describe('CityDesignToolbarView A04 alternatives', () => {
  it('classifies bare and explicitly configured tools', () => {
    const isSelected = cityDesignToolbarInternals.isSectionToolSelected;
    expect(
      isSelected({
        tool: { id: 'lamp', objectType: 'street_lamp' },
        selectedTool: 'street_lamp',
        selectedToolProperties: {},
      })
    ).toBe(true);
    expect(
      isSelected({
        tool: {
          id: 'configured-lamp',
          objectType: 'street_lamp',
          propertyOverrides: { height: 5 },
          selectionPropertyKeys: [],
        },
        selectedTool: 'street_lamp',
        selectedToolProperties: {},
      })
    ).toBe(false);
  });

  it('renders inactive layers, markings, an empty added section, and place mode', () => {
    const { container } = renderToolbar({
      interactionMode: 'place',
      objects: [],
      readOnly: true,
      osmLayerVisibility: Object.fromEntries(
        Object.keys(DEFAULT_CITY_DESIGN_OSM_LAYER_VISIBILITY).map(key => [key, false])
      ) as unknown as typeof DEFAULT_CITY_DESIGN_OSM_LAYER_VISIBILITY,
      showStreetMarkings: false,
    });

    expect(
      getActionButton(container, 'amendments.city-toolbar.select.mode-place').className
    ).toContain('bg-brand');
    expect(container.textContent).toMatch(/no elements yet/i);
    expect(
      getActionButton(container, 'amendments.city-toolbar.toggle.osm-layer', /buildings/i).className
    ).not.toContain('bg-brand');
    expect(
      getActionButton(container, 'amendments.city-toolbar.toggle.street-markings', /markings/i)
        .className
    ).not.toContain('bg-brand');
    fireEvent.click(
      getActionButton(container, 'amendments.city-toolbar.toggle.added-section', /collapse added/i)
    );
    expect(
      getActionButton(container, 'amendments.city-toolbar.toggle.added-section', /expand added/i)
    ).toBeTruthy();
  });

  it('selects a plain tool and renders selected hidden category and object states', () => {
    const lamp = createPointCityDesignObject({
      id: 'lamp-1',
      type: 'street_lamp',
      point: { x: 0, z: 0 },
    });
    const { container, props } = renderToolbar({
      selectedTool: 'street_lamp',
      interactionMode: 'camera',
      objects: [lamp],
      selectedObjectId: 'lamp-1',
      hiddenObjectIds: ['lamp-1'],
      hiddenObjectCategories: ['furniture'],
    });

    expect(
      getActionButton(container, 'amendments.city-toolbar.select.mode-camera').className
    ).toContain('bg-brand');
    const lampTool = getActionButton(
      container,
      'amendments.city-toolbar.select.placement-tool',
      /street lamp/i
    );
    expect(lampTool.className).toContain('bg-brand');
    fireEvent.click(lampTool);
    expect(props.onToolChange).toHaveBeenCalledWith('street_lamp');

    fireEvent.click(
      getActionButton(
        container,
        'amendments.city-toolbar.toggle.object-category',
        'Expand Furniture'
      )
    );
    expect(
      getActionButton(
        container,
        'amendments.city-toolbar.toggle.object-category',
        'Collapse Furniture'
      )
    ).toBeTruthy();
    expect(
      getActionButton(
        container,
        'amendments.city-toolbar.select.object-category',
        'Select Furniture'
      ).className
    ).toContain('text-left');
    expect(
      getActionButton(
        container,
        'amendments.city-toolbar.toggle.object-visibility',
        'Show Street lamp'
      )
    ).toBeTruthy();
    fireEvent.click(
      getActionButton(
        container,
        'amendments.city-toolbar.toggle.object-category',
        'Collapse Furniture'
      )
    );
    expect(
      getActionButton(
        container,
        'amendments.city-toolbar.toggle.object-category',
        'Expand Furniture'
      )
    ).toBeTruthy();
  });
});

function getActionButton(
  container: HTMLElement,
  actionId: string,
  label?: string | RegExp
): HTMLButtonElement {
  const candidates = Array.from(
    container.querySelectorAll<HTMLButtonElement>(`button[data-action-id="${actionId}"]`)
  );
  const button = candidates.find(candidate => {
    if (!label) return true;
    const accessibleLabel = candidate.getAttribute('aria-label') ?? candidate.textContent ?? '';
    return typeof label === 'string' ? accessibleLabel === label : label.test(accessibleLabel);
  });

  expect(button, `${actionId} ${String(label ?? '')}`.trim()).toBeTruthy();
  return button!;
}

function renderToolbar(overrides: Partial<Parameters<typeof CityDesignToolbarView>[0]> = {}) {
  const props: Parameters<typeof CityDesignToolbarView>[0] = {
    selectedTool: 'tree',
    selectedToolProperties: {},
    interactionMode: 'select',
    objects: [],
    selectedObjectId: null,
    hiddenObjectIds: [],
    hiddenObjectCategories: [],
    osmLayerVisibility: DEFAULT_CITY_DESIGN_OSM_LAYER_VISIBILITY,
    showStreetMarkings: true,
    readOnly: false,
    onToolChange: vi.fn(),
    onInteractionModeChange: vi.fn(),
    onObjectSelect: vi.fn(),
    onObjectVisibilityChange: vi.fn(),
    onObjectCategoryVisibilityChange: vi.fn(),
    onObjectDelete: vi.fn(),
    onObjectCategoryDelete: vi.fn(),
    onOsmLayerVisibilityChange: vi.fn(),
    onShowStreetMarkingsChange: vi.fn(),
    ...overrides,
  };
  const view = render(<CityDesignToolbarView {...props} />);
  return { ...view, props };
}
