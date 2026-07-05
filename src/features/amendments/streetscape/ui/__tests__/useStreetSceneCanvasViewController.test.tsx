/* @vitest-environment jsdom */

import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyStreetDesignState } from '../../state/streetDesignReducer';
import { useStreetSceneCanvasViewController } from '../useStreetSceneCanvasViewController';

const { mountStreetDesignSceneMock } = vi.hoisted(() => ({
  mountStreetDesignSceneMock: vi.fn<() => Promise<() => void>>(() => Promise.resolve(vi.fn())),
}));

vi.mock('../../logic/streetDesignScene', () => ({
  mountStreetDesignScene: mountStreetDesignSceneMock,
}));

function ControllerHarness({
  onFinishPlacement = vi.fn(),
  onCancelPlacement = vi.fn(),
  placementMode = null,
  canFinishPathPlacement = false,
  readOnly = false,
  interactionMode = 'place',
}: {
  onFinishPlacement?: () => void;
  onCancelPlacement?: () => void;
  placementMode?: 'drag_band' | 'path' | null;
  canFinishPathPlacement?: boolean;
  readOnly?: boolean;
  interactionMode?: 'place' | 'select' | 'camera';
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
    selectedObjectId: null,
    selectedObject: null,
    selectedObjectFocusRequestKey: 0,
    hiddenObjectIds: [],
    hiddenObjectCategories: [],
    selectedOsmWayId: null,
    selectedOsmFocusRequestKey: 0,
    interactionMode,
    readOnly,
    onPointerDown: vi.fn(),
    onPointerMove: vi.fn(),
    onFinishPlacement,
    onFinishPathPlacement: vi.fn(),
    onCancelPlacement,
    onObjectSelect: vi.fn(),
    onOsmWaySelect: vi.fn(),
    onObjectRotate: vi.fn(),
    onDeleteObject: vi.fn(),
  });

  return <canvas ref={viewProps.canvasRef} />;
}

describe('useStreetSceneCanvasViewController', () => {
  beforeEach(() => {
    mountStreetDesignSceneMock.mockReset();
    mountStreetDesignSceneMock.mockResolvedValue(vi.fn());
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
    let resolveMount: ((cleanup: () => void) => void) | null = null;
    const cleanup = vi.fn();
    mountStreetDesignSceneMock.mockReturnValueOnce(
      new Promise<() => void>(resolve => {
        resolveMount = nextCleanup => resolve(nextCleanup);
      })
    );

    const { unmount } = render(<ControllerHarness interactionMode="camera" />);

    await waitFor(() => expect(mountStreetDesignSceneMock).toHaveBeenCalledTimes(1));
    unmount();

    await act(async () => {
      resolveMount?.(cleanup);
    });

    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
