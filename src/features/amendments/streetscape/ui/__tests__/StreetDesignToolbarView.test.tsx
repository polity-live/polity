/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StreetDesignToolbarView } from '../StreetDesignToolbarView';

describe('StreetDesignToolbarView', () => {
  it('renders the building tool and switches to camera mode', () => {
    const onToolChange = vi.fn();
    const onInteractionModeChange = vi.fn();
    const onComparisonModeChange = vi.fn();
    const onOsmLayerVisibilityChange = vi.fn();
    const onShowStreetMarkingsChange = vi.fn();

    render(
      <StreetDesignToolbarView
        selectedTool="tree"
        interactionMode="place"
        comparisonMode="overlay"
        osmLayerVisibility={{ road: true, building: true, green: true, water: true }}
        showStreetMarkings={true}
        readOnly={false}
        onToolChange={onToolChange}
        onInteractionModeChange={onInteractionModeChange}
        onComparisonModeChange={onComparisonModeChange}
        onOsmLayerVisibilityChange={onOsmLayerVisibilityChange}
        onShowStreetMarkingsChange={onShowStreetMarkingsChange}
      />
    );

    expect(screen.getByRole('button', { name: /importierte gebaeude/i })).toBeTruthy();

    const buildingButtons = screen.getAllByRole('button', { name: /gebaeude/i });
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
  });
});
