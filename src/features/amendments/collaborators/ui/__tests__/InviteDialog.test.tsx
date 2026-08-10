// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InviteDialog } from '@/features/amendments/collaborators/ui/InviteDialog';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/features/amendments/collaborators/hooks/useUserSearch', () => ({
  useUserSearch: () => ({
    users: [
      {
        id: 'user-1',
        name: 'Alice Example',
        handle: 'alice',
        contactEmail: 'alice@example.com',
        avatar: undefined,
      },
      {
        id: 'user-2',
        name: 'Bob Example',
        handle: 'bob',
        contactEmail: 'bob@example.com',
        avatar: undefined,
      },
    ],
    isLoading: false,
  }),
}));

describe('InviteDialog', () => {
  it('uses the reusable multi-select typeahead for collaborator invites', async () => {
    const onInviteUsers = vi.fn().mockResolvedValue(undefined);

    render(
      <InviteDialog
        amendmentId="amendment-1"
        existingCollaborators={[]}
        roles={[{ id: 'role-1', name: 'Collaborator' } as never]}
        onInviteUsers={onInviteUsers}
      />
    );

    fireEvent.click(
      document.querySelector('[data-action-id="amendments.collaborators.open.invite-dialog"]')!
    );
    fireEvent.focus(screen.getByPlaceholderText('Search by name, handle, or email...'));
    fireEvent.click(screen.getByRole('button', { name: /Alice Example/i }));

    expect(screen.getByText('@alice')).toBeTruthy();

    fireEvent.click(
      document.querySelector('[data-action-id="amendments.collaborators.submit.invite"]')!
    );

    await waitFor(() =>
      expect(onInviteUsers).toHaveBeenCalledWith(['user-1'], 'amendment-1', 'role-1')
    );
  });

  it('cancels collaborator invitations through a stable dialog action', async () => {
    render(
      <InviteDialog
        amendmentId="amendment-1"
        existingCollaborators={[]}
        roles={[{ id: 'role-1', name: 'Collaborator' } as never]}
        onInviteUsers={vi.fn()}
      />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="amendments.collaborators.open.invite-dialog"]')!
    );
    const cancel = await waitFor(() => {
      const action = document.querySelector(
        '[data-action-id="amendments.collaborators.cancel.invite"]'
      );
      expect(action).toBeTruthy();
      return action;
    });
    fireEvent.click(cancel!);
    expect(screen.queryByText(/Invite Collaborators/i)).toBeNull();
  });
});

afterEach(cleanup);
