/* @vitest-environment jsdom */
import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InviteCollaboratorDialog } from '../InviteCollaboratorDialog';

vi.mock('../../hooks/useInviteCollaboratorModel', () => ({
  useInviteCollaboratorModel: () => {
    const [open, setOpen] = useState(false);
    return {
      open,
      setOpen,
      filteredUsers: [],
      users: [],
      selectedUsers: [],
      searchQuery: '',
      isLoading: false,
      isInviting: false,
      handleInvite: vi.fn(),
      setSearchQuery: vi.fn(),
      toggleUserSelection: vi.fn(),
    };
  },
}));
afterEach(cleanup);

describe('canvas collaborator invitation triggers', () => {
  it('forwards a custom trigger through the wrapper and opens the real dialog', async () => {
    const user = userEvent.setup();
    render(
      <InviteCollaboratorDialog
        entityType="amendment"
        entityId="amendment-1"
        currentUserId="user-1"
        trigger={
          <button data-action-id="amendment.city-design.collaborators.open">
            Invite to design
          </button>
        }
      />
    );
    const trigger = screen.getByRole('button', { name: 'Invite to design' });
    expect(trigger.getAttribute('data-action-id')).toBe('amendment.city-design.collaborators.open');
    expect(document.querySelector('[data-action-id="editor.collaborator-invite.open"]')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeTruthy();
    await user.click(
      document.querySelector<HTMLButtonElement>(
        '[data-action-id="editor.collaborator-invite.cancel"]'
      )!
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the default invitation trigger working for existing consumers', async () => {
    const user = userEvent.setup();
    render(
      <InviteCollaboratorDialog
        entityType="amendment"
        entityId="amendment-1"
        currentUserId="user-1"
      />
    );
    const trigger = document.querySelector<HTMLButtonElement>(
      '[data-action-id="editor.collaborator-invite.open"]'
    )!;
    expect(trigger).toBeTruthy();
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
