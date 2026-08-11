import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  controller: vi.fn(() => new Proxy({}, { get: () => vi.fn() })),
  subscribe: vi.fn(() => ({ isSubscribed: false, isLoading: false, toggleSubscribe: vi.fn() })),
  view: vi.fn(() => null),
}));

vi.mock('../city-design/hooks/useCityDesignPageController', () => ({
  useCityDesignPageController: mocks.controller,
}));
vi.mock('../city-design/ui/CityDesignPageView', () => ({ CityDesignPageView: mocks.view }));
vi.mock('../city-design/ui/useStreetAreaPickerController', () => ({
  useStreetAreaPickerController: mocks.controller,
}));
vi.mock('../city-design/ui/StreetAreaPickerView', () => ({ StreetAreaPickerView: mocks.view }));
vi.mock('../collaborators/ui/useRolesManagementCardController', () => ({
  useRolesManagementCardController: mocks.controller,
}));
vi.mock('../collaborators/ui/RolesManagementCardView', () => ({
  RolesManagementCardView: mocks.view,
}));
vi.mock('../ui/useAmendmentEditContentController', () => ({
  useAmendmentEditContentController: mocks.controller,
}));
vi.mock('../ui/AmendmentEditContentView', () => ({ AmendmentEditContentView: mocks.view }));
vi.mock('../ui/useAmendmentPathVisualizationController', () => ({
  useAmendmentPathVisualizationController: mocks.controller,
}));
vi.mock('../ui/AmendmentPathVisualizationView', () => ({
  AmendmentPathVisualizationView: mocks.view,
}));
vi.mock('../ui/useAmendmentProcessFlowController', () => ({
  useAmendmentProcessFlowController: mocks.controller,
}));
vi.mock('../ui/AmendmentProcessFlowView', () => ({ AmendmentProcessFlowView: mocks.view }));
vi.mock('../hooks/useConfirmationRequestNoticeController', () => ({
  useConfirmationRequestNoticeController: mocks.controller,
}));
vi.mock('../ui/ConfirmationRequestNoticeView', () => ({
  ConfirmationRequestNoticeView: mocks.view,
}));
vi.mock('../hooks/useModeSelectorController', () => ({
  useModeSelectorController: mocks.controller,
}));
vi.mock('../ui/ModeSelectorView', () => ({ ModeSelectorView: mocks.view }));
vi.mock('../ui/useSupportConfirmationPanelController', () => ({
  useSupportConfirmationPanelController: mocks.controller,
}));
vi.mock('../ui/SupportConfirmationPanelView', () => ({
  SupportConfirmationPanelView: mocks.view,
}));
vi.mock('../hooks/useSubscribeAmendment', () => ({ useSubscribeAmendment: mocks.subscribe }));
vi.mock('../ui/AmendmentSubscribeButtonView', () => ({
  AmendmentSubscribeButtonView: mocks.view,
}));
vi.mock('@/features/editor/ui/VersionControl', () => ({ VersionControl: mocks.view }));

import { CityDesignPage } from '../city-design/CityDesignPage';
import { StreetAreaPicker } from '../city-design/ui/StreetAreaPicker';
import { RolesManagementCard } from '../collaborators/ui/RolesManagementCard';
import { AmendmentEditContent } from '../ui/AmendmentEditContent';
import { AmendmentPathVisualization } from '../ui/AmendmentPathVisualization';
import { AmendmentProcessFlow } from '../ui/AmendmentProcessFlow';
import { AmendmentSubscribeButton } from '../ui/AmendmentSubscribeButton';
import { ConfirmationRequestNotice } from '../ui/ConfirmationRequestNotice';
import { ModeSelector } from '../ui/ModeSelector';
import { SupportConfirmationPanel } from '../ui/SupportConfirmationPanel';
import { VersionControl } from '../ui/VersionControl';

describe('amendment composition wrapper contracts', () => {
  it('connects every thin wrapper to its controller and view', async () => {
    const components = [
      CityDesignPage({ amendmentId: 'amendment-1' }),
      StreetAreaPicker({
        center: { lat: 1, lon: 2 },
        bbox: { south: 0, west: 0, north: 2, east: 3 },
        mapSelection: {} as any,
        isLoadingOsm: false,
        osmError: null,
        readOnly: false,
        addressLabel: 'Berlin',
        onMapSelectionChange: vi.fn(),
        onSelectionAddressChange: vi.fn(),
        onLoadOsm: vi.fn(),
      }),
      RolesManagementCard({
        amendmentId: 'amendment-1',
        roles: [],
        onCreateRole: vi.fn(),
        onDeleteRole: vi.fn(),
        onToggleActionRight: vi.fn(),
      }),
      AmendmentEditContent({
        amendmentId: 'amendment-1',
        amendment: undefined,
        currentUserId: 'user-1',
        isLoading: false,
      }),
      AmendmentPathVisualization({ amendmentId: 'amendment-1' }),
      AmendmentProcessFlow({ amendmentId: 'amendment-1' }),
      ConfirmationRequestNotice({ userId: 'user-1' }),
      ModeSelector({ documentId: 'document-1', currentMode: 'edit', isOwnerOrCollaborator: true }),
      SupportConfirmationPanel({ groupId: 'group-1' }),
      VersionControl({
        documentId: 'document-1',
        currentContent: [],
        currentUserId: 'user-1',
        onRestoreVersion: vi.fn(),
      }),
    ];

    const subscribed = AmendmentSubscribeButton({ amendmentId: 'amendment-1' });
    await subscribed.props.handleClick();
    expect(components.every(Boolean)).toBe(true);
    expect(subscribed).toBeTruthy();
    expect(mocks.controller).toHaveBeenCalled();
  });
});
