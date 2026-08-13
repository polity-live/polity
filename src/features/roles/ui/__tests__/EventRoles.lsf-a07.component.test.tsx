/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  viewProps: undefined as Record<string, unknown> | undefined,
  management: {
    event: { id: 'event-1' },
    roles: [{ id: 'role-1' }],
    accessRoles: [],
    isLoading: false,
    addRoleOpen: false,
    setAddRoleOpen: vi.fn(),
    newRoleForm: {},
    setNewRoleForm: vi.fn(),
    editRoleOpen: false,
    setEditRoleOpen: vi.fn(),
    editRoleForm: {},
    setEditRoleForm: vi.fn(),
    editingRole: null,
    addRole: vi.fn(),
    openEditRole: vi.fn(),
    saveEditedRole: vi.fn(),
    removeRole: vi.fn(),
    togglePermission: vi.fn(),
    reorderRoles: vi.fn(),
    createElectionForRole: vi.fn(),
    getPermissionDisabledReason: vi.fn(),
  },
}));

vi.mock('@/features/events/hooks/useEventRoleManagement', () => ({
  useEventRoleManagement: () => mocks.management,
}));
vi.mock('../EventRolesView', () => ({
  EventRolesView: (props: Record<string, unknown>) => {
    mocks.viewProps = props;
    return <div>event-roles-view</div>;
  },
}));

import { EventRoles } from '../EventRoles';

afterEach(cleanup);

describe('A07 EventRoles facade contract', () => {
  it('forwards the event id and complete management contract', () => {
    render(<EventRoles eventId="event-1" />);
    expect(mocks.viewProps).toEqual({ eventId: 'event-1', ...mocks.management });
  });
});
