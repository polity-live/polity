/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ controllerProps: null as any, viewProps: null as any }));

vi.mock('../useStreetSceneCanvasViewController', () => ({
  useStreetSceneCanvasViewController: (props: any) => {
    mocks.controllerProps = props;
    return { marker: 'view-props' };
  },
}));
vi.mock('../StreetSceneCanvasViewView', () => ({
  StreetSceneCanvasViewView: (props: any) => {
    mocks.viewProps = props;
    return <div>street-scene</div>;
  },
}));

import { StreetSceneCanvasView } from '../StreetSceneCanvasView';

const requiredProps = {
  design: {},
  isLoadingOsm: false,
  placementPreview: null,
  placementPreviewType: null,
  placementStart: null,
  placementMode: null,
  placementPointCount: 0,
  canFinishPathPlacement: false,
  selectedObjectId: null,
  selectedObject: null,
  selectedObjectCostLine: null,
  selectedObjectFocusRequestKey: 0,
  hiddenObjectIds: [],
  hiddenObjectCategories: [],
  selectedOsmWayId: null,
  selectedOsmWay: null,
  selectedOsmFocusRequestKey: 0,
  interactionMode: 'select',
  readOnly: false,
  onPointerDown: vi.fn(),
  onPointerMove: vi.fn(),
  onFinishPlacement: vi.fn(),
  onFinishPathPlacement: vi.fn(),
  onCancelPlacement: vi.fn(),
  onObjectSelect: vi.fn(),
  onOsmWaySelect: vi.fn(),
  onObjectVisibilityChange: vi.fn(),
  onOsmWayHide: vi.fn(),
  onObjectRotate: vi.fn(),
  onPropertyChange: vi.fn(),
  onWidthChange: vi.fn(),
  onRotationChange: vi.fn(),
  onUnitCostChange: vi.fn(),
  onDeleteObject: vi.fn(),
} as any;

describe('StreetSceneCanvasView A04 branch accountability', () => {
  afterEach(cleanup);

  it('supplies every optional default to the controller', () => {
    render(<StreetSceneCanvasView {...requiredProps} />);
    expect(mocks.controllerProps).toEqual(
      expect.objectContaining({
        initialLegendOpen: false,
        embeddedPreview: false,
        embeddedWorkspace: false,
        mapContextReadOnly: false,
        changeRequests: [],
        cityDesignDiscussions: [],
        selectedChangeRequestId: null,
        showChangeRequests: false,
        changeRequestColorMode: 'natural',
        canVoteOnChangeRequests: false,
        canFinalizeChangeRequests: false,
        currentUserId: null,
        currentUserDisplayName: null,
        currentUserAvatarUrl: null,
        collaborators: [],
        remoteCursors: [],
      })
    );
    expect(mocks.controllerProps.onPointerHover()).toBeUndefined();
    expect(mocks.controllerProps.onOsmWayImport()).toBeUndefined();
    expect(mocks.controllerProps.onOsmImportUndo()).toBeUndefined();
    expect(mocks.viewProps).toEqual({ marker: 'view-props' });
  });

  it('preserves explicit optional values', () => {
    const explicit = vi.fn();
    render(
      <StreetSceneCanvasView
        {...requiredProps}
        initialLegendOpen
        embeddedPreview
        embeddedWorkspace
        mapContextReadOnly
        changeRequests={[{ id: 'request' }] as any}
        cityDesignDiscussions={[{ id: 'discussion' }]}
        selectedChangeRequestId="request"
        showChangeRequests
        changeRequestColorMode="request"
        canVoteOnChangeRequests
        canFinalizeChangeRequests
        currentUserId="user"
        currentUserDisplayName="User"
        currentUserAvatarUrl="avatar"
        collaborators={[{ id: 'collaborator' }] as any}
        remoteCursors={[{ userId: 'remote' }] as any}
        onPointerHover={explicit}
        onOsmWayImport={explicit}
        onOsmImportUndo={explicit}
      />
    );
    expect(mocks.controllerProps).toEqual(
      expect.objectContaining({
        initialLegendOpen: true,
        embeddedPreview: true,
        embeddedWorkspace: true,
        currentUserId: 'user',
        onPointerHover: explicit,
        onOsmWayImport: explicit,
        onOsmImportUndo: explicit,
      })
    );
  });
});
