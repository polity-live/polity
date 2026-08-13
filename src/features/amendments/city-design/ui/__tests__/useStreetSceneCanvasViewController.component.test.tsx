/* @vitest-environment jsdom */

import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyCityDesignState } from '../../state/cityDesignReducer';
import {
  streetSceneCanvasControllerInternals,
  useStreetSceneCanvasViewController,
} from '../useStreetSceneCanvasViewController';

const { createSceneControllerMock, mountCityDesignSceneMock } = vi.hoisted(() => {
  const createSceneControllerMock = () => ({
    updateDesign: vi.fn(),
    updateSelection: vi.fn(),
    updatePlacementPreview: vi.fn(),
    updateChangeRequests: vi.fn(),
    updateInteractionMode: vi.fn(),
    updateHandlers: vi.fn(),
    focusObject: vi.fn(),
    focusOsmWay: vi.fn(),
    dispose: vi.fn(),
  });

  return {
    createSceneControllerMock,
    mountCityDesignSceneMock: vi.fn((..._args: any[]) =>
      Promise.resolve(createSceneControllerMock())
    ),
  };
});

vi.mock('../../logic/cityDesignScene', () => ({
  mountCityDesignScene: mountCityDesignSceneMock,
}));

let latestControllerViewProps: ReturnType<typeof useStreetSceneCanvasViewController> | null = null;

function ControllerHarness({
  onFinishPlacement = vi.fn(),
  onCancelPlacement = vi.fn(),
  onObjectSelect = vi.fn(),
  placementMode = null,
  canFinishPathPlacement = false,
  readOnly = false,
  interactionMode = 'place',
  selectedObjectId = null,
  selectedObjectFocusRequestKey = 0,
  selectedChangeRequestId = null,
  selectedOsmWayId = null,
  selectedOsmFocusRequestKey = 0,
  showChangeRequests = false,
  provideOptionalHandlers = false,
  attachCanvas = true,
}: {
  onFinishPlacement?: () => void;
  onCancelPlacement?: () => void;
  onObjectSelect?: (objectId: string | null) => void;
  placementMode?: 'drag_band' | 'path' | null;
  canFinishPathPlacement?: boolean;
  readOnly?: boolean;
  interactionMode?: 'place' | 'select' | 'camera';
  selectedObjectId?: string | null;
  selectedObjectFocusRequestKey?: number;
  selectedChangeRequestId?: string | null;
  selectedOsmWayId?: string | null;
  selectedOsmFocusRequestKey?: number;
  showChangeRequests?: boolean;
  provideOptionalHandlers?: boolean;
  attachCanvas?: boolean;
}) {
  const viewProps = useStreetSceneCanvasViewController({
    design: createEmptyCityDesignState(),
    isLoadingOsm: false,
    placementPreview: null,
    placementPreviewType: null,
    placementStart: null,
    placementMode,
    placementPointCount: 0,
    canFinishPathPlacement,
    selectedObjectId,
    selectedObject: null,
    selectedObjectCostLine: null,
    selectedObjectFocusRequestKey,
    hiddenObjectIds: [],
    hiddenObjectCategories: [],
    selectedOsmWayId,
    selectedOsmWay: null,
    selectedOsmFocusRequestKey,
    interactionMode,
    readOnly,
    selectedChangeRequestId,
    showChangeRequests,
    changeRequests: [{ id: 'cr-1', source_type: 'city_design_object' }],
    onPointerDown: vi.fn(),
    onPointerMove: vi.fn(),
    ...(provideOptionalHandlers ? { onPointerHover: vi.fn() } : {}),
    onFinishPlacement,
    onFinishPathPlacement: vi.fn(),
    onCancelPlacement,
    onObjectSelect,
    onOsmWaySelect: vi.fn(),
    onObjectVisibilityChange: vi.fn(),
    onOsmWayHide: vi.fn(),
    ...(provideOptionalHandlers ? { onOsmWayImport: vi.fn(), onOsmImportUndo: vi.fn() } : {}),
    onObjectRotate: vi.fn(),
    onPropertyChange: vi.fn(),
    onWidthChange: vi.fn(),
    onRotationChange: vi.fn(),
    onUnitCostChange: vi.fn(),
    onDeleteObject: vi.fn(),
  });
  latestControllerViewProps = viewProps;

  return attachCanvas ? <canvas ref={viewProps.canvasRef} /> : null;
}

