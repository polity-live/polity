/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPointStreetDesignObject } from '../../logic/streetDesignPlacement';
import { DEFAULT_STREET_DESIGN_OSM_LAYER_VISIBILITY } from '../../logic/streetDesignOsm';
import { createEmptyStreetDesignState } from '../../state/streetDesignReducer';
import type { StreetDesignStateV1 } from '../../types';
import { StreetSceneCanvasViewView } from '../StreetSceneCanvasViewView';

afterEach(() => {
  cleanup();
});

function renderCanvasView(
  overrides: Partial<Parameters<typeof StreetSceneCanvasViewView>[0]> = {}
) {
  const tree = createPointStreetDesignObject({
    id: 'tree-123456',
    type: 'tree',
    point: { x: 0, z: 0 },
  });

  return render(
    <StreetSceneCanvasViewView
      design={createEmptyStreetDesignState()}
      isLoadingOsm={false}
      placementMode={null}
      placementPointCount={0}
      canFinishPathPlacement={false}
      selectedObject={tree}
      selectedObjectCostLine={null}
      selectedOsmWay={null}
      interactionMode="place"
      readOnly={false}
      onFinishPathPlacement={vi.fn()}
      onCancelPlacement={vi.fn()}
      onObjectSelect={vi.fn()}
      onOsmWaySelect={vi.fn()}
      onObjectVisibilityChange={vi.fn()}
      onOsmWayHide={vi.fn()}
      onPropertyChange={vi.fn()}
      onWidthChange={vi.fn()}
      onRotationChange={vi.fn()}
      onUnitCostChange={vi.fn()}
      onDeleteObject={vi.fn()}
      canvasRef={{ current: null }}
      loadFailed={false}
      {...overrides}
    />
  );
}

function createTestDesign(overrides: Partial<StreetDesignStateV1> = {}): StreetDesignStateV1 {
  const baseDesign = createEmptyStreetDesignState();
  return {
    ...baseDesign,
    ...overrides,
  };
}

