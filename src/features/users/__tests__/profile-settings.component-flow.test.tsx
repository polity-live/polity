/* @vitest-environment jsdom */

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserEdit } from '../ui/UserEdit';
import { renderComponentFlow } from '@/test/render-component-flow';

const profile = vi.hoisted(() => ({
  navigate: vi.fn(),
  storageUpload: vi.fn(),
  toastError: vi.fn(),
  updateCompleteProfile: vi.fn(),
  updateProfileClientApplied: vi.fn(),
}));

const user = {
  id: 'profile-user',
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@polity.local',
  visibility: 'public',
} as any;

vi.mock('@tanstack/react-router', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useNavigate: () => profile.navigate };
});
vi.mock('../hooks/useUserData', () => ({
  useUserData: () => ({ user, isLoading: false }),
}));
vi.mock('../hooks/useUserMutations', () => ({
  useUserMutations: () => ({ updateCompleteProfile: profile.updateCompleteProfile }),
}));
vi.mock('@/zero/common/useCommonState', () => ({
  useCommonState: () => ({ userHashtags: [], allHashtags: [] }),
}));
vi.mock('@/zero/users/useUserActions', () => ({
  useUserActions: () => ({ updateProfileClientApplied: profile.updateProfileClientApplied }),
}));
vi.mock('@/features/payments/hooks/useSubscriptionManagement', () => ({
  useSubscriptionManagement: () => ({
    activeSubscription: null,
    hasStripeCustomer: false,
    isPlanActive: () => false,
    hasCustomPlan: () => false,
    getActivePlanAmount: () => 0,
    fetchSubscription: vi.fn(),
  }),
}));
vi.mock('@/features/payments/hooks/useStripeCheckout', () => ({
  useStripeCheckout: () => ({
    isCheckoutLoading: false,
    handleSubscribe: vi.fn(),
    handleCustomAmount: vi.fn(),
    handleCancelSubscription: vi.fn(),
    handleManageBilling: vi.fn(),
  }),
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
vi.mock('@/features/file-upload/ui/MediaUpload', () => ({
  MediaUpload: ({ onImageFileUpload }: { onImageFileUpload: (file: File) => Promise<string> }) => (
    <button
      type="button"
      onClick={() =>
        void onImageFileUpload(new File(['avatar'], 'avatar.png', { type: 'image/png' })).catch(
          () => undefined
        )
      }
    >
      upload-avatar
    </button>
  ),
}));
vi.mock('@/features/create/ui/inputs/VisibilityInput', () => ({
  VisibilityInput: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <select
      aria-label="profile-visibility"
      value={value}
      onChange={event => onChange(event.target.value)}
    >
      <option value="public">public</option>
      <option value="private">private</option>
    </select>
  ),
}));
vi.mock('../ui/AboutSection', () => ({ AboutSection: () => null }));
vi.mock('../ui/ContactInformationSection', () => ({ ContactInformationSection: () => null }));
vi.mock('../ui/LocationInformationSection', () => ({ LocationInformationSection: () => null }));
vi.mock('../ui/HashtagsSection', () => ({ HashtagsSection: () => null }));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: profile.toastError, success: vi.fn() },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  profile.updateCompleteProfile.mockResolvedValue({ success: true });
  profile.storageUpload.mockResolvedValue({ error: null });
  profile.updateProfileClientApplied.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('profile settings flow', () => {
  it('edits profile data through the actual settings form and navigates after persistence', async () => {
    renderComponentFlow(<UserEdit userId={user.id} activeTab="basic-info" />);
    const firstName = await screen.findByLabelText(
      'pages.user.settingsForm.basicInfo.firstNameLabel'
    );
    fireEvent.change(firstName, { target: { value: 'Augusta Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'pages.user.settingsTabs.saveProfile' }));

    await waitFor(() => expect(profile.updateCompleteProfile).toHaveBeenCalledTimes(1));
    expect(profile.updateCompleteProfile.mock.calls[0][1]).toMatchObject({
      first_name: 'Augusta Ada',
      visibility: 'public',
    });
    expect(profile.navigate).toHaveBeenCalledWith({ to: '/user/profile-user' });
  });

  it('surfaces an avatar upload failure without mutating the profile', async () => {
    profile.storageUpload.mockResolvedValue({ error: new Error('storage unavailable') });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderComponentFlow(<UserEdit userId={user.id} activeTab="basic-info" />);
    fireEvent.click(await screen.findByRole('button', { name: 'upload-avatar' }));

    await waitFor(() =>
      expect(profile.toastError).toHaveBeenCalledWith(
        'generated.inline.1180_failed_to_upload_avatar_65dabbbc'
      )
    );
    expect(profile.updateProfileClientApplied).not.toHaveBeenCalled();
  });

  it('persists visibility with the other profile fields in one save operation', async () => {
    renderComponentFlow(<UserEdit userId={user.id} activeTab="basic-info" />);
    fireEvent.change(await screen.findByLabelText('profile-visibility'), {
      target: { value: 'private' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'pages.user.settingsTabs.saveProfile' }));

    await waitFor(() => expect(profile.updateCompleteProfile).toHaveBeenCalledTimes(1));
    expect(profile.updateCompleteProfile.mock.calls[0][1]).toMatchObject({ visibility: 'private' });
  });
});