describe('useStreetSceneCanvasViewController', () => {
  beforeEach(() => {
    latestControllerViewProps = null;
    mountCityDesignSceneMock.mockReset();
    mountCityDesignSceneMock.mockResolvedValue(createSceneControllerMock());
  });

  it('finishes active drag-band placement with Enter', async () => {
    const onFinishPlacement = vi.fn();
    render(<ControllerHarness placementMode="drag_band" onFinishPlacement={onFinishPlacement} />);

    await waitFor(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(onFinishPlacement).toHaveBeenCalledTimes(1);
    });
  });

  it('finishes path placement with Enter only after enough points are set', async () => {
    const onFinishPlacement = vi.fn();
    const { rerender } = render(
      <ControllerHarness
        placementMode="path"
        canFinishPathPlacement={false}
        onFinishPlacement={onFinishPlacement}
      />
    );

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onFinishPlacement).not.toHaveBeenCalled();

    rerender(
      <ControllerHarness
        placementMode="path"
        canFinishPathPlacement
        onFinishPlacement={onFinishPlacement}
      />
    );

    await waitFor(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(onFinishPlacement).toHaveBeenCalledTimes(1);
    });
  });

  it('cancels active placement with Escape', async () => {
    const onCancelPlacement = vi.fn();
    render(<ControllerHarness placementMode="drag_band" onCancelPlacement={onCancelPlacement} />);

    await waitFor(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(onCancelPlacement).toHaveBeenCalledTimes(1);
    });
  });

  it('does not handle placement keys from editable controls', async () => {
    const onFinishPlacement = vi.fn();
    const onCancelPlacement = vi.fn();
    const input = document.createElement('input');
    document.body.appendChild(input);

    render(
      <ControllerHarness
        placementMode="drag_band"
        onFinishPlacement={onFinishPlacement}
        onCancelPlacement={onCancelPlacement}
      />
    );

    await waitFor(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(onFinishPlacement).toHaveBeenCalledTimes(1);
    });

    onFinishPlacement.mockClear();
    onCancelPlacement.mockClear();
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Escape' });
    input.remove();

    expect(onFinishPlacement).not.toHaveBeenCalled();
    expect(onCancelPlacement).not.toHaveBeenCalled();
  });

  it('ignores placement keys when read-only', () => {
    const onFinishPlacement = vi.fn();
    const onCancelPlacement = vi.fn();
    render(
      <ControllerHarness
        placementMode="drag_band"
        readOnly
        onFinishPlacement={onFinishPlacement}
        onCancelPlacement={onCancelPlacement}
      />
    );

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(onFinishPlacement).not.toHaveBeenCalled();
    expect(onCancelPlacement).not.toHaveBeenCalled();
  });

  it('ignores placement keys outside placement mode', () => {
    const onFinishPlacement = vi.fn();
    const onCancelPlacement = vi.fn();
    render(
      <ControllerHarness
        placementMode="drag_band"
        interactionMode="select"
        onFinishPlacement={onFinishPlacement}
        onCancelPlacement={onCancelPlacement}
      />
    );

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(onFinishPlacement).not.toHaveBeenCalled();
    expect(onCancelPlacement).not.toHaveBeenCalled();
  });

  it('runs scene cleanup when unmounted before async scene mount resolves', async () => {
    let resolveMount: ((controller: ReturnType<typeof createSceneControllerMock>) => void) | null =
      null;
    const controller = createSceneControllerMock();
    mountCityDesignSceneMock.mockReturnValueOnce(
      new Promise<ReturnType<typeof createSceneControllerMock>>(resolve => {
        resolveMount = nextController => resolve(nextController);
      })
    );

    const { unmount } = render(<ControllerHarness interactionMode="camera" />);

    await waitFor(() => expect(mountCityDesignSceneMock).toHaveBeenCalledTimes(1));
    unmount();

    await act(async () => {
      resolveMount?.(controller);
    });

    expect(controller.dispose).toHaveBeenCalledTimes(1);
  });

  it('updates scene imperatively without remounting on selection and handler changes', async () => {
    const firstController = createSceneControllerMock();
    mountCityDesignSceneMock.mockResolvedValue(firstController);
    const onObjectSelect = vi.fn();
    const { rerender } = render(
      <ControllerHarness interactionMode="select" onObjectSelect={onObjectSelect} />
    );

    await waitFor(() => expect(mountCityDesignSceneMock).toHaveBeenCalledTimes(1));

    const nextObjectSelect = vi.fn();
    rerender(
      <ControllerHarness
        interactionMode="select"
        onObjectSelect={nextObjectSelect}
        selectedObjectId="object-1"
        selectedObjectFocusRequestKey={1}
        selectedChangeRequestId="cr-1"
      />
    );

    await waitFor(() => {
      expect(firstController.updateHandlers).toHaveBeenCalled();
      expect(firstController.updateSelection).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedObjectId: 'object-1',
          selectedChangeRequestId: 'cr-1',
          focusObjectId: 'object-1',
        })
      );
    });
    expect(mountCityDesignSceneMock).toHaveBeenCalledTimes(1);
  });

  it('supports a missing canvas and explicitly provided optional handlers', async () => {
    const first = render(<ControllerHarness attachCanvas={false} />);
    expect(mountCityDesignSceneMock).not.toHaveBeenCalled();
    first.unmount();
    render(<ControllerHarness attachCanvas provideOptionalHandlers showChangeRequests />);
    await waitFor(() => expect(mountCityDesignSceneMock).toHaveBeenCalled());
    expect(mountCityDesignSceneMock).toHaveBeenCalledWith(
      expect.objectContaining({ changeRequests: [expect.objectContaining({ id: 'cr-1' })] })
    );
  });

  it('marks an active mount failure without throwing', async () => {
    mountCityDesignSceneMock.mockRejectedValueOnce(new Error('webgl unavailable'));
    render(<ControllerHarness />);
    await waitFor(() => expect(mountCityDesignSceneMock).toHaveBeenCalled());
  });

  it('ignores a mount failure after the canvas has unmounted', async () => {
    let rejectMount!: (reason: Error) => void;
    mountCityDesignSceneMock.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectMount = reject;
      })
    );
    const view = render(<ControllerHarness />);
    await waitFor(() => expect(mountCityDesignSceneMock).toHaveBeenCalled());
    view.unmount();
    await act(async () => rejectMount(new Error('late WebGL failure')));
  });

  it('provides callable no-op handlers when optional callbacks are omitted', async () => {
    render(<ControllerHarness />);
    await waitFor(() => expect(mountCityDesignSceneMock).toHaveBeenCalled());
    const mountOptions = mountCityDesignSceneMock.mock.calls[0]?.[0];
    expect(mountOptions?.onPointerHover?.(null, 'design')).toBeUndefined();
    expect(latestControllerViewProps?.onOsmWayImport('osm-1')).toBeUndefined();
    expect(latestControllerViewProps?.onOsmImportUndo('osm-1')).toBeUndefined();
  });

  it('syncs options changed while an async mount is pending', async () => {
    let resolveMount!: (controller: ReturnType<typeof createSceneControllerMock>) => void;
    const controller = createSceneControllerMock();
    mountCityDesignSceneMock.mockReturnValueOnce(
      new Promise(resolve => {
        resolveMount = resolve;
      })
    );
    const view = render(<ControllerHarness showChangeRequests={false} />);
    view.rerender(<ControllerHarness showChangeRequests />);
    await act(async () => resolveMount(controller));
    expect(controller.updateChangeRequests).toHaveBeenCalled();
  });

  it('coalesces camera pose animation frames and cancels a pending frame on unmount', async () => {
    let frameCallback: FrameRequestCallback | undefined;
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      frameCallback = callback;
      return 77;
    });
    const view = render(<ControllerHarness />);
    await waitFor(() => expect(mountCityDesignSceneMock).toHaveBeenCalled());
    const handler = mountCityDesignSceneMock.mock.calls[0]?.[0].onCameraPoseChange;
    act(() => {
      handler?.({ position: { x: 1, y: 2, z: 3 }, target: { x: 0, y: 0, z: 0 } });
      handler?.({ position: { x: 4, y: 5, z: 6 }, target: { x: 0, y: 0, z: 0 } });
    });
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    act(() => frameCallback?.(1));
    handler?.({ position: { x: 7, y: 8, z: 9 }, target: { x: 0, y: 0, z: 0 } });
    view.unmount();
    expect(cancel).toHaveBeenCalledWith(77);
    vi.restoreAllMocks();
  });

  it('consumes object and OSM focus requests once per key', () => {
    const objectRef = { current: 0 };
    const osmRef = { current: 0 };
    const consume = streetSceneCanvasControllerInternals.consumeFocusRequests;
    expect(
      consume({
        latestFocusRequest: {
          selectedObjectId: null,
          selectedObjectFocusRequestKey: 0,
          selectedOsmWayId: null,
          selectedOsmFocusRequestKey: 0,
        },
        lastObjectFocusRequestKeyRef: objectRef,
        lastOsmFocusRequestKeyRef: osmRef,
      })
    ).toEqual({ focusObjectId: null, focusOsmWayId: null });
    expect(
      consume({
        latestFocusRequest: {
          selectedObjectId: 'object',
          selectedObjectFocusRequestKey: 1,
          selectedOsmWayId: 'osm',
          selectedOsmFocusRequestKey: 1,
        },
        lastObjectFocusRequestKeyRef: objectRef,
        lastOsmFocusRequestKeyRef: osmRef,
      })
    ).toEqual({ focusObjectId: 'object', focusOsmWayId: 'osm' });
    expect(
      consume({
        latestFocusRequest: {
          selectedObjectId: 'object',
          selectedObjectFocusRequestKey: 1,
          selectedOsmWayId: 'osm',
          selectedOsmFocusRequestKey: 1,
        },
        lastObjectFocusRequestKeyRef: objectRef,
        lastOsmFocusRequestKeyRef: osmRef,
      })
    ).toEqual({ focusObjectId: null, focusOsmWayId: null });
  });

  it('uses timeout animation frame fallbacks and classifies editable targets', () => {
    const requestDescriptor = Object.getOwnPropertyDescriptor(window, 'requestAnimationFrame');
    const cancelDescriptor = Object.getOwnPropertyDescriptor(window, 'cancelAnimationFrame');
    const performanceNowDescriptor = Object.getOwnPropertyDescriptor(performance, 'now');
    vi.useFakeTimers();
    Object.defineProperty(window, 'requestAnimationFrame', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const callback = vi.fn();
    const frame = streetSceneCanvasControllerInternals.requestStreetSceneAnimationFrame(callback);
    vi.advanceTimersByTime(16);
    expect(callback).toHaveBeenCalled();
    streetSceneCanvasControllerInternals.cancelStreetSceneAnimationFrame(frame);
    Object.defineProperty(performance, 'now', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    streetSceneCanvasControllerInternals.requestStreetSceneAnimationFrame(callback);
    vi.advanceTimersByTime(16);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(streetSceneCanvasControllerInternals.isEditableKeyboardTarget(null)).toBe(false);
    expect(
      streetSceneCanvasControllerInternals.isEditableKeyboardTarget(document.createElement('input'))
    ).toBe(true);
    vi.useRealTimers();
    if (requestDescriptor)
      Object.defineProperty(window, 'requestAnimationFrame', requestDescriptor);
    if (cancelDescriptor) Object.defineProperty(window, 'cancelAnimationFrame', cancelDescriptor);
    if (performanceNowDescriptor) {
      Object.defineProperty(performance, 'now', performanceNowDescriptor);
    } else {
      delete (performance as { now?: () => number }).now;
    }
  });
});