describe('StreetSceneCanvasViewView', () => {
  it('does not show the OSM loading bar by default', () => {
    renderCanvasView({ selectedObject: null });

    expect(screen.queryByRole('progressbar', { name: 'Loading OSM data' })).toBeNull();
  });

  it('shows an optimistic loading bar while OSM data is loading', () => {
    renderCanvasView({ isLoadingOsm: true, selectedObject: null });

    const progressbar = screen.getByRole('progressbar', { name: 'Loading OSM data' });
    expect(progressbar.getAttribute('data-motion-style')).toBe('optimistic');
  });

  it('shows a delete action for a selected placed object', () => {
    const onDeleteObject = vi.fn();
    renderCanvasView({ onDeleteObject });

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));

    expect(onDeleteObject).toHaveBeenCalledWith('tree-123456');
  });

  it('shows path placement controls while drawing curves', () => {
    const onFinishPathPlacement = vi.fn();
    const onCancelPlacement = vi.fn();
    renderCanvasView({
      selectedObject: null,
      placementMode: 'path',
      placementPointCount: 2,
      canFinishPathPlacement: true,
      onFinishPathPlacement,
      onCancelPlacement,
    });

    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onFinishPathPlacement).toHaveBeenCalled();
    expect(onCancelPlacement).toHaveBeenCalled();
  });

  it('renders an accordion legend with placement presets', () => {
    const { container } = renderCanvasView({ selectedObject: null });

    expect(screen.queryByRole('button', { name: /legend/i })).not.toBeNull();
    expect(screen.queryByText('Placement options')).not.toBeNull();
    expect(screen.queryAllByText('Office building')).toHaveLength(1);
    expect(screen.queryAllByText('Residential building')).toHaveLength(1);
    expect(screen.queryAllByText('Conifer tree')).toHaveLength(1);
    expect(screen.queryAllByText('Fruit tree')).toHaveLength(1);
    expect(screen.queryAllByText('Primary street')).toHaveLength(1);
    expect(screen.queryAllByText('Residential street')).toHaveLength(1);
    expect(screen.queryAllByTestId('street-design-legend-preview-building').length).toBeGreaterThan(
      1
    );
    expect(screen.queryAllByTestId('street-design-legend-preview-tree').length).toBeGreaterThan(1);
    expect(screen.queryAllByTestId('street-design-legend-preview-street').length).toBeGreaterThan(
      1
    );
    expect(
      container.querySelector('[data-legend-entry-id="planned-preset:building-office"]')
    ).not.toBeNull();
  });

  it('renders visible existing OSM feature layers in the legend', () => {
    const { container } = renderCanvasView({
      design: createTestDesign({
        osmSnapshot: {
          fetchedAt: 1,
          bbox: { south: 52.51, west: 13.4, north: 52.52, east: 13.41 },
          features: [
            {
              id: 'road-1',
              kind: 'road',
              geometryKind: 'line',
              points: [
                { lat: 52.51, lon: 13.4 },
                { lat: 52.52, lon: 13.41 },
              ],
            },
          ],
        },
      }),
      selectedObject: null,
    });

    expect(screen.queryByText('Existing')).not.toBeNull();
    expect(container.querySelector('[data-legend-entry-id="existing:road"]')).not.toBeNull();
  });

  it('keeps existing OSM filtering while placement presets remain visible', () => {
    renderCanvasView({
      design: createTestDesign({
        hiddenOsmFeatureIds: ['water-hidden'],
        osmLayerVisibility: {
          ...DEFAULT_STREET_DESIGN_OSM_LAYER_VISIBILITY,
          building: false,
          road: false,
        },
        osmSnapshot: {
          fetchedAt: 1,
          bbox: { south: 52.51, west: 13.4, north: 52.52, east: 13.41 },
          features: [
            {
              id: 'road-1',
              kind: 'road',
              geometryKind: 'line',
              points: [
                { lat: 52.51, lon: 13.4 },
                { lat: 52.52, lon: 13.41 },
              ],
            },
            {
              id: 'road-2',
              kind: 'road',
              geometryKind: 'line',
              points: [
                { lat: 52.511, lon: 13.4 },
                { lat: 52.521, lon: 13.41 },
              ],
            },
            {
              id: 'building-hidden-by-layer',
              kind: 'building',
              geometryKind: 'polygon',
              points: [
                { lat: 52.51, lon: 13.4 },
                { lat: 52.51, lon: 13.401 },
                { lat: 52.511, lon: 13.401 },
                { lat: 52.51, lon: 13.4 },
              ],
            },
            {
              id: 'water-hidden',
              kind: 'water',
              geometryKind: 'polygon',
              points: [
                { lat: 52.512, lon: 13.4 },
                { lat: 52.512, lon: 13.401 },
                { lat: 52.513, lon: 13.401 },
                { lat: 52.512, lon: 13.4 },
              ],
            },
          ],
        },
      }),
      selectedObject: null,
    });

    expect(screen.queryByText('Existing')).toBeNull();
    expect(screen.queryByText('Placement options')).not.toBeNull();
    expect(screen.queryByText('Office building')).not.toBeNull();
  });

  it('toggles legend entries through the accordion button', () => {
    renderCanvasView({ selectedObject: null });

    expect(screen.queryByText('Office building')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /legend/i }));

    expect(screen.queryByText('Office building')).toBeNull();
  });

  it('renders selectable spatial change request overlays', () => {
    const onChangeRequestSelect = vi.fn();
    const tree = createPointStreetDesignObject({
      id: 'tree-cr',
      type: 'tree',
      point: { x: 0, z: 0 },
    });

    renderCanvasView({
      design: createTestDesign({ objects: [tree] }),
      selectedObject: null,
      showChangeRequests: true,
      changeRequests: [
        {
          id: 'cr-add-tree',
          source_type: 'street_design_object',
          source_id: 'tree-cr',
          title: 'Add canopy tree',
          change_type: 'add',
        },
      ],
      onChangeRequestSelect,
    });

    const marker = screen.getByRole('button', { name: 'Add canopy tree' });
    expect(marker.getAttribute('data-change-request-tone')).toBe('add');

    fireEvent.click(marker);

    expect(onChangeRequestSelect).toHaveBeenCalledWith('cr-add-tree');
  });
});
