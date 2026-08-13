/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPointCityDesignObject } from '../../logic/cityDesignPlacement';
import { createEmptyCityDesignState } from '../../state/cityDesignReducer';
import { CityDesignObjectPopover, StreetSceneCanvasViewView } from '../StreetSceneCanvasViewView';

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
    const rotation = Array.from(container.querySelectorAll('input[type="number"]')).find(
      input => input.getAttribute('step') === '1'
    );
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
          onRotationChange,
          onUnitCostChange: vi.fn(),
          onDeleteObject: vi.fn(),
          onUndoOsmImport: vi.fn(),
        } as any)}
      />
    );
    const numeric = Array.from(container.querySelectorAll('input[type="number"]'));
    fireEvent.change(numeric[0], { target: { value: '5' } });
    fireEvent.change(numeric[1], { target: { value: '25' } });
    expect(onWidthChange).toHaveBeenCalledWith('corridor-1', 5);
    expect(onRotationChange).toHaveBeenCalledWith('corridor-1', 25);
  });
});
