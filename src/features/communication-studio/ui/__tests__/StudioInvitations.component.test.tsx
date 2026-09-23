/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const io = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/zero/communication-studio/useStudioApi', () => ({ studioRequest: io.request }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key.split('.').at(-1) }),
}));
import { StudioInvitations } from '../StudioInvitations';

beforeEach(() => {
  io.request.mockReset().mockImplementation(async (operation: string) =>
    operation === 'myInvitations'
      ? [
          {
            id: 'invite',
            project_id: 'project',
            title: 'Shared draft',
            owner_id: 'owner',
            first_name: 'Ada',
            last_name: null,
            handle: 'ada',
          },
        ]
      : { status: 'active' }
  );
});
afterEach(cleanup);

it('accepts a personal Studio invitation from the overview', async () => {
  render(<StudioInvitations />);
  expect(await screen.findByText('Shared draft')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'acceptInvitation' }));
  await waitFor(() =>
    expect(io.request).toHaveBeenCalledWith('respondInvitation', {
      invitationId: 'invite',
      accept: true,
    })
  );
  await waitFor(() => expect(screen.queryByText('Shared draft')).toBeNull());
});

it('declines a personal Studio invitation without opening the project', async () => {
  render(<StudioInvitations />);
  expect(await screen.findByText('Shared draft')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'declineInvitation' }));
  await waitFor(() =>
    expect(io.request).toHaveBeenCalledWith('respondInvitation', {
      invitationId: 'invite',
      accept: false,
    })
  );
});
