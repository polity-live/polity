/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPointCityDesignObject } from '../../logic/cityDesignPlacement';
import { createEmptyCityDesignState } from '../../state/cityDesignReducer';
import {
  CityDesignObjectPopover,
  CityDesignOsmPopover,
  StreetSceneCanvasViewView,
} from '../StreetSceneCanvasViewView';

afterEach(cleanup);

const tree = createPointCityDesignObject({
  id: 'tree-1',
  type: 'tree',
  point: { x: 0, z: 0 },
});

function base(overrides: Record<string, unknown> = {}) {
  return {
    design: { ...createEmptyCityDesignState(), objects: [tree] },
    isLoadingOsm: false,
    placementMode: null,
    placementPointCount: 0,
    canFinishPathPlacement: false,
    selectedObject: null,
    selectedObjectCostLine: null,
    selectedOsmWay: null,
    interactionMode: 'select',
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
    loadFailed: false,
    ...overrides,
  } as any;
}

describe('StreetSceneCanvasViewView LSF interaction wrappers', () => {
  it('distinguishes explicit OSM widths from estimated widths in the original inspector', () => {
    const props = {
      osmWay: {
        id: 'osm-width',
        kind: 'road',
        geometryKind: 'line',
        widthMeters: 6,
        widthSource: 'osm',
        points: [
          { lat: 0, lon: 0 },
          { lat: 0, lon: 1 },
        ],
      },
      readOnly: false,
      onClose: vi.fn(),
      onOsmWayHide: vi.fn(),
      onOsmWayImport: vi.fn(),
    } as any;
    const view = render(<CityDesignOsmPopover {...props} />);
    expect(view.container.textContent).toContain('6.0 m');
    const explicit = view.container.textContent;
    view.rerender(
      <CityDesignOsmPopover {...props} osmWay={{ ...props.osmWay, widthSource: 'default' }} />
    );
    expect(view.container.textContent).not.toBe(explicit);
  });
  it('moves both measurement endpoints with captured pointers and accessible arrow keys', () => {
    const moveEndpoint = vi.fn();
    const measurements = {
      measurement: { start: { x: -2, z: 0 }, end: { x: 2, z: 0 }, layer: 'design' },
      selection: [],
      selectedWidths: [],
      selectedObjectIds: [],
      selectedOsmWayIds: [],
      measurementActive: false,
      levels: [],
      measurementLayer: 'design',
      moveEndpoint,
      clearMeasurement: vi.fn(),
      setMeasurementActive: vi.fn(),
    };
    const props = base({
      measurements,
      cameraPose: { position: { x: 0, y: 75, z: 85 }, target: { x: 0, y: 0, z: 0 } },
    });
    const { container, rerender } = render(<StreetSceneCanvasViewView {...props} />);
    const handles = container.querySelectorAll<HTMLButtonElement>(
      '[data-action-id="amendments.city-measurement.move.endpoint"]'
    );
    expect(handles).toHaveLength(2);
    handles.forEach((handle, index) => {
      handle.setPointerCapture = vi.fn();
      handle.hasPointerCapture = vi.fn(() => true);
      handle.releasePointerCapture = vi.fn();
      fireEvent.pointerDown(handle, { pointerId: 1 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 10, clientY: 20 });
      expect(moveEndpoint).toHaveBeenLastCalledWith(
        index ? 'end' : 'start',
        expect.anything(),
        expect.anything()
      );
      fireEvent.pointerUp(handle, { pointerId: 1 });
      expect(handle.releasePointerCapture).toHaveBeenCalled();
      handle.hasPointerCapture = vi.fn(() => false);
      const count = moveEndpoint.mock.calls.length;
      fireEvent.pointerMove(handle);
      fireEvent.keyDown(handle, { key: 'a' });
      expect(moveEndpoint).toHaveBeenCalledTimes(count);
      for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])
        fireEvent.keyDown(handle, { key, shiftKey: index === 1 });
      expect(moveEndpoint).toHaveBeenCalledTimes(count + 4);
    });
    rerender(
      <StreetSceneCanvasViewView
        {...props}
        measurements={{
          ...measurements,
          measurement: { ...measurements.measurement, layer: 'original' },
        }}
      />
    );
    expect(
      container.querySelectorAll('[data-action-id="amendments.city-measurement.move.endpoint"]')
    ).toHaveLength(2);
    rerender(
      <StreetSceneCanvasViewView
        {...props}
        measurements={{ ...measurements, measurementActive: true }}
      />
    );
    expect(container.querySelector('canvas')!.className).toContain('cursor-crosshair');
  });
  it('forwards change-request marker selection and panel close', () => {
    const onChangeRequestSelect = vi.fn();
    const request = {
      id: 'cr-1',
      title: 'Change',
      source_type: 'city_design_object',
      source_id: 'tree-1',
      change_type: 'update',
    };
    const { container } = render(
      <StreetSceneCanvasViewView
        {...base({
          showChangeRequests: true,
          changeRequests: [request],
          selectedChangeRequestId: 'cr-1',
          onChangeRequestSelect,
        })}
      />
    );
    const marker = container.querySelector('[data-testid="city-design-cr-marker-cr-1"]');
    if (marker) fireEvent.click(marker);
    const popover = Array.from(container.querySelectorAll('div')).find(element =>
      element.getAttribute('style')?.includes('translate')
    );
    expect(popover).toBeTruthy();
    fireEvent.pointerDown(popover!);
    fireEvent.click(popover!);
    for (const button of container.querySelectorAll('button')) fireEvent.click(button);
    expect(onChangeRequestSelect).toHaveBeenCalled();
  });

  it('forwards selected object and OSM popover close callbacks', () => {
    const onObjectSelect = vi.fn();
    const objectView = render(
      <StreetSceneCanvasViewView
        {...base({
          selectedObject: tree,
          onObjectSelect,
        })}
      />
    );
    for (const button of objectView.container.querySelectorAll('button')) fireEvent.click(button);
    expect(onObjectSelect).toHaveBeenCalledWith(null);
    objectView.unmount();

    const onOsmWaySelect = vi.fn();
    const osmView = render(
      <StreetSceneCanvasViewView
        {...base({
          selectedOsmWay: {
            id: 'way-1',
            kind: 'road',
            geometryKind: 'point',
            point: createEmptyCityDesignState().origin,
            source: 'osm',
          },
          onOsmWaySelect,
        })}
      />
    );
    for (const button of osmView.container.querySelectorAll('button')) fireEvent.click(button);
    expect(onOsmWaySelect).toHaveBeenCalledWith(null);
  });

  it('dispatches point rotation and combobox edits from the object popover', () => {
    const onRotationChange = vi.fn();
    const onPropertyChange = vi.fn();
    const { container } = render(
      <CityDesignObjectPopover
        {...({
          object: tree,
          costLine: null,
          isHidden: false,
          readOnly: false,
          onClose: vi.fn(),
          onVisibilityChange: vi.fn(),
          onPropertyChange,
          onWidthChange: vi.fn(),
          onRotationChange,
          onUnitCostChange: vi.fn(),
          onDeleteObject: vi.fn(),
          onUndoOsmImport: vi.fn(),
        } as any)}
      />
    );
    const rotation = Array.from(
      container.querySelectorAll(
        'input[data-action-id="amendments.city-object-popover.edit.rotation"]'
      )
    ).find(input => input.getAttribute('step') === '1');
    fireEvent.change(rotation!, { target: { value: '30' } });
    const combobox = container.querySelector('input[list]');
    expect(combobox).toBeTruthy();
    fireEvent.change(combobox!, { target: { value: 'oak' } });
    expect(onRotationChange).toHaveBeenCalledWith('tree-1', 30);
    expect(onPropertyChange).toHaveBeenCalledWith('tree-1', expect.any(String), 'oak');
  });

  it('dispatches corridor width and rotation edits from the object popover', () => {
    const onWidthChange = vi.fn();
    const onRotationChange = vi.fn();
    const onLengthChange = vi.fn();
    const onPositionChange = vi.fn();
    const corridor = {
      ...tree,
      id: 'corridor-1',
      type: 'sidewalk',
      geometry: {
        kind: 'corridor',
        start: { x: 0, z: 0 },
        end: { x: 4, z: 0 },
        width: 2,
        polygon: [],
        length: 4,
        area: 8,
        rotation: 0,
      },
    } as any;
    const { container } = render(
      <CityDesignObjectPopover
        {...({
          object: corridor,
          costLine: null,
          isHidden: false,
          readOnly: false,
          onClose: vi.fn(),
          onVisibilityChange: vi.fn(),
          onPropertyChange: vi.fn(),
          onWidthChange,
          onLengthChange,
          onPositionChange,
          onRotationChange,
          onUnitCostChange: vi.fn(),
          onDeleteObject: vi.fn(),
          onUndoOsmImport: vi.fn(),
        } as any)}
      />
    );
    const width = container.querySelector('input[aria-label="Width"]')!;
    fireEvent.change(width, { target: { value: '5' } });
    expect(onWidthChange).toHaveBeenCalledWith('corridor-1', 5);
    fireEvent.blur(width);
    fireEvent.change(
      container.querySelector(
        'input[data-action-id="amendments.city-object-popover.edit.rotation"]'
      )!,
      { target: { value: '25' } }
    );
    expect(onWidthChange).toHaveBeenCalledWith('corridor-1', 5);
    expect(onRotationChange).toHaveBeenCalledWith('corridor-1', 25);
    const length = container.querySelector(
      'input[data-action-id="amendments.city-object-popover.edit.length"]'
    )!;
    fireEvent.change(length, { target: { value: '10' } });
    expect(onLengthChange).toHaveBeenCalledWith('corridor-1', 10, corridor.geometry);
    fireEvent.focus(length);
    fireEvent.change(length, { target: { value: '11' } });
    expect(onLengthChange).toHaveBeenLastCalledWith('corridor-1', 11, corridor.geometry);
    fireEvent.blur(length);
    const position = container.querySelector(
      'input[data-action-id="amendments.city-object-popover.edit.position"]'
    )!;
    fireEvent.change(position, { target: { value: '7' } });
    expect(onPositionChange).toHaveBeenCalledWith('corridor-1', { x: 7, z: 0 });
  });
});
