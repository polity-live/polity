/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPointCityDesignObject } from '../../logic/cityDesignPlacement';
import { DEFAULT_CITY_DESIGN_OSM_LAYER_VISIBILITY } from '../../logic/cityDesignOsm';
import { createEmptyCityDesignState } from '../../state/cityDesignReducer';
import type { CityDesignStateV1 } from '../../types';
import {
  getBoundedCanvasPopoverPlacement,
  projectLocalPointToCanvasAnchor,
  CityDesignOsmPopover,
  StreetSceneCanvasViewView,
} from '../StreetSceneCanvasViewView';

afterEach(() => {
  cleanup();
});

function renderCanvasView(
  overrides: Partial<Parameters<typeof StreetSceneCanvasViewView>[0]> = {}
) {
  const tree = createPointCityDesignObject({
    id: 'tree-123456',
    type: 'tree',
    point: { x: 0, z: 0 },
  });

  return render(
    <StreetSceneCanvasViewView
      design={createEmptyCityDesignState()}
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

function createTestDesign(overrides: Partial<CityDesignStateV1> = {}): CityDesignStateV1 {
  const baseDesign = createEmptyCityDesignState();
  return {
    ...baseDesign,
    ...overrides,
  };
}

describe('StreetSceneCanvasViewView', () => {
  it('shows semantic OSM mapping and imports an exact feature as a planned change', () => {
    const onImportOsmWay = vi.fn();
    render(
      <CityDesignOsmPopover
        osmWay={{
          id: 'charger-1',
          kind: 'utility',
          geometryKind: 'point',
          point: { lat: 52.52, lon: 13.405 },
          tags: { amenity: 'charging_station' },
          subkind: 'charging_station',
          mappedObjectType: 'charging_station',
          mappedProperties: { capacity: 2 },
          mappingConfidence: 'exact',
          renderProfile: 'utility',
          source: 'osm',
        }}
        readOnly={false}
        hideReadOnly={false}
        onClose={vi.fn()}
        onHideOsmWay={vi.fn()}
        onImportOsmWay={onImportOsmWay}
      />
    );

    expect(screen.getByText('Charging station · Exact mapping')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Import as planned change' }));
    expect(onImportOsmWay).toHaveBeenCalledWith('charger-1');
  });

  it('does not show the OSM loading bar by default', () => {
    renderCanvasView({ selectedObject: null });

    expect(screen.queryByRole('progressbar', { name: 'Loading OSM data' })).toBeNull();
  });

  it('shows an optimistic loading bar while OSM data is loading', () => {
    renderCanvasView({ isLoadingOsm: true, selectedObject: null });

    const progressbar = screen.getByRole('progressbar', { name: 'Loading OSM data' });
    expect(progressbar.getAttribute('data-motion-style')).toBe('optimistic');
    const overlay = progressbar.closest('[data-slot="osm-loading-overlay"]');
    expect(overlay?.className).toContain('top-1/2');
    expect(overlay?.className).toContain('left-1/2');
    expect(overlay?.className).toContain('-translate-x-1/2');
    expect(overlay?.className).toContain('-translate-y-1/2');
  });

  it('renders a taller scroll-friendly canvas', () => {
    const { container } = renderCanvasView({ selectedObject: null });

    expect(container.querySelector('canvas')?.className).toContain('h-[42rem]');
    expect(
      container.querySelector('[data-tutorial-anchor="city-design-map-canvas"]')
    ).not.toBeNull();
  });

  it('renders non-interactive remote cursors with their presence identity', () => {
    renderCanvasView({
      selectedObject: null,
      remoteCursors: [
        {
          userId: 'user-remote',
          name: 'Grace Hopper',
          color: '#2563eb',
          position: { x: 0, z: 0 },
          layer: 'design',
        },
      ],
    });

    const cursor = screen.getByTestId('city-design-remote-cursor-user-remote');
    expect(cursor.textContent).toContain('Grace Hopper');
    expect(cursor.getAttribute('style')).toContain('color: rgb(37, 99, 235)');
    expect(cursor.parentElement?.className).toContain('pointer-events-none');
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
    const legendButton = screen.getByRole('button', { name: /legend/i });
    const legendRoot = legendButton.parentElement;

    expect(legendButton).not.toBeNull();
    expect(legendRoot?.className).toContain('right-6');
    expect(legendRoot?.className).toContain('bottom-6');
    expect(legendRoot?.lastElementChild).toBe(legendButton);
    expect(screen.queryByText('Placement options')).toBeNull();

    fireEvent.click(legendButton);

    expect(screen.queryByText('Placement options')).not.toBeNull();
    expect(screen.queryAllByText('Office building')).toHaveLength(1);
    expect(screen.queryAllByText('Residential building')).toHaveLength(1);
    expect(screen.queryAllByText('Conifer tree')).toHaveLength(1);
    expect(screen.queryAllByText('Fruit tree')).toHaveLength(1);
    expect(screen.queryAllByText('Primary street')).toHaveLength(1);
    expect(screen.queryAllByText('Residential street')).toHaveLength(1);
    expect(screen.queryAllByTestId('city-design-legend-preview-building').length).toBeGreaterThan(
      1
    );
    expect(screen.queryAllByTestId('city-design-legend-preview-tree').length).toBeGreaterThan(1);
    expect(screen.queryAllByTestId('city-design-legend-preview-street').length).toBeGreaterThan(1);
    expect(screen.queryAllByTestId('city-design-legend-preview-car_lane').length).toBeGreaterThan(
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

    fireEvent.click(screen.getByRole('button', { name: /legend/i }));

    expect(screen.queryByText('Existing')).not.toBeNull();
    expect(container.querySelector('[data-legend-entry-id="existing:road"]')).not.toBeNull();
  });

  it('keeps existing OSM filtering while placement presets remain visible', () => {
    renderCanvasView({
      design: createTestDesign({
        hiddenOsmFeatureIds: ['water-hidden'],
        osmLayerVisibility: {
          ...DEFAULT_CITY_DESIGN_OSM_LAYER_VISIBILITY,
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

    fireEvent.click(screen.getByRole('button', { name: /legend/i }));

    expect(screen.queryByText('Existing')).toBeNull();
    expect(screen.queryByText('Placement options')).not.toBeNull();
    expect(screen.queryByText('Office building')).not.toBeNull();
  });

  it('toggles legend entries through the accordion button', () => {
    renderCanvasView({ selectedObject: null });

    expect(screen.queryByText('Office building')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /legend/i }));

    expect(screen.queryByText('Office building')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /legend/i }));

    expect(screen.queryByText('Office building')).toBeNull();
  });

  it('renders selectable spatial change request overlays', () => {
    const onChangeRequestSelect = vi.fn();
    const tree = createPointCityDesignObject({
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
          source_type: 'city_design_object',
          source_id: 'tree-cr',
          title: 'Add canopy tree',
          change_type: 'add',
        },
      ],
      onChangeRequestSelect,
    });

    const marker = screen.getByTestId('city-design-cr-marker-cr-add-tree');
    expect(marker.getAttribute('data-change-request-tone')).toBe('add');
    expect(marker.textContent).toContain('Add canopy tree');
    expect(marker.textContent).toContain('CR-');

    fireEvent.click(marker);

    expect(onChangeRequestSelect).toHaveBeenCalledWith('cr-add-tree');
  });

  it('places change request popovers inward near canvas edges', () => {
    expect(getBoundedCanvasPopoverPlacement({ leftPercent: 2, topPercent: 50 })).toMatchObject({
      leftPercent: 4,
      topPercent: 50,
      transform: 'translate(0, -50%)',
    });
    expect(getBoundedCanvasPopoverPlacement({ leftPercent: 98, topPercent: 90 })).toMatchObject({
      leftPercent: 96,
      topPercent: 90,
      transform: 'translate(-100%, -100%)',
    });
  });

  it('projects canvas anchors from the current scene camera pose', () => {
    const canvasSize = { width: 1000, height: 500 };
    const defaultPose = {
      position: { x: 0, y: 75, z: 85 },
      target: { x: 0, y: 0, z: 0 },
    };
    const pannedPose = {
      position: { x: 20, y: 75, z: 85 },
      target: { x: 20, y: 0, z: 0 },
    };

    const centeredAnchor = projectLocalPointToCanvasAnchor({ x: 0, z: 0 }, defaultPose, canvasSize);
    const pannedAnchor = projectLocalPointToCanvasAnchor({ x: 0, z: 0 }, pannedPose, canvasSize);

    expect(centeredAnchor?.leftPercent).toBeCloseTo(50, 1);
    expect(centeredAnchor?.topPercent).toBeCloseTo(50, 1);
    expect(pannedAnchor?.leftPercent).toBeLessThan(50);
  });
});
