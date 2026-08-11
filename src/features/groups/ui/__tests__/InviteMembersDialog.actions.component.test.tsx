/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InviteMembersDialog } from '../InviteMembersDialog';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/create/ui/inputs/UserSearchInput', () => ({
  UserSearchInput: () => <div data-testid="user-search" />,
}));

afterEach(cleanup);

describe('InviteMembersDialog actions', () => {
  it('opens, cancels, and submits member invitations through stable actions', async () => {
    const onOpenChange = vi.fn();
    const onInvite = vi.fn(() => Promise.resolve());
    const { container } = render(
      <InviteMembersDialog
        isOpen
        onOpenChange={onOpenChange}
        selectedUsers={['user-1']}
        onSelectedUsersChange={vi.fn()}
        roles={[{ id: 'role-1', name: 'Member' }]}
        selectedRoleIds={['role-1']}
        onSelectedRoleIdsChange={vi.fn()}
        onInvite={onInvite}
        isInviting={false}
      />
    );

    expect(
      container.querySelector('[data-action-id="groups.invitations.open.members-dialog"]')
    ).toBeTruthy();
    const cancel = document.querySelector<HTMLElement>(
      '[data-action-id="groups.invitations.dialog.cancel"]'
    )!;
    cancel.focus();
    expect(document.activeElement).toBe(cancel);
    fireEvent.click(cancel);
    fireEvent.click(document.querySelector('[data-action-id="groups.invitations.dialog.submit"]')!);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(onInvite).toHaveBeenCalledTimes(1));
  });
});
