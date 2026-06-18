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

    fireEvent.click(screen.getByRole('button', { name: /platzieren/i }));
    expect(onInteractionModeChange).toHaveBeenCalledWith('place');

    fireEvent.click(screen.getByRole('button', { name: /selektieren/i }));
    expect(onInteractionModeChange).toHaveBeenCalledWith('select');

    expect(screen.getByText('OSM Bestand')).toBeTruthy();
    expect(screen.getByText('Neue Elemente')).toBeTruthy();
    expect(screen.getByText('Hinzugefügt')).toBeTruthy();

    const buildingButtons = screen.getAllByRole('button', { name: /gebaeude/i });
    expect(buildingButtons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(buildingButtons[buildingButtons.length - 1]);
    expect(onToolChange).toHaveBeenCalledWith('building');

    const waterButtons = screen.getAllByRole('button', { name: /wasser/i });
    fireEvent.click(waterButtons[waterButtons.length - 1]);
    expect(onToolChange).toHaveBeenCalledWith('water_area');

    fireEvent.click(screen.getByRole('button', { name: /kamera/i }));
    expect(onInteractionModeChange).toHaveBeenCalledWith('camera');

    fireEvent.click(buildingButtons[0]);
    expect(onOsmLayerVisibilityChange).toHaveBeenCalledWith('building', false);

    fireEvent.click(screen.getByRole('button', { name: /markierungen/i }));
    expect(onShowStreetMarkingsChange).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: /bestand einklappen/i }));
    expect(screen.getByRole('button', { name: /bestand ausklappen/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /neue elemente einklappen/i }));
    expect(screen.getByRole('button', { name: /neue elemente ausklappen/i })).toBeTruthy();

    expect(screen.getByTitle('Gruen ausklappen')).toBeTruthy();
    fireEvent.click(screen.getByTitle('Gruen ausklappen'));
    expect(screen.getByTitle('Gruen einklappen')).toBeTruthy();

    fireEvent.click(screen.getByTitle('Baum auswählen'));
    expect(onObjectSelect).toHaveBeenCalledWith('tree-1');

    fireEvent.click(screen.getByTitle('Baum ausblenden'));
    expect(onObjectVisibilityChange).toHaveBeenCalledWith('tree-1', false);

    fireEvent.click(screen.getByTitle('Gruen ausblenden'));
    expect(onObjectCategoryVisibilityChange).toHaveBeenCalledWith('greenery', false);

    fireEvent.click(screen.getByTitle('Baum entfernen'));
    expect(onObjectDelete).toHaveBeenCalledWith('tree-1');

    fireEvent.click(screen.getByTitle('Gruen entfernen'));
    expect(onObjectCategoryDelete).toHaveBeenCalledWith('greenery');
  });
});
