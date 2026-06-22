/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createPointStreetDesignObject } from '../../logic/streetDesignPlacement';
import { StreetDesignToolbarView } from '../StreetDesignToolbarView';

describe('StreetDesignToolbarView', () => {
  it('renders tools, switches modes, and toggles existing layers', () => {
    const onToolChange = vi.fn();
    const onInteractionModeChange = vi.fn();
    const onObjectSelect = vi.fn();
    const onObjectVisibilityChange = vi.fn();
    const onObjectCategoryVisibilityChange = vi.fn();
    const onObjectDelete = vi.fn();
    const onObjectCategoryDelete = vi.fn();
    const onOsmLayerVisibilityChange = vi.fn();
    const onShowStreetMarkingsChange = vi.fn();
    const tree = createPointStreetDesignObject({
      id: 'tree-1',
      type: 'tree',
      point: { x: 0, z: 0 },
    });

    render(
      <StreetDesignToolbarView
        selectedTool="tree"
        interactionMode="select"
        objects={[tree]}
        selectedObjectId={null}
        hiddenObjectIds={[]}
        hiddenObjectCategories={[]}
        osmLayerVisibility={{ road: true, building: true, green: true, water: true }}
        showStreetMarkings={true}
        readOnly={false}
        onToolChange={onToolChange}
        onInteractionModeChange={onInteractionModeChange}
        onObjectSelect={onObjectSelect}
        onObjectVisibilityChange={onObjectVisibilityChange}
        onObjectCategoryVisibilityChange={onObjectCategoryVisibilityChange}
        onObjectDelete={onObjectDelete}
        onObjectCategoryDelete={onObjectCategoryDelete}
        onOsmLayerVisibilityChange={onOsmLayerVisibilityChange}
        onShowStreetMarkingsChange={onShowStreetMarkingsChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /place/i }));
    expect(onInteractionModeChange).toHaveBeenCalledWith('place');

    fireEvent.click(screen.getByRole('button', { name: /select/i }));
    expect(onInteractionModeChange).toHaveBeenCalledWith('select');

    expect(screen.getByText('OSM Existing')).toBeTruthy();
    expect(screen.getByText('New elements')).toBeTruthy();
    expect(screen.getByText('Added')).toBeTruthy();

    const buildingButtons = screen.getAllByRole('button', { name: /buildings?/i });
    expect(buildingButtons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(buildingButtons[buildingButtons.length - 1]);
    expect(onToolChange).toHaveBeenCalledWith('building');

    const waterButtons = screen.getAllByRole('button', { name: /water/i });
    fireEvent.click(waterButtons[waterButtons.length - 1]);
    expect(onToolChange).toHaveBeenCalledWith('water_area');

    fireEvent.click(screen.getByRole('button', { name: /camera/i }));
    expect(onInteractionModeChange).toHaveBeenCalledWith('camera');

    fireEvent.click(buildingButtons[0]);
    expect(onOsmLayerVisibilityChange).toHaveBeenCalledWith('building', false);

    fireEvent.click(screen.getByRole('button', { name: /markings/i }));
    expect(onShowStreetMarkingsChange).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: /collapse osm existing/i }));
    expect(screen.getByRole('button', { name: /expand osm existing/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /collapse new elements/i }));
    expect(screen.getByRole('button', { name: /expand new elements/i })).toBeTruthy();

    expect(screen.getByTitle('Expand Greenery')).toBeTruthy();
    fireEvent.click(screen.getByTitle('Expand Greenery'));
    expect(screen.getByTitle('Collapse Greenery')).toBeTruthy();

    fireEvent.click(screen.getByTitle('Select Tree'));
    expect(onObjectSelect).toHaveBeenCalledWith('tree-1');

    fireEvent.click(screen.getByTitle('Hide Tree'));
    expect(onObjectVisibilityChange).toHaveBeenCalledWith('tree-1', false);

    fireEvent.click(screen.getByTitle('Hide Greenery'));
    expect(onObjectCategoryVisibilityChange).toHaveBeenCalledWith('greenery', false);

    fireEvent.click(screen.getByTitle('Remove Tree'));
    expect(onObjectDelete).toHaveBeenCalledWith('tree-1');

    fireEvent.click(screen.getByTitle('Remove Greenery'));
    expect(onObjectCategoryDelete).toHaveBeenCalledWith('greenery');
  });
});
