/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GroupNetworkPage, Route as NetworkRoute } from '../../../routes/_authed/group/$id/network';
import {
  GroupRelationshipsPage,
  Route as RelationshipsRoute,
} from '../../../routes/_authed/group/$id/relationships';

const useNetworkPageMock = vi.fn();
const usePermissionsMock = vi.fn();

vi.mock('@/features/network/hooks/useNetworkPage', () => ({
  useNetworkPage: (...args: unknown[]) => useNetworkPageMock(...args),
}));

vi.mock('@/zero/rbac', () => ({
  usePermissions: (...args: unknown[]) => usePermissionsMock(...args),
}));

vi.mock('@/zero/rbac/usePermissions', () => ({
  usePermissions: (...args: unknown[]) => usePermissionsMock(...args),
}));

vi.mock('@/features/network/ui/NetworkTabs', () => ({
  NetworkTabs: ({
    activeTab,
    showManageNetworkTab,
    showManageWorkflowsTab,
    currentNetworkContent,
    manageNetworkContent,
    manageWorkflowsContent,
  }: {
    activeTab: string;
    showManageNetworkTab: boolean;
    showManageWorkflowsTab: boolean;
    currentNetworkContent: ReactNode;
    manageNetworkContent: ReactNode;
    manageWorkflowsContent: ReactNode;
  }) => (
    <div
      data-testid="network-tabs"
      data-active-tab={activeTab}
      data-show-manage={String(showManageNetworkTab)}
      data-show-manage-workflows={String(showManageWorkflowsTab)}
    >
      <div data-testid="current-network-content">{currentNetworkContent}</div>
      <div data-testid="manage-network-content">{manageNetworkContent}</div>
      <div data-testid="manage-workflows-content">{manageWorkflowsContent}</div>
    </div>
  ),
}));

vi.mock('@/features/network/ui/ManageNetworkTab', () => ({
  ManageNetworkTab: ({ canManageRelationships }: { canManageRelationships: boolean }) => (
    <div data-testid="manage-network-tab" data-can-manage={String(canManageRelationships)} />
  ),
}));

vi.mock('@/features/network/ui/ManageWorkflowsTab', () => ({
  ManageWorkflowsTab: ({ canManageWorkflows }: { canManageWorkflows: boolean }) => (
    <div data-testid="manage-workflows-tab" data-can-manage={String(canManageWorkflows)} />
  ),
}));

vi.mock('@/features/network/ui/CurrentNetworkTab', () => ({
  CurrentNetworkTab: () => <div data-testid="current-network-tab" />,
}));

vi.mock('@/features/network/ui/NetworkViewportPanel', () => ({
  NetworkViewportPanel: ({ children }: { children: ReactNode }) => (
    <div data-testid="network-viewport-panel">{children}</div>
  ),
}));

vi.mock('@/features/auth/ui/AccessDenied', () => ({
  AccessDenied: () => <div data-testid="access-denied" />,
}));

vi.mock('@/features/shared/ui/ui/global-loading-animation', () => ({
  GlobalLoadingAnimation: () => <div data-testid="global-loading-animation" />,
}));

function createBaseNetworkPageState() {
  return {
    activeTab: 'manage-network',
    setActiveTab: vi.fn(),
    groupName: 'Current Group',
    group: {
      group_type: 'base',
      sibling_membership_mode: null,
    },
    searchQuery: '',
    setSearchQuery: vi.fn(),
    directionFilter: 'all',
    setDirectionFilter: vi.fn(),
    manageRightFilter: new Set(['informationRight']),
    toggleManageRightFilter: vi.fn(),
    filteredIncoming: [],
    filteredOutgoing: [],
    filteredRelationships: [],
    allRelationships: [],
    handleAcceptRequest: vi.fn(),
    handleRejectRequest: vi.fn(),
    handleDeleteRelationship: vi.fn(),
    isWorkflowEditorOpen: false,
    editingWorkflow: null,
    workflowIncomingRequests: [],
    workflowOutgoingRequests: [],
    workflowActiveRelevant: [],
    workflowDraftStartGroupId: '',
    setWorkflowDraftStartGroupId: vi.fn(),
    workflowDraftName: '',
    setWorkflowDraftName: vi.fn(),
    workflowDraftDescription: '',
    setWorkflowDraftDescription: vi.fn(),
    workflowDraftIsDefaultEntry: false,
    setWorkflowDraftIsDefaultEntry: vi.fn(),
    workflowDraftSteps: [],
    availableWorkflows: [],
    availableGroups: [],
    openNewWorkflow: vi.fn(),
    openEditWorkflow: vi.fn(),
    closeWorkflowEditor: vi.fn(),
    addWorkflowStep: vi.fn(),
    updateWorkflowStepDraft: vi.fn(),
    removeWorkflowStep: vi.fn(),
    moveWorkflowStep: vi.fn(),
    handleSaveWorkflow: vi.fn(),
    handleDeleteWorkflow: vi.fn(),
    handleApproveWorkflowApproval: vi.fn(),
    handleRejectWorkflowApproval: vi.fn(),
  };
}

