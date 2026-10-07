vi.mock('@rocicorp/zero/react', async () => {
  const { useStudioQueryFixture } = await import('@/test/studio-client.fixture');
  return { useQuery: (q: any) => useStudioQueryFixture(q, io) };
});
vi.mock('@/zero/queries', async () => {
  const { studioQueryFixture } = await import('@/test/studio-client.fixture');
  return { queries: { studio: studioQueryFixture } };
});
/* @vitest-environment jsdom */
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/zero/communication-studio/useStudioClient', async () => {
  const { studioClientFixture } = await import('@/test/studio-client.fixture');
  return { useStudioClient: () => studioClientFixture(io) };
});
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key.split('.').at(-1) }),
  translate: (key: string) => key,
}));
import { StudioInvitations } from '../StudioInvitations';
const invitations = [
  {
    id: 'first',
    project_id: 'one',
    title: 'First project',
    owner_id: 'owner',
    first_name: 'Ada',
    last_name: 'Lovelace',
    handle: 'ada',
  },
  {
    id: 'second',
    project_id: 'two',
    title: 'Second project',
    owner_id: 'other',
    first_name: null,
    last_name: null,
    handle: 'owner-handle',
  },
];
beforeEach(() => {
  io.request
    .mockReset()
    .mockImplementation(async operation => (operation === 'myInvitations' ? invitations : {}));
});
afterEach(cleanup);
it.each([true, false])(
  'responds with accept=%s by keyboard, blocks repeated actions while saving and removes only the answered invitation',
  async accept => {
    let resolve!: (value: unknown) => void;
    io.request.mockImplementation(async operation =>
      operation === 'myInvitations'
        ? invitations
        : new Promise(complete => {
            resolve = complete;
          })
    );
    render(<StudioInvitations />);
    expect(screen.queryByRole('region')).toBeNull();
    const target = (await screen.findByText('First project')).closest('div')!.parentElement!;
    const user = userEvent.setup();
    const button = within(target).getByRole('button', {
      name: accept ? 'acceptInvitation' : 'declineInvitation',
    });
    expect(screen.getByText('invitedBy Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('invitedBy owner-handle')).toBeTruthy();
    expect(button).toHaveProperty('disabled', false);
    button.focus();
    expect(document.activeElement).toBe(button);
    await user.keyboard('{Enter}');
    expect(screen.getAllByRole('button').every(control => control.hasAttribute('disabled'))).toBe(
      true
    );
    await user.keyboard('{Enter}');
    await user.click(button);
    expect(
      io.request.mock.calls.filter(([operation]) => operation === 'respondInvitation')
    ).toHaveLength(1);
    expect(io.request).toHaveBeenCalledWith('respondInvitation', { invitationId: 'first', accept });
    await act(async () => resolve({}));
    expect(screen.queryByText('First project')).toBeNull();
    expect(screen.getByText('Second project')).toBeTruthy();
    expect(screen.getAllByRole('button').every(control => !control.hasAttribute('disabled'))).toBe(
      true
    );
    await user.click(screen.getByRole('button', { name: 'declineInvitation' }));
    await act(async () => resolve({}));
    expect(screen.queryByRole('region')).toBeNull();
  }
);
it.each([true, false])(
  'retains an invitation after an unauthorized accept=%s response and permits a successful retry',
  async accept => {
    io.request.mockImplementation(async operation =>
      operation === 'myInvitations'
        ? invitations
        : Promise.reject(new Error('Authentication required'))
    );
    render(<StudioInvitations />);
    const user = userEvent.setup();
    const button = (
      await screen.findAllByRole('button', {
        name: accept ? 'acceptInvitation' : 'declineInvitation',
      })
    )[0];
    button.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Authentication required'
    );
    expect(screen.getByText('First project')).toBeTruthy();
    expect(button).toHaveProperty('disabled', false);
    io.request.mockResolvedValueOnce({});
    await user.keyboard('{Enter}');
    expect(screen.queryByText('First project')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  }
);
it('renders a non-Error response failure and keeps invitations available', async () => {
  io.request.mockImplementation(async operation =>
    operation === 'myInvitations' ? invitations : Promise.reject('Service unavailable')
  );
  render(<StudioInvitations />);
  await userEvent
    .setup()
    .click((await screen.findAllByRole('button', { name: 'acceptInvitation' }))[0]);
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Service unavailable');
  expect(screen.getByText('First project')).toBeTruthy();
});
it.each([new Error('Authentication required'), 'Invitations unavailable'])(
  'shows invitation loading failures without exposing actions for %s',
  async reason => {
    io.request.mockRejectedValue(reason);
    render(<StudioInvitations />);
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      reason instanceof Error ? reason.message : reason
    );
    expect(screen.queryByRole('button')).toBeNull();
  }
);
it.each([true, false])(
  'ignores invitation loading after unmount when successful=%s',
  async success => {
    let resolve!: (value: unknown) => void, reject!: (reason: unknown) => void;
    io.request.mockReturnValue(
      new Promise((complete, failure) => {
        resolve = complete;
        reject = failure;
      })
    );
    const view = render(<StudioInvitations />);
    view.unmount();
    await act(async () => (success ? resolve(invitations) : reject(new Error('Late response'))));
    expect(screen.queryByRole('region')).toBeNull();
  }
);
