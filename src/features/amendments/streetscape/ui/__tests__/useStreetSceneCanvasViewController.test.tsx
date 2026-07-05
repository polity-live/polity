/* @vitest-environment jsdom */

import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyStreetDesignState } from '../../state/streetDesignReducer';
import { useStreetSceneCanvasViewController } from '../useStreetSceneCanvasViewController';

const { createSceneControllerMock, mountStreetDesignSceneMock } = vi.hoisted(() => {
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
    mountStreetDesignSceneMock: vi.fn(() => Promise.resolve(createSceneControllerMock())),
  };
});

vi.mock('../../logic/streetDesignScene', () => ({
  mountStreetDesignScene: mountStreetDesignSceneMock,
}));

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
}) {
  const viewProps = useStreetSceneCanvasViewController({
    design: createEmptyStreetDesignState(),
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
    selectedOsmWayId: null,
    selectedOsmWay: null,
    selectedOsmFocusRequestKey: 0,
    interactionMode,
    readOnly,
    selectedChangeRequestId,
    onPointerDown: vi.fn(),
    onPointerMove: vi.fn(),
    onFinishPlacement,
    onFinishPathPlacement: vi.fn(),
    onCancelPlacement,
    onObjectSelect,
    onOsmWaySelect: vi.fn(),
    onObjectVisibilityChange: vi.fn(),
    onOsmWayHide: vi.fn(),
    onObjectRotate: vi.fn(),
    onPropertyChange: vi.fn(),
    onWidthChange: vi.fn(),
    onRotationChange: vi.fn(),
    onUnitCostChange: vi.fn(),
    onDeleteObject: vi.fn(),
  });

  return <canvas ref={viewProps.canvasRef} />;
}

describe('useStreetSceneCanvasViewController', () => {
  beforeEach(() => {
    mountStreetDesignSceneMock.mockReset();
    mountStreetDesignSceneMock.mockResolvedValue(createSceneControllerMock());
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
    mountStreetDesignSceneMock.mockReturnValueOnce(
      new Promise<ReturnType<typeof createSceneControllerMock>>(resolve => {
        resolveMount = nextController => resolve(nextController);
      })
    );

    const { unmount } = render(<ControllerHarness interactionMode="camera" />);

    await waitFor(() => expect(mountStreetDesignSceneMock).toHaveBeenCalledTimes(1));
    unmount();

    await act(async () => {
      resolveMount?.(controller);
    });

    expect(controller.dispose).toHaveBeenCalledTimes(1);
  });

  it('updates scene imperatively without remounting on selection and handler changes', async () => {
    const firstController = createSceneControllerMock();
    mountStreetDesignSceneMock.mockResolvedValue(firstController);
    const onObjectSelect = vi.fn();
    const { rerender } = render(
      <ControllerHarness interactionMode="select" onObjectSelect={onObjectSelect} />
    );

    await waitFor(() => expect(mountStreetDesignSceneMock).toHaveBeenCalledTimes(1));

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
    expect(mountStreetDesignSceneMock).toHaveBeenCalledTimes(1);
  });
});
