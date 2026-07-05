/* @vitest-environment jsdom */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_STREET_DESIGN_OSM_LAYER_VISIBILITY } from '../../logic/streetDesignOsm';
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
        selectedToolProperties={{}}
        interactionMode="select"
        objects={[tree]}
        selectedObjectId={null}
        hiddenObjectIds={[]}
        hiddenObjectCategories={[]}
        osmLayerVisibility={DEFAULT_STREET_DESIGN_OSM_LAYER_VISIBILITY}
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
    expect(screen.getAllByText('Parking').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Construction').length).toBeGreaterThanOrEqual(2);

    const treesSection = screen.getAllByText('Trees').at(-1)?.closest('section');
    expect(treesSection).toBeTruthy();
    expect(
      within(treesSection as HTMLElement).queryByRole('button', { name: /^tree$/i })
    ).toBeNull();
    expect(
      within(treesSection as HTMLElement).getByRole('button', { name: /ornamental cherry/i })
    ).toBeTruthy();
    expect(
      within(treesSection as HTMLElement).getByRole('button', { name: /flowering plum/i })
    ).toBeTruthy();
    fireEvent.click(within(treesSection as HTMLElement).getByRole('button', { name: /conifer/i }));
    expect(onToolChange).toHaveBeenCalledWith(
      'tree',
      expect.objectContaining({
        canopyDiameter: 2.8,
        height: 6,
        spacing: 6,
        species: 'conifer',
      }),
      undefined
    );

    const parkingSection = screen.getAllByText('Parking').at(-1)?.closest('section');
    expect(parkingSection).toBeTruthy();
    expect(
      within(parkingSection as HTMLElement).getByRole('button', { name: /loading zone/i })
    ).toBeTruthy();

    const contextSection = screen.getAllByText('Context areas').at(-1)?.closest('section');
    expect(contextSection).toBeTruthy();
    expect(
      within(contextSection as HTMLElement).getAllByRole('button', { name: /school/i }).length
    ).toBeGreaterThan(0);

    const buildingSection = screen.getAllByText('Buildings').at(-1)?.closest('section');
    expect(buildingSection).toBeTruthy();
    expect(
      within(buildingSection as HTMLElement).queryByRole('button', { name: /^building$/i })
    ).toBeNull();
    fireEvent.click(
      within(buildingSection as HTMLElement).getByRole('button', { name: /office building/i })
    );
    expect(onToolChange).toHaveBeenCalledWith(
      'building',
      expect.objectContaining({
        color: '#6f7a82',
        renderColor: '#6f7a82',
        semanticUse: 'office',
        use: 'office',
      }),
      undefined
    );

    fireEvent.click(screen.getByRole('button', { name: /pond/i }));
    expect(onToolChange).toHaveBeenCalledWith(
      'water_area',
      expect.objectContaining({ waterType: 'pond' }),
      6
    );

    fireEvent.click(screen.getByRole('button', { name: /protected bike lane/i }));
    expect(onToolChange).toHaveBeenCalledWith(
      'bike_lane',
      expect.objectContaining({ protection: 'protected' }),
      2.2
    );
    fireEvent.click(screen.getByRole('button', { name: /bike bridge/i }));
    expect(onToolChange).toHaveBeenCalledWith(
      'bike_lane',
      expect.objectContaining({
        deckElevationMeters: 3.2,
        level: 'bridge',
        structureKind: 'bridge',
      }),
      2.2
    );

    fireEvent.click(screen.getByRole('button', { name: /road bridge/i }));
    expect(onToolChange).toHaveBeenCalledWith(
      'street',
      expect.objectContaining({
        deckElevationMeters: 3.5,
        layerIndex: 1,
        level: 'bridge',
        structureKind: 'bridge',
      }),
      6
    );

    fireEvent.click(screen.getByRole('button', { name: /rail bridge/i }));
    expect(onToolChange).toHaveBeenCalledWith(
      'rail_track',
      expect.objectContaining({
        deckElevationMeters: 5,
        level: 'bridge',
        structureKind: 'bridge',
      }),
      2.4
    );
    fireEvent.click(screen.getByRole('button', { name: /viaduct/i }));
    expect(onToolChange).toHaveBeenCalledWith(
      'rail_track',
      expect.objectContaining({
        deckElevationMeters: 7.5,
        layerIndex: 2,
        structureKind: 'viaduct',
      }),
      2.4
    );

    fireEvent.click(screen.getByRole('button', { name: /camera/i }));
    expect(onInteractionModeChange).toHaveBeenCalledWith('camera');

    fireEvent.click(screen.getByRole('button', { name: /buildings/i }));
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

    fireEvent.click(screen.getByTitle('Select Deciduous tree'));
    expect(onObjectSelect).toHaveBeenCalledWith('tree-1');

    fireEvent.click(screen.getByTitle('Hide Deciduous tree'));
    expect(onObjectVisibilityChange).toHaveBeenCalledWith('tree-1', false);

    fireEvent.click(screen.getByTitle('Hide Greenery'));
    expect(onObjectCategoryVisibilityChange).toHaveBeenCalledWith('greenery', false);

    fireEvent.click(screen.getByTitle('Remove Deciduous tree'));
    expect(onObjectDelete).toHaveBeenCalledWith('tree-1');

    fireEvent.click(screen.getByTitle('Remove Greenery'));
    expect(onObjectCategoryDelete).toHaveBeenCalledWith('greenery');
  });
});
