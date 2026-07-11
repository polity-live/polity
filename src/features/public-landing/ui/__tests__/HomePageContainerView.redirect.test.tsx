/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HomePageContainerView } from '../HomePageContainerView';

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(() => new Promise<void>(() => undefined)),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => routerMocks.navigate,
}));

vi.mock('@/features/auth/onboarding/OnboardingWizard', () => ({
  OnboardingWizard: () => null,
}));

vi.mock('@/features/public-landing/ui/PublicLandingPage', () => ({
  PublicLandingPage: () => null,
}));

afterEach(() => {
  cleanup();
  routerMocks.navigate.mockClear();
});

describe('HomePageContainerView redirect state', () => {
  it('starts the home navigation only once while the redirect remains mounted', () => {
    const viewState = { kind: 'redirect' };
    const { rerender } = render(<HomePageContainerView viewState={viewState} />);

    for (let index = 0; index < 100; index += 1) {
      rerender(<HomePageContainerView viewState={{ kind: 'redirect' }} />);
    }

    expect(routerMocks.navigate).toHaveBeenCalledOnce();
    expect(routerMocks.navigate).toHaveBeenCalledWith({ to: '/home', replace: true });
  });
});
