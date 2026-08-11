/* @vitest-environment jsdom */

import { useState } from 'react';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useOnboarding } from '../hooks/useOnboarding';
import { useHomePageController } from '@/features/public-landing/hooks/useHomePageController';
import { renderComponentFlow } from '@/test/render-component-flow';

const onboarding = vi.hoisted(() => ({
  currentUser: null as null | { first_name?: string | null },
  joinGroup: vi.fn(),
  refreshAuthState: vi.fn(),
  signOut: vi.fn(),
  syncEntityHashtags: vi.fn(),
  updateProfile: vi.fn(),
  user: { id: 'onboarding-user', email: 'onboarding@polity.local' },
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: onboarding.user,
    refreshAuthState: onboarding.refreshAuthState,
    signOut: onboarding.signOut,
  }),
}));
vi.mock('@/providers/zero-ready-context', () => ({ useZeroReady: () => true }));
vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({ currentUser: onboarding.currentUser }),
}));
vi.mock('@/zero/users/useUserActions', () => ({
  useUserActions: () => ({ updateProfileClientApplied: onboarding.updateProfile }),
}));
vi.mock('@/zero/groups/useGroupActions', () => ({
  useGroupActions: () => ({ joinGroup: onboarding.joinGroup }),
}));
vi.mock('@/zero/common', () => ({
  useCommonActions: () => ({ syncEntityHashtags: onboarding.syncEntityHashtags }),
  useCommonState: () => ({ allHashtags: [], userHashtags: [], onboardingHashtagUsage: [] }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function OnboardingFlow() {
  const flow = useOnboarding();
  const [validated, setValidated] = useState(false);
  return (
    <section>
      <output aria-label="step">{flow.step}</output>
      <input
        aria-label="first-name"
        value={flow.data.firstName}
        onChange={event => flow.setFirstName(event.target.value)}
      />
      <input
        aria-label="last-name"
        value={flow.data.lastName}
        onChange={event => flow.setLastName(event.target.value)}
      />
      <button
        type="button"
        onClick={async () => {
          const valid = await flow.submitName();
          setValidated(valid);
          if (valid) flow.nextStep();
        }}
      >
        validate-name
      </button>
      <button type="button" onClick={() => flow.goToStep('groupSearch')}>
        open-groups
      </button>
      <button type="button" onClick={flow.nextStep}>
        continue
      </button>
      <output aria-label="validation">{validated ? 'valid' : (flow.error ?? 'idle')}</output>
    </section>
  );
}

function ResumeProbe() {
  const state = useHomePageController();
  return <output aria-label="home-state">{state.kind}</output>;
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  onboarding.currentUser = null;
  onboarding.updateProfile.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('onboarding user flow', () => {
  it('skips the optional membership confirmation when no group was selected', () => {
    renderComponentFlow(<OnboardingFlow />);
    fireEvent.click(screen.getByRole('button', { name: 'open-groups' }));
    fireEvent.click(screen.getByRole('button', { name: 'continue' }));
    expect(screen.getByLabelText('step').textContent).toBe('ariaKai');
  });

  it('continues only after the name step validates both fields', async () => {
    renderComponentFlow(<OnboardingFlow />);
    fireEvent.change(screen.getByLabelText('first-name'), { target: { value: 'A' } });
    fireEvent.change(screen.getByLabelText('last-name'), { target: { value: 'B' } });
    fireEvent.click(screen.getByRole('button', { name: 'validate-name' }));
    await screen.findByText('features.auth.errors.nameTooShort');
    expect(screen.getByLabelText('step').textContent).toBe('name');

    fireEvent.change(screen.getByLabelText('first-name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('last-name'), { target: { value: 'Lovelace' } });
    fireEvent.click(screen.getByRole('button', { name: 'validate-name' }));
    await waitFor(() => expect(screen.getByLabelText('step').textContent).toBe('interests'));
    expect(screen.getByLabelText('validation').textContent).toBe('valid');
  });

  it('resumes onboarding from the persisted session marker after remounting', () => {
    sessionStorage.setItem('polity_onboarding', 'true');
    const first = renderComponentFlow(<ResumeProbe />);
    expect(screen.getByLabelText('home-state').textContent).toBe('onboarding');
    first.unmount();

    renderComponentFlow(<ResumeProbe />);
    expect(screen.getByLabelText('home-state').textContent).toBe('onboarding');
  });
});
