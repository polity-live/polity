/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyCityDesignState } from '../../state/cityDesignReducer';
import {
  CityDesignOsmPopover,
  StreetSceneCanvasViewView,
  getBoundedCanvasPopoverPlacement,
  projectLocalPointToCanvasAnchor,
  streetSceneCanvasViewInternals as helpers,
} from '../StreetSceneCanvasViewView';

afterEach(cleanup);

describe('StreetSceneCanvasViewView helper branch accountability', () => {
  it('bounds popovers in every horizontal and vertical region', () => {
    expect(getBoundedCanvasPopoverPlacement({ leftPercent: -10, topPercent: -10 })).toEqual({
      leftPercent: 4,
      topPercent: 4,
      transform: 'translate(0, 0)',
    });
    expect(getBoundedCanvasPopoverPlacement({ leftPercent: 50, topPercent: 50 }).transform).toBe(
      'translate(-50%, -50%)'
    );
    expect(getBoundedCanvasPopoverPlacement({ leftPercent: 110, topPercent: 110 })).toEqual({
      leftPercent: 96,
      topPercent: 96,
      transform: 'translate(-100%, -100%)',
    });
  });

  it('projects valid points and rejects degenerate, vertical, and behind-camera points', () => {
    const canvas = { width: 800, height: 400 };
    const camera = {
      position: { x: 0, y: 5, z: 10 },
      target: { x: 0, y: 0, z: 0 },
    } as any;
    expect(projectLocalPointToCanvasAnchor({ x: 0, z: 0 }, camera, canvas)).not.toBeNull();
    expect(
      projectLocalPointToCanvasAnchor(
        { x: 0, z: 0 },
        { position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } } as any,
        canvas
      )
    ).toBeNull();
    expect(
      projectLocalPointToCanvasAnchor(
        { x: 0, z: 0 },
        { position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 10, z: 0 } } as any,
        canvas
      )
    ).toBeNull();
    expect(projectLocalPointToCanvasAnchor({ x: 0, z: 20 }, camera, canvas)).toBeNull();
    expect(
      projectLocalPointToCanvasAnchor({ x: 0, z: 0 }, camera, canvas, { layerOffsetX: 4, y: 2 })
    ).not.toBeNull();
    expect(
      helpers.getTrackedCanvasAnchorFromLocalPoint({
        point: { x: 0, z: 0 },
        cameraPose: camera,
        canvasSize: canvas,
      })
    ).not.toBeNull();
    expect(
      helpers.getTrackedCanvasAnchorFromLocalPoint({
        point: { x: 0, z: 20 },
        cameraPose: camera,
        canvasSize: canvas,
        hideWhenOutside: false,
      })
    ).toEqual(helpers.getCanvasAnchorFromLocalPoint({ x: 0, z: 20 }));
    expect(
      helpers.getTrackedCanvasAnchorFromLocalPoint({
        point: { x: 0, z: 20 },
        cameraPose: camera,
        canvasSize: canvas,
        hideWhenOutside: true,
      })
    ).toBeNull();
    expect(
      helpers.getTrackedCanvasAnchorFromLocalPoint({
        point: { x: 500, z: 0 },
        cameraPose: camera,
        canvasSize: canvas,
        hideWhenOutside: true,
      })
    ).toBeNull();
  });

  it('normalizes canvas, vector, tag, label, and legend edge cases', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 0;
    canvas.height = 0;
    expect(helpers.getCanvasElementSize(canvas)).toEqual({ width: 1, height: 1 });
    canvas.width = 320;
    canvas.height = 180;
    expect(helpers.getCanvasElementSize(canvas)).toEqual({ width: 320, height: 180 });
    expect(helpers.normalizeVector3({ x: 0, y: 0, z: 0 })).toBeNull();
    expect(helpers.normalizeVector3({ x: 3, y: 0, z: 4 })).toEqual({ x: 0.6, y: 0, z: 0.8 });
    expect(helpers.asInputValue(null)).toBe('');
    expect(helpers.asInputValue(12)).toBe('12');
    expect(helpers.sanitizeDomId('one/two')).toBe('one-two');
    expect(helpers.getOsmLayerLabelKey('bike_lane' as any)).toContain('bikeLane');
    expect(helpers.getOsmLayerLabelKey('street_furniture' as any)).toContain('streetFurniture');
    expect(helpers.getOsmLayerLabelKey('landuse_context' as any)).toContain('landuseContext');
    expect(helpers.getOsmLayerLabelKey('road' as any)).toContain('.road');
    expect(helpers.getRelevantOsmTags(undefined)).toEqual([]);
    expect(
      helpers.getRelevantOsmTags({
        name: 'Ignored',
        highway: 'residential',
        'cycleway:left': 'lane',
      })
    ).toEqual([
      ['highway', 'residential'],
      ['cycleway:left', 'lane'],
    ]);
    expect(helpers.isFiniteNumber(1)).toBe(true);
    expect(helpers.isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false);
    expect(helpers.isFiniteNumber('1')).toBe(false);
    expect(helpers.formatMeters(0.25)).toBe('0.25 m');
    expect(helpers.formatMeters(2)).toBe('2.0 m');
    expect(helpers.isCanvasAnchorOutside({ leftPercent: -13, topPercent: 50 }, 12)).toBe(true);
    expect(helpers.isCanvasAnchorOutside({ leftPercent: 113, topPercent: 50 }, 12)).toBe(true);
    expect(helpers.isCanvasAnchorOutside({ leftPercent: 50, topPercent: -13 }, 12)).toBe(true);
    expect(helpers.isCanvasAnchorOutside({ leftPercent: 50, topPercent: 113 }, 12)).toBe(true);
    expect(helpers.isCanvasAnchorOutside({ leftPercent: 50, topPercent: 50 }, 12)).toBe(false);
    expect(helpers.getChangeRequestMarkerClassName('add')).toContain('success');
    expect(helpers.getChangeRequestMarkerClassName('remove')).toContain('danger');
    expect(helpers.getChangeRequestMarkerClassName('update')).toContain('info');
    expect(helpers.getChangeRequestMarkerClassName('unknown' as any)).toContain('border-border');
    expect(helpers.getLegendPreviewKind({ objectType: 'tree' } as any)).toBe('tree');
    expect(helpers.getLegendPreviewKind({ layer: 'road' } as any)).toBe('road');
    expect(helpers.getLegendPreviewKind({ renderKind: 'fallback' } as any)).toBe('fallback');
    for (const [species, expected] of [
      ['stadtbaum', 'deciduous'],
      ['allee', 'deciduous'],
      ['native', 'deciduous'],
      ['obstbaum', 'fruit'],
      ['zierkirsche', 'ornamental_cherry'],
      ['japanese_cherry', 'ornamental_cherry'],
      ['pflaume', 'flowering_plum'],
      ['plum', 'flowering_plum'],
      ['conifer', 'conifer'],
    ]) {
      expect(helpers.getLegendTreeSpecies({ properties: { species } } as any)).toBe(expected);
    }
    expect(helpers.getLegendStringProperty({ properties: {} } as any, 'species', 'fallback')).toBe(
      'fallback'
    );
  });

  it('stacks coincident change-request markers on alternating offsets', () => {
    const markers = helpers.getStackedChangeRequestMarkers([
      { id: 'one', leftPercent: 50, topPercent: 50 },
      { id: 'two', leftPercent: 50, topPercent: 50 },
      { id: 'three', leftPercent: 50, topPercent: 50 },
    ] as any);
    expect(markers.map(marker => marker.leftPercent)).toEqual([50, 53, 50]);
    expect(markers.map(marker => marker.topPercent)).toEqual([50, 55, 60]);
  });

  it('renders unmapped and fully attributed OSM alternatives', () => {
    const base = {
      id: 'way',
      kind: 'road',
      geometryKind: 'point',
      point: { lat: 50, lon: 8 },
      tags: undefined,
      source: 'osm',
    } as any;
    const handlers = { onClose: vi.fn(), onHideOsmWay: vi.fn(), onImportOsmWay: vi.fn() };
    const { rerender } = render(
      <CityDesignOsmPopover {...handlers} osmWay={base} readOnly hideReadOnly />
    );
    expect(screen.getByText(/no safe editable mapping/i)).toBeTruthy();
    expect(
      document.querySelector('[data-action-id="amendments.city-osm-popover.import.as-planned"]')
    ).toBeNull();

    rerender(
      <CityDesignOsmPopover
        {...handlers}
        readOnly={false}
        hideReadOnly={false}
        osmWay={{
          ...base,
          label: 'Bridge',
          subkind: 'bridge',
          mappedObjectType: 'street',
          mappingConfidence: undefined,
          widthMeters: 4,
          height: 3,
          deckElevationMeters: 0,
          baseElevationMeters: 2,
          semanticUse: 'transport',
          tags: { highway: 'residential' },
        }}
      />
    );
    expect(screen.getByText('Bridge')).toBeTruthy();
    fireEvent.click(
      document.querySelector('[data-action-id="amendments.city-osm-popover.remove.from-map"]')!
    );
    expect(handlers.onHideOsmWay).toHaveBeenCalledWith('way');
  });

  it('anchors empty and populated OSM geometry', () => {
    const design = createEmptyCityDesignState();
    expect(
      helpers.getCanvasAnchorFromOsmWay(
        { id: 'empty', kind: 'road', geometryKind: 'line', points: [] } as any,
        design,
        null,
        null,
        0
      )
    ).toEqual({ leftPercent: 50, topPercent: 50 });
    expect(
      helpers.getCanvasAnchorFromOsmWay(
        { id: 'point', kind: 'road', geometryKind: 'point', point: design.origin } as any,
        design,
        null,
        null,
        0
      )
    ).toEqual({ leftPercent: 50, topPercent: 50 });
    expect(
      helpers.getCanvasAnchorFromOsmWay(
        { id: 'point', kind: 'road', geometryKind: 'point', point: design.origin } as any,
        design,
        { position: { x: 0, y: 5, z: -10 }, target: { x: 0, y: 0, z: -20 } } as any,
        { width: 800, height: 400 },
        0
      )
    ).toEqual({ leftPercent: 50, topPercent: 50 });
  });

  it('observes canvas size changes and reuses equal dimensions', () => {
    let resize: (() => void) | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe = observe;
        disconnect = disconnect;
      }
    );
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const ref = { current: canvas };
    const { result } = renderHook(() => helpers.useCanvasElementSize(ref));
    expect(result.current).toEqual({ width: 320, height: 180 });
    act(() => resize?.());
    expect(result.current).toEqual({ width: 320, height: 180 });
    expect(observe).toHaveBeenCalledWith(canvas);
    vi.unstubAllGlobals();

    vi.stubGlobal('ResizeObserver', undefined);
    const fallbackRef = { current: document.createElement('canvas') };
    const fallbackHook = renderHook(() => helpers.useCanvasElementSize(fallbackRef));
    expect(fallbackHook.result.current).toEqual({ width: 300, height: 150 });
    fallbackHook.unmount();
    vi.unstubAllGlobals();
  });

  it('renders load, split, embedded, cursor, marker, and OSM selection alternatives', () => {
    const tree = {
      id: 'tree',
      type: 'tree',
      geometry: { kind: 'point', point: { x: 0, z: 0 }, rotationDeg: 0 },
      properties: {},
      visible: true,
      cost: { currency: 'EUR', suggestedUnitCostMinor: 100, customUnitCostMinor: null },
    } as any;
    const design = { ...createEmptyCityDesignState(), comparisonMode: 'split', objects: [tree] };
    const base = {
      design,
      isLoadingOsm: false,
      placementMode: null,
      placementPointCount: 0,
      canFinishPathPlacement: false,
      selectedObject: null,
      selectedObjectCostLine: null,
      selectedOsmWay: null,
      interactionMode: 'camera',
      readOnly: false,
      onFinishPathPlacement: vi.fn(),
      onCancelPlacement: vi.fn(),
      onObjectSelect: vi.fn(),
      onOsmWaySelect: vi.fn(),
      onObjectVisibilityChange: vi.fn(),
      onOsmWayHide: vi.fn(),
      onPropertyChange: vi.fn(),
      onWidthChange: vi.fn(),
      onRotationChange: vi.fn(),
      onUnitCostChange: vi.fn(),
      onDeleteObject: vi.fn(),
      canvasRef: { current: null },
      loadFailed: true,
    } as any;
    const { container, rerender } = render(<StreetSceneCanvasViewView {...base} />);
    expect(container.textContent).toContain('could not be loaded');

    const requests = [
      {
        id: 'add',
        source_type: 'city_design_object',
        source_id: 'tree',
        title: 'Add',
        change_type: 'add',
      },
      {
        id: 'remove',
        source_type: 'city_design_object',
        source_id: 'tree',
        title: 'Remove',
        change_type: 'remove',
      },
      {
        id: 'update',
        source_type: 'city_design_object',
        source_id: 'tree',
        title: 'Update',
        change_type: 'update',
      },
    ] as any;
    rerender(
      <StreetSceneCanvasViewView
        {...base}
        loadFailed={false}
        embeddedWorkspace
        showChangeRequests
        changeRequests={requests}
        selectedChangeRequestId="remove"
        remoteCursors={[
          {
            userId: 'design',
            name: 'Design',
            color: '#111111',
            position: { x: 0, z: 0 },
            layer: 'design',
          },
          {
            userId: 'original',
            name: 'Original',
            color: '#222222',
            position: { x: 0, z: 0 },
            layer: 'original',
          },
        ]}
        onOsmWayImport={undefined}
        onOsmImportUndo={undefined}
      />
    );
    expect(container.querySelector('canvas')?.className).toContain('h-[34rem]');
    expect(screen.getByTestId('city-design-cr-marker-remove')).toBeTruthy();
    expect(screen.getByTestId('city-design-cr-marker-update')).toBeTruthy();

    rerender(
      <StreetSceneCanvasViewView
        {...base}
        design={{ ...design, comparisonMode: 'original' }}
        loadFailed={false}
        embeddedPreview
        interactionMode="select"
        showChangeRequests
        changeRequests={requests}
        selectedChangeRequestId="remove"
        selectedOsmWay={{ id: 'osm', kind: 'road', geometryKind: 'line', points: [] } as any}
        remoteCursors={[
          {
            userId: 'hidden-design',
            name: 'Hidden',
            color: '#333333',
            position: { x: 0, z: 0 },
            layer: 'design',
          },
        ]}
      />
    );
    expect(container.querySelector('canvas')?.className).toContain('h-[30rem]');

    const cameraCanvasRef = { current: null };
    rerender(
      <StreetSceneCanvasViewView
        {...base}
        design={{ ...design, comparisonMode: 'new_design' }}
        loadFailed={false}
        selectedOsmWay={{ id: 'osm', kind: 'road', geometryKind: 'line', points: [] } as any}
        remoteCursors={[
          {
            userId: 'hidden-original',
            name: 'Fallback design',
            color: '#444444',
            position: { x: 0, z: 0 },
            layer: 'original',
          },
        ]}
      />
    );
    expect(screen.getByText(/OSM existing object/i)).toBeTruthy();

    rerender(
      <StreetSceneCanvasViewView
        {...base}
        design={{ ...design, comparisonMode: 'original' }}
        loadFailed={false}
        showChangeRequests
        changeRequests={requests}
        selectedChangeRequestId="remove"
      />
    );
    expect(screen.getAllByText('Remove').length).toBeGreaterThan(1);

    rerender(
      <StreetSceneCanvasViewView
        {...base}
        design={{ ...design, comparisonMode: 'new_design' }}
        loadFailed={false}
        showChangeRequests
        changeRequests={requests}
        selectedChangeRequestId="remove"
        cameraPose={{ position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: -1 } }}
        canvasRef={cameraCanvasRef}
        remoteCursors={[
          {
            userId: 'outside',
            name: 'Outside',
            color: '#555555',
            position: { x: 0, z: 10 },
            layer: 'original',
          },
        ]}
      />
    );
    expect(screen.queryByTestId('city-design-remote-cursor-outside')).toBeNull();
    expect(screen.queryByTestId('city-design-cr-marker-remove')).toBeNull();

    rerender(
      <StreetSceneCanvasViewView
        {...base}
        loadFailed={false}
        selectedOsmWay={
          {
            id: 'exact-osm',
            kind: 'utility',
            geometryKind: 'point',
            point: design.origin,
            mappedObjectType: 'charging_station',
            mappingConfidence: 'exact',
            source: 'osm',
          } as any
        }
        onOsmWayImport={undefined}
      />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="amendments.city-osm-popover.import.as-planned"]')!
    );

    rerender(
      <StreetSceneCanvasViewView
        {...base}
        loadFailed={false}
        selectedObject={{ ...tree, provenance: { source: 'osm', featureId: 'osm-tree' } }}
        onOsmImportUndo={undefined}
      />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="amendments.city-object-popover.undo.osm-import"]')!
    );
  });
});
