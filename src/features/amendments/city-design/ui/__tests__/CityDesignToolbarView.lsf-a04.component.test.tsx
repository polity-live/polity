/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_CITY_DESIGN_OSM_LAYER_VISIBILITY } from '../../logic/cityDesignOsm';
import { createPointCityDesignObject } from '../../logic/cityDesignPlacement';
import { CityDesignToolbarView } from '../CityDesignToolbarView';

afterEach(cleanup);

describe('CityDesignToolbarView LSF category selection', () => {
  it('selects the first object represented by a category header', () => {
    const onObjectSelect = vi.fn();
    const lamp = createPointCityDesignObject({
      id: 'lamp-1',
      type: 'street_lamp',
      point: { x: 0, z: 0 },
    });
    const { container } = render(
      <CityDesignToolbarView
        {...({
          selectedTool: 'tree',
          selectedToolProperties: {},
          interactionMode: 'select',
          objects: [lamp],
          selectedObjectId: null,
          hiddenObjectIds: [],
          hiddenObjectCategories: [],
          osmLayerVisibility: DEFAULT_CITY_DESIGN_OSM_LAYER_VISIBILITY,
          showStreetMarkings: true,
          readOnly: false,
          onToolChange: vi.fn(),
          onInteractionModeChange: vi.fn(),
          onObjectSelect,
          onObjectVisibilityChange: vi.fn(),
          onObjectCategoryVisibilityChange: vi.fn(),
          onObjectDelete: vi.fn(),
          onObjectCategoryDelete: vi.fn(),
          onOsmLayerVisibilityChange: vi.fn(),
          onShowStreetMarkingsChange: vi.fn(),
        } as any)}
      />
    );
    fireEvent.click(
      container.querySelector('[data-action-id="amendments.city-toolbar.toggle.object-category"]')!
    );
    fireEvent.click(
      container.querySelector('[data-action-id="amendments.city-toolbar.select.object-category"]')!
    );
    expect(onObjectSelect).toHaveBeenCalledWith('lamp-1');
  });
});
