/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventRolesView } from '../EventRolesView';

afterEach(() => {
  cleanup();
});

describe('EventRolesView loading state', () => {
  it('renders section skeleton rows instead of blank loading content', () => {
    const { container } = render(
      <EventRolesView
        {...({
          event: null,
          roles: [],
          accessRoles: [],
          isLoading: true,
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
        } as any)}
      />
    );

    expect(container.querySelector('[data-slot="section-skeleton"]')).toBeTruthy();
    expect(container.textContent?.trim()).not.toBe('');
  });
});
