/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createPointStreetDesignObject } from '../../logic/streetDesignPlacement';
import { createEmptyStreetDesignState } from '../../state/streetDesignReducer';
import { StreetSceneCanvasViewView } from '../StreetSceneCanvasViewView';

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
      placementMode={null}
      placementPointCount={0}
      canFinishPathPlacement={false}
      selectedObject={tree}
      interactionMode="place"
      readOnly={false}
      onFinishPathPlacement={vi.fn()}
      onCancelPlacement={vi.fn()}
      onDeleteObject={vi.fn()}
      canvasRef={{ current: null }}
      loadFailed={false}
      {...overrides}
    />
  );
}

describe('StreetSceneCanvasViewView', () => {
  it('shows a delete action for a selected placed object', () => {
    const onDeleteObject = vi.fn();
    renderCanvasView({ onDeleteObject });

    fireEvent.click(screen.getByRole('button', { name: /entfernen/i }));

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

    fireEvent.click(screen.getByRole('button', { name: /fertig/i }));
    fireEvent.click(screen.getByRole('button', { name: /abbrechen/i }));

    expect(onFinishPathPlacement).toHaveBeenCalled();
    expect(onCancelPlacement).toHaveBeenCalled();
  });
});
