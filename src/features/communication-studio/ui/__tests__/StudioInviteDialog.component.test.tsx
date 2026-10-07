vi.mock('@rocicorp/zero/react', async () => {
  const { useStudioQueryFixture } = await import('@/test/studio-client.fixture');
  return { useQuery: (q: any) => useStudioQueryFixture(q, io) };
});
vi.mock('@/zero/queries', async () => {
  const { studioQueryFixture } = await import('@/test/studio-client.fixture');
  return { queries: { studio: studioQueryFixture } };
});
/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({ request: vi.fn(), users: [] as any[] | undefined, loading: false }));
vi.mock('@/zero/communication-studio/useStudioClient', async () => {
  const { studioClientFixture } = await import('@/test/studio-client.fixture');
  return { useStudioClient: () => studioClientFixture(io) };
});
vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({ allUsers: io.users, isLoading: io.loading }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key.split('.').at(-1) }),
  translate: (key: string) => key.split('.').at(-1),
}));
import { StudioInviteDialog } from '../StudioInviteDialog';

beforeEach(() => {
  io.loading = false;
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
  it('labels available users and existing collaborators from names, handles, email and the anonymous-name fallback', async () => {
    io.users = [
      {
        id: 'handle',
        first_name: null,
        last_name: null,
        handle: 'handleonly',
        email: null,
        avatar: null,
      },
      {
        id: 'email',
        first_name: null,
        last_name: null,
        handle: null,
        email: 'mail@example.test',
        avatar: null,
      },
      { id: 'empty', first_name: null, last_name: null, handle: null, email: null, avatar: null },
      {
        id: 'declined',
        first_name: 'Declined',
        last_name: null,
        handle: null,
        email: null,
        avatar: null,
      },
    ];
    io.request.mockImplementation(async operation =>
      operation === 'collaborators'
        ? [
            {
              id: 'active',
              user_id: 'former',
              status: 'active',
              first_name: null,
              last_name: null,
              handle: null,
            },
            {
              id: 'declined',
              user_id: 'declined',
              status: 'declined',
              first_name: 'Declined',
              last_name: null,
              handle: null,
            },
          ]
        : {}
    );
    render(<StudioInviteDialog projectId="project" currentUserId="owner" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'invite' }));
    const input = await screen.findByPlaceholderText('inviteSearch');
    await user.click(input);
    for (const name of ['handleonly', 'mail@example.test', 'unnamedUser', 'Declined'])
      expect(screen.getByRole('button', { name: new RegExp(`${name} user`) })).toBeTruthy();
    expect(screen.getByText('unnamedUser · activeCollaborator')).toBeTruthy();
    expect(screen.queryByText('Declined · pendingInvitation')).toBeNull();
  });
  it('displays a non-Error collaborator update failure without losing the selected users', async () => {
    io.request.mockImplementation(async operation =>
      operation === 'collaborators' ? [] : Promise.reject('Service unavailable')
    );
    render(<StudioInviteDialog projectId="project" currentUserId="owner" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'invite' }));
    await user.click(await screen.findByPlaceholderText('inviteSearch'));
    await user.click(screen.getByRole('button', { name: /Alice Example user/ }));
    await user.click(screen.getByRole('button', { name: 'invite (1)' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Service unavailable');
    expect(screen.getByRole('button', { name: 'invite (1)' })).toHaveProperty('disabled', false);
  });
  it('opens and cancels using native keyboard focus while collaborator loading is pending', async () => {
    let resolve!: (value: unknown) => void;
    io.request.mockReturnValue(
      new Promise(complete => {
        resolve = complete;
      })
    );
    render(<StudioInviteDialog projectId="project" currentUserId="owner" />);
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'invite' });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'loading');
    const submit = screen.getByRole('button', { name: 'invite (0)' });
    expect(submit).toHaveProperty('disabled', true);
    const cancel = screen.getByRole('button', { name: 'cancel' });
    cancel.focus();
    expect(document.activeElement).toBe(cancel);
    await user.keyboard(' ');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
    await act(async () => resolve([]));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it.each(['invite', 'resend', 'remove'] as const)(
    'performs %s by keyboard, disables repeat actions while awaiting the API and refreshes collaborators',
    async action => {
      let collaborators =
        action === 'invite'
          ? []
          : [
              {
                id: 'membership',
                user_id: 'alice',
                status: 'invited',
                first_name: 'Alice',
                last_name: 'Example',
                handle: 'alice',
              },
            ];
      let resolve!: (value: unknown) => void;
      io.request.mockImplementation(async operation =>
        operation === 'collaborators'
          ? collaborators
          : new Promise(complete => {
              resolve = complete;
            })
      );
      render(<StudioInviteDialog projectId="project" currentUserId="owner" />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'invite' }));
      const input = await screen.findByPlaceholderText('inviteSearch');
      if (action === 'invite') {
        await user.click(input);
        await user.click(screen.getByRole('button', { name: /Alice Example user/ }));
      }
      const button = screen.getByRole('button', {
        name:
          action === 'invite'
            ? 'invite (1)'
            : action === 'resend'
              ? 'resendInvitation'
              : 'removeCollaborator',
      });
      expect(button).toHaveProperty('disabled', false);
      button.focus();
      expect(document.activeElement).toBe(button);
      await user.keyboard('{Enter}');
      expect(button).toHaveProperty('disabled', true);
      expect(screen.getByRole('button', { name: 'cancel' })).toHaveProperty('disabled', true);
      await user.click(button);
      expect(
        io.request.mock.calls.filter(([operation]) => operation !== 'collaborators')
      ).toHaveLength(1);
      expect(io.request).toHaveBeenCalledWith(
        action === 'remove' ? 'removeCollaborator' : 'inviteCollaborators',
        action === 'remove'
          ? { projectId: 'project', userId: 'alice' }
          : { projectId: 'project', userIds: ['alice'] }
      );
      collaborators =
        action === 'remove'
          ? []
          : [
              {
                id: 'membership',
                user_id: 'alice',
                status: 'active',
                first_name: 'Alice',
                last_name: 'Example',
                handle: 'alice',
              },
            ];
      await act(async () => resolve({}));
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByRole('button', { name: 'cancel' })).toHaveProperty('disabled', false);
      if (action === 'remove')
        expect(screen.queryByText('Alice Example · pendingInvitation')).toBeNull();
      else expect(screen.getByText('Alice Example · activeCollaborator')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'invite (0)' })).toHaveProperty('disabled', true);
    }
  );
  it.each(['invite', 'resend', 'remove'] as const)(
    'preserves the dialog after unauthorized %s and permits keyboard cancellation',
    async action => {
      io.request.mockImplementation(async operation =>
        operation === 'collaborators'
          ? action === 'invite'
            ? []
            : [
                {
                  id: 'member',
                  user_id: 'alice',
                  status: 'invited',
                  first_name: null,
                  last_name: null,
                  handle: 'alice',
                },
              ]
          : Promise.reject(new Error('Authentication required'))
      );
      render(<StudioInviteDialog projectId="project" currentUserId="owner" />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'invite' }));
      const input = await screen.findByPlaceholderText('inviteSearch');
      if (action === 'invite') {
        await user.click(input);
        await user.click(screen.getByRole('button', { name: /Alice Example user/ }));
      }
      const button = screen.getByRole('button', {
        name:
          action === 'invite'
            ? 'invite (1)'
            : action === 'resend'
              ? 'resendInvitation'
              : 'removeCollaborator',
      });
      button.focus();
      await user.keyboard('{Enter}');
      expect(await screen.findByRole('alert')).toHaveProperty(
        'textContent',
        'Authentication required'
      );
      expect(button).toHaveProperty('disabled', false);
      const cancel = screen.getByRole('button', { name: 'cancel' });
      cancel.focus();
      await user.keyboard('{Enter}');
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    }
  );
  it.each([true, false])(
    'ignores late collaborator loading after closing when successful=%s',
    async success => {
      let resolve!: (value: unknown) => void, reject!: (reason: unknown) => void;
      io.request.mockReturnValue(
        new Promise((complete, failure) => {
          resolve = complete;
          reject = failure;
        })
      );
      render(<StudioInviteDialog projectId="project" currentUserId="owner" />);
      await userEvent.setup().click(screen.getByRole('button', { name: 'invite' }));
      await screen.findByRole('dialog');
      await userEvent.setup().click(screen.getByRole('button', { name: 'cancel' }));
      await act(async () => (success ? resolve([]) : reject('Late collaborator failure')));
      expect(screen.queryByRole('dialog')).toBeNull();
    }
  );
  it('reports a collaborator loading failure and keeps an empty invitation disabled', async () => {
    io.request.mockRejectedValue(new Error('Authentication required'));
    io.users = undefined;
    render(<StudioInviteDialog projectId="project" currentUserId="owner" />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'invite' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Authentication required'
    );
    expect(screen.getByRole('button', { name: 'invite (0)' })).toHaveProperty('disabled', true);
  });
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
