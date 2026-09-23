/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({ request: vi.fn(), users: [] as any[] }));
vi.mock('@/zero/communication-studio/useStudioApi', () => ({ studioRequest: io.request }));
vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({ allUsers: io.users, isLoading: false }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key.split('.').at(-1) }),
  translate: (key: string) => key.split('.').at(-1),
}));
import { StudioInviteDialog } from '../StudioInviteDialog';

beforeEach(() => {
  io.users = [
    {
      id: 'owner',
      first_name: 'Owner',
      last_name: null,
      handle: 'owner',
      email: 'owner@example.test',
      avatar: null,
    },
    {
      id: 'alice',
      first_name: 'Alice',
      last_name: 'Example',
      handle: 'alice',
      email: 'alice@example.test',
      avatar: null,
    },
    {
      id: 'bob',
      first_name: 'Bob',
      last_name: 'Example',
      handle: 'bob',
      email: 'bob@example.test',
      avatar: null,
    },
  ];
  io.request
    .mockReset()
    .mockImplementation(async (operation: string) =>
      operation === 'collaborators' ? [] : { invited: 2 }
    );
});
afterEach(cleanup);

describe('Studio collaborator dialog', () => {
  it('selects multiple users and submits one personal project invitation request', async () => {
    render(<StudioInviteDialog projectId="project" currentUserId="owner" />);
    fireEvent.click(screen.getByRole('button', { name: 'invite' }));
    const input = await screen.findByPlaceholderText('inviteSearch');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'alice@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: /Alice Example user/ }));
    fireEvent.focus(input);
    fireEvent.click(screen.getByRole('button', { name: /Bob Example user/ }));
    fireEvent.click(screen.getByRole('button', { name: 'invite (2)' }));
    await waitFor(() =>
      expect(io.request).toHaveBeenCalledWith('inviteCollaborators', {
        projectId: 'project',
        userIds: ['alice', 'bob'],
      })
    );
    expect(screen.queryByRole('button', { name: /Owner user/ })).toBeNull();
  });
});
