/* @vitest-environment jsdom */

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLanguageStore } from '@/features/shared/global-state/language.store';
import { HomePageContainerView } from '../HomePageContainerView';

vi.mock('@/features/auth/onboarding/OnboardingWizard', () => ({
  OnboardingWizard: () => <div data-testid="onboarding-wizard" />,
}));

vi.mock('@/features/public-landing/ui/PublicLandingPage', () => ({
  PublicLandingPage: () => <div data-testid="public-landing-page" />,
}));

describe('HomePageContainerView loading state', () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: 'en' });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders app boot loading instead of a blank page', () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    const onSignOut = vi.fn();

    render(<HomePageContainerView viewState={{ kind: 'loading', onRetry, onSignOut }} />);

    expect(screen.getByText('Setting up your workspace...')).toBeTruthy();
    expect(document.querySelector('[data-slot="app-boot-loading"]')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  });
});