function createPermissions(options?: {
  canManage?: boolean;
  canView?: boolean;
  isMember?: boolean;
  isLoading?: boolean;
}) {
  return {
    canManage: () => options?.canManage ?? false,
    canView: () => options?.canView ?? false,
    isMember: () => options?.isMember ?? true,
    isLoading: options?.isLoading ?? false,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('group relationship routes', () => {
  it('shows the manage-network tab for users with view but without manage rights', () => {
    vi.spyOn(NetworkRoute, 'useParams').mockReturnValue({ id: 'group-1' } as never);
    useNetworkPageMock.mockReturnValue(createBaseNetworkPageState());
    usePermissionsMock.mockReturnValue(
      createPermissions({
        canManage: false,
        canView: true,
        isMember: true,
      })
    );

    render(<GroupNetworkPage />);

    expect(screen.getByTestId('network-tabs').getAttribute('data-show-manage')).toBe('true');
    expect(screen.getByTestId('network-tabs').getAttribute('data-show-manage-workflows')).toBe(
      'true'
    );
    expect(screen.getByTestId('network-tabs').getAttribute('data-active-tab')).toBe(
      'manage-network'
    );
    expect(screen.getByTestId('manage-network-tab').getAttribute('data-can-manage')).toBe('false');
    expect(screen.getByTestId('manage-workflows-tab').getAttribute('data-can-manage')).toBe(
      'false'
    );
  });

  it('keeps the network page on the current tab when relationship view rights are missing', () => {
    vi.spyOn(NetworkRoute, 'useParams').mockReturnValue({ id: 'group-1' } as never);
    useNetworkPageMock.mockReturnValue(createBaseNetworkPageState());
    usePermissionsMock.mockReturnValue(
      createPermissions({
        canManage: false,
        canView: false,
        isMember: true,
      })
    );

    render(<GroupNetworkPage />);

    expect(screen.getByTestId('network-tabs').getAttribute('data-show-manage')).toBe('false');
    expect(screen.getByTestId('network-tabs').getAttribute('data-show-manage-workflows')).toBe(
      'false'
    );
    expect(screen.getByTestId('network-tabs').getAttribute('data-active-tab')).toBe(
      'current-network'
    );
    expect(screen.queryByTestId('manage-network-tab')).toBeNull();
    expect(screen.queryByTestId('manage-workflows-tab')).toBeNull();
  });

  it('hides the manage-network tab for non-members even when relationship view rights exist', () => {
    vi.spyOn(NetworkRoute, 'useParams').mockReturnValue({ id: 'group-1' } as never);
    useNetworkPageMock.mockReturnValue(createBaseNetworkPageState());
    usePermissionsMock.mockReturnValue(
      createPermissions({
        canManage: false,
        canView: true,
        isMember: false,
      })
    );

    render(<GroupNetworkPage />);

    expect(screen.getByTestId('network-tabs').getAttribute('data-show-manage')).toBe('false');
    expect(screen.getByTestId('network-tabs').getAttribute('data-show-manage-workflows')).toBe(
      'false'
    );
    expect(screen.getByTestId('network-tabs').getAttribute('data-active-tab')).toBe(
      'current-network'
    );
    expect(screen.queryByTestId('manage-network-tab')).toBeNull();
    expect(screen.queryByTestId('manage-workflows-tab')).toBeNull();
  });

  it('blocks the direct relationships route when relationship view rights are missing', () => {
    vi.spyOn(RelationshipsRoute, 'useParams').mockReturnValue({ id: 'group-1' } as never);
    useNetworkPageMock.mockReturnValue(createBaseNetworkPageState());
    usePermissionsMock.mockReturnValue(
      createPermissions({
        canManage: false,
        canView: false,
        isMember: true,
      })
    );

    render(<GroupRelationshipsPage />);

    expect(screen.queryByTestId('access-denied')).not.toBeNull();
    expect(screen.queryByTestId('manage-network-tab')).toBeNull();
  });

  it('blocks the direct relationships route for non-members even with relationship view rights', () => {
    vi.spyOn(RelationshipsRoute, 'useParams').mockReturnValue({ id: 'group-1' } as never);
    useNetworkPageMock.mockReturnValue(createBaseNetworkPageState());
    usePermissionsMock.mockReturnValue(
      createPermissions({
        canManage: false,
        canView: true,
        isMember: false,
      })
    );

    render(<GroupRelationshipsPage />);

    expect(screen.queryByTestId('access-denied')).not.toBeNull();
    expect(screen.queryByTestId('manage-network-tab')).toBeNull();
  });

  it('renders the direct relationships route in read-only mode for users with view rights only', () => {
    vi.spyOn(RelationshipsRoute, 'useParams').mockReturnValue({ id: 'group-1' } as never);
    useNetworkPageMock.mockReturnValue(createBaseNetworkPageState());
    usePermissionsMock.mockReturnValue(
      createPermissions({
        canManage: false,
        canView: true,
        isMember: true,
      })
    );

    render(<GroupRelationshipsPage />);

    expect(screen.getByTestId('manage-network-tab').getAttribute('data-can-manage')).toBe('false');
  });
});
