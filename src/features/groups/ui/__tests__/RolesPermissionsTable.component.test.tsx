/* @vitest-environment jsdom */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RolesPermissionsTable } from '../RolesPermissionsTable';

describe('RolesPermissionsTable', () => {
  it('renders grouped section tables for action rights', () => {
    const onTogglePermission = vi.fn();
    const { container } = render(
      <RolesPermissionsTable
        roles={[
          {
            id: 'role-1',
            name: 'Member',
            assignment_mode: 'assigned',
            action_rights: [],
          },
        ]}
        onTogglePermission={onTogglePermission}
      />
    );

    const operationsSection = screen.getByTestId('action-right-section-operations');
    const groupManagementSection = screen.getByTestId('action-right-section-group-management');
    const eventAgendaSection = screen.getByTestId('action-right-section-event-agenda');
    const contentSection = screen.getByTestId('action-right-section-content-moderation');

    expect(within(operationsSection).getByText('Manage Documents')).toBeTruthy();
    expect(within(operationsSection).queryByText('Manage Members')).toBeNull();

    expect(within(groupManagementSection).getByText('Manage Members')).toBeTruthy();
    expect(within(groupManagementSection).getByText('Manage Messages')).toBeTruthy();

    expect(within(eventAgendaSection).getByText('Manage Events')).toBeTruthy();
    expect(within(eventAgendaSection).getByText('Manage Agenda Items')).toBeTruthy();

    expect(within(contentSection).getByText('Manage Amendments')).toBeTruthy();
    expect(within(contentSection).getByText('Manage Blogs')).toBeTruthy();

    const matrixSurface = operationsSection.querySelector('.bg-card');
    expect(matrixSurface).toBeTruthy();
    expect(matrixSurface?.className).toContain('rounded-md');
    expect(matrixSurface?.className).toContain('shadow-[var(--shadow-panel)]');
    const permission = container.querySelector<HTMLElement>(
      '[data-action-id="groups.roles.permissions.toggle"]'
    )!;
    fireEvent.click(permission);
    expect(onTogglePermission).toHaveBeenCalledWith(
      'role-1',
      expect.any(String),
      expect.any(String),
      false
    );
  });
});
