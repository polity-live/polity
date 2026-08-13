/* @vitest-environment jsdom */

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OnboardingWizard } from '../onboarding/OnboardingWizard';
import { renderComponentFlow } from '@/test/render-component-flow';

const onboarding = vi.hoisted(() => ({
  joinGroup: vi.fn(),
  syncEntityHashtags: vi.fn(),
  updateProfile: vi.fn(),
  user: { id: 'onboarding-user', email: 'onboarding@polity.local' },
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: onboarding.user }),
}));
vi.mock('@/zero/users/useUserActions', () => ({
  useUserActions: () => ({ updateProfileServerConfirmed: onboarding.updateProfile }),
}));
vi.mock('@/zero/groups/useGroupActions', () => ({
  useGroupActions: () => ({ joinGroup: onboarding.joinGroup }),
}));
vi.mock('@/zero/groups/useGroupState', () => ({
  usePublicGroups: () => ({ groups: [], isLoading: false }),
}));
vi.mock('@/zero/common', () => ({
  useCommonActions: () => ({ syncEntityHashtags: onboarding.syncEntityHashtags }),
  useCommonState: () => ({ allHashtags: [], userHashtags: [], onboardingHashtagUsage: [] }),
}));
vi.mock('../onboarding/OnboardingGroupMap', () => ({
  OnboardingGroupMap: () => <div data-testid="onboarding-group-map" />,
}));
vi.mock('@/features/assistant/ui/AriaKaiStep', () => ({
  AriaKaiStep: () => <h2>aria-kai-step</h2>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function renderWizard() {
  return renderComponentFlow(
    <OnboardingWizard
      userId={onboarding.user.id}
      userEmail={onboarding.user.email}
      onComplete={vi.fn()}
    />
  );
}

function persistCheckpoint(step: string, data: Record<string, unknown>) {
  sessionStorage.setItem('polity_onboarding', 'true');
  sessionStorage.setItem('polity_onboarding_step', step);
  sessionStorage.setItem(
    'polity_onboarding_data',
    JSON.stringify({
      firstName: '',
      lastName: '',
      selectedInterestTags: [],
      selectedGroups: [],
      activeGroupId: null,
      membershipRequestSentGroupIds: [],
      ...data,
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
  sessionStorage.clear();
  onboarding.updateProfile.mockResolvedValue(undefined);
  onboarding.syncEntityHashtags.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('onboarding user flow', () => {
  it('skips the optional membership confirmation in the real wizard', () => {
    persistCheckpoint('groupSearch', { firstName: 'Ada', lastName: 'Lovelace' });
    renderWizard();

    fireEvent.click(
      screen.getByRole('button', { name: 'onboarding.groupStep.continueWithoutGroup' })
    );
    expect(screen.getByRole('heading', { name: 'aria-kai-step' })).toBeTruthy();
  });

  it('continues from the real name form only after both fields validate', async () => {
    renderWizard();
    const firstName = screen.getByLabelText('onboarding.nameStep.firstName');
    const lastName = screen.getByLabelText('onboarding.nameStep.lastName');
    const submit = screen.getByRole('button', { name: 'onboarding.nameStep.continue' });

    fireEvent.change(firstName, { target: { value: 'A' } });
    fireEvent.change(lastName, { target: { value: 'B' } });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(firstName, { target: { value: 'Ada' } });
    fireEvent.change(lastName, { target: { value: 'Lovelace' } });
    fireEvent.click(submit);

    await waitFor(() =>
      expect(onboarding.updateProfile).toHaveBeenCalledWith({
        first_name: 'Ada',
        last_name: 'Lovelace',
      })
    );
    expect(
      await screen.findByRole('heading', { name: 'onboarding.interestStep.title' })
    ).toBeTruthy();
  });

  it('restores the persisted wizard step and selected interests after remounting', () => {
    persistCheckpoint('interests', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      selectedInterestTags: ['Climate'],
    });
    const first = renderWizard();

    expect(screen.getByRole('heading', { name: 'onboarding.interestStep.title' })).toBeTruthy();
    expect(screen.getByText('Climate', { exact: true })).toBeTruthy();
    first.unmount();

    renderWizard();
    expect(screen.getByRole('heading', { name: 'onboarding.interestStep.title' })).toBeTruthy();
    expect(screen.getByText('Climate', { exact: true })).toBeTruthy();
  });
});
