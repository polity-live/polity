/* @vitest-environment jsdom */

import { useState } from 'react';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAvatarUpload } from '../hooks/useAvatarUpload';
import { useUserProfileForm } from '../hooks/useUserProfileForm';
import { renderComponentFlow } from '@/test/render-component-flow';

const profile = vi.hoisted(() => ({
  navigate: vi.fn(),
  storageUpload: vi.fn(),
  toastError: vi.fn(),
  updateCompleteProfile: vi.fn(),
  updateProfileClientApplied: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => profile.navigate }));
vi.mock('../hooks/useUserMutations', () => ({
  useUserMutations: () => ({ updateCompleteProfile: profile.updateCompleteProfile }),
}));
vi.mock('@/zero/common/useCommonState', () => ({
  useCommonState: () => ({ userHashtags: [], allHashtags: [] }),
}));
vi.mock('@/zero/users/useUserActions', () => ({
  useUserActions: () => ({ updateProfileClientApplied: profile.updateProfileClientApplied }),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: profile.storageUpload,
        getPublicUrl: () => ({ data: { publicUrl: 'http://localhost/avatar.png' } }),
      }),
    },
  }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: profile.toastError },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

const user = {
  id: 'profile-user',
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@polity.local',
  visibility: 'public',
} as any;

function ProfileFlow() {
  const flow = useUserProfileForm({ userId: user.id, user });
  return (
    <form onSubmit={flow.handleSubmit}>
      <input
        aria-label="first-name"
        value={flow.formData.firstName}
        onChange={event => flow.updateField('firstName', event.target.value)}
      />
      <select
        aria-label="visibility"
        value={flow.formData.visibility}
        onChange={event => flow.updateField('visibility', event.target.value as any)}
      >
        <option value="public">public</option>
        <option value="private">private</option>
      </select>
      <button type="submit">save-profile</button>
    </form>
  );
}

function AvatarFlow() {
  const [status, setStatus] = useState('idle');
  const { uploadAvatar } = useAvatarUpload({ userId: user.id });
  return (
    <>
      <button
        type="button"
        onClick={() => {
          void uploadAvatar(new File(['avatar'], 'avatar.png', { type: 'image/png' }))
            .then(() => setStatus('saved'))
            .catch(() => setStatus('failed'));
        }}
      >
        upload-avatar
      </button>
      <output aria-label="avatar-status">{status}</output>
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  profile.updateCompleteProfile.mockResolvedValue({ success: true });
  profile.storageUpload.mockResolvedValue({ error: null });
  profile.updateProfileClientApplied.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('profile settings flow', () => {
  it('edits profile data and navigates only after the mutation succeeds', async () => {
    renderComponentFlow(<ProfileFlow />);
    await screen.findByDisplayValue('Ada');
    fireEvent.change(screen.getByLabelText('first-name'), { target: { value: 'Augusta Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'save-profile' }));

    await waitFor(() => expect(profile.updateCompleteProfile).toHaveBeenCalledTimes(1));
    expect(profile.updateCompleteProfile.mock.calls[0][1]).toMatchObject({
      first_name: 'Augusta Ada',
      visibility: 'public',
    });
    expect(profile.navigate).toHaveBeenCalledWith({ to: '/user/profile-user' });
  });

  it('surfaces an avatar upload failure without mutating the user profile', async () => {
    const error = new Error('storage unavailable');
    profile.storageUpload.mockResolvedValue({ error });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderComponentFlow(<AvatarFlow />);
    fireEvent.click(screen.getByRole('button', { name: 'upload-avatar' }));

    await screen.findByText('failed');
    expect(profile.toastError).toHaveBeenCalledWith(
      'generated.inline.1180_failed_to_upload_avatar_65dabbbc'
    );
    expect(profile.updateProfileClientApplied).not.toHaveBeenCalled();
  });

  it('persists the selected profile visibility in the same save transaction', async () => {
    renderComponentFlow(<ProfileFlow />);
    await screen.findByDisplayValue('Ada');
    fireEvent.change(screen.getByLabelText('visibility'), { target: { value: 'private' } });
    fireEvent.click(screen.getByRole('button', { name: 'save-profile' }));

    await waitFor(() => expect(profile.updateCompleteProfile).toHaveBeenCalledTimes(1));
    expect(profile.updateCompleteProfile.mock.calls[0][1]).toMatchObject({ visibility: 'private' });
  });
});
