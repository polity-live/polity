/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  overlayProps: undefined as any,
  permissionsProps: undefined as any,
}));
vi.mock('@/features/shared/ui/action-submission', () => ({
  ActionSubmissionOverlay: (props: any) => {
    mocks.overlayProps = props;
    return <div>submission</div>;
  },
}));
vi.mock('@/features/groups/ui/RolesPermissionsTable', () => ({
  RolesPermissionsTable: (props: any) => {
    mocks.permissionsProps = props;
    return <div>permissions</div>;
  },
}));

import { InviteDialogView } from '../InviteDialogView';
import { RolesManagementCardView } from '../RolesManagementCardView';

afterEach(cleanup);

describe('amendment collaborator view LSF callbacks', () => {
  it('forwards retry from the active invite submission overlay', () => {
    const retry = vi.fn();
    render(
      <InviteDialogView
        {...({
          actionSubmission: { isActive: true, retry, reset: vi.fn() },
          inviteDialogOpen: true,
          isInviting: false,
          isLoading: false,
          selectedUsers: ['user-1'],
          typeaheadItems: [{ id: 'user-1', label: 'Ada' }],
          onInviteDialogOpenChange: vi.fn(),
          onInviteUsersClick: vi.fn(),
          onSelectedUsersChange: vi.fn(),
        } as any)}
      />
    );
    mocks.overlayProps.onRetry();
    expect(retry).toHaveBeenCalledOnce();
  });

  it('forwards permission table changes to the role controller', () => {
    const handleToggleActionRight = vi.fn();
    render(
      <RolesManagementCardView
        {...({
          roles: [],
          newRoleName: '',
          setNewRoleName: vi.fn(),
          newRoleDescription: '',
          setNewRoleDescription: vi.fn(),
          addRoleDialogOpen: false,
          setAddRoleDialogOpen: vi.fn(),
          handleAddRole: vi.fn(),
          handleRemoveRole: vi.fn(),
          handleToggleActionRight,
        } as any)}
      />
    );
    mocks.permissionsProps.onTogglePermission('role-1', 'amendments', 'manage', false);
    expect(handleToggleActionRight).toHaveBeenCalledWith('role-1', 'amendments', 'manage', false);
  });
});
