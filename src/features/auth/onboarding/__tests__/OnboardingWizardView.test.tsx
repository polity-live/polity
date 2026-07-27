/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../NameStep.tsx', () => ({
  NameStep: () => <div>Name step</div>,
}));

vi.mock('@/features/shared/ui/navigation', () => ({
  SectionProgressTopBar: ({
    items,
    onItemSelect,
  }: {
    items: { id: string; label: string; disabled?: boolean }[];
    onItemSelect?: (id: string) => void;
  }) => (
    <div data-testid="mobile-progress">
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          disabled={item.disabled}
          onClick={() => onItemSelect?.(item.id)}
        >
          Mobile {item.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../InterestStep.tsx', () => ({
  InterestStep: () => <div>Interest step</div>,
}));

vi.mock('../GroupSearchStep.tsx', () => ({
  GroupSearchStep: () => <div>Group step</div>,
}));

vi.mock('../MembershipConfirmStep.tsx', () => ({
  MembershipConfirmStep: () => <div>Request step</div>,
}));

vi.mock('@/features/assistant/ui/AriaKaiStep.tsx', () => ({
  AriaKaiStep: () => <div>Assistant step</div>,
}));

vi.mock('../AppInstallStep.tsx', () => ({
  AppInstallStep: () => <div>Install step</div>,
}));

vi.mock('../SummaryStep.tsx', () => ({
  SummaryStep: () => <div>Summary step</div>,
}));

import { OnboardingWizardView, type OnboardingWizardViewProps } from '../OnboardingWizardView';

afterEach(cleanup);

function buildProps(): OnboardingWizardViewProps {
  return {
    userId: 'user-1',
    userEmail: 'ada@example.com',
    onComplete: vi.fn(),
    t: (key: string) => key,
    step: 'name',
    error: null,
    data: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      selectedInterestTags: [],
      selectedGroups: [],
      activeGroupId: null,
      membershipRequestSentGroupIds: [],
    },
    isLoading: false,
    setFirstName: vi.fn(),
    setLastName: vi.fn(),
    setSelectedInterestTags: vi.fn(),
    toggleInterestTag: vi.fn(),
    clearInterestTags: vi.fn(),
    toggleSelectedGroup: vi.fn(),
    setActiveGroupId: vi.fn(),
    clearSelectedGroups: vi.fn(),
    nextStep: vi.fn(),
    previousStep: vi.fn(),
    goToStep: vi.fn(),
    saveInterests: vi.fn(),
    sendMembershipRequests: vi.fn(),
    skipMembership: vi.fn(),
    completeOnboarding: vi.fn(),
    allInterestSuggestions: [],
    handleNameNext: vi.fn(),
    handleInterestsNext: vi.fn(),
    handleGroupNext: vi.fn(),
    handleMembershipConfirm: vi.fn(),
    handleMembershipDecline: vi.fn(),
    handleAriaKaiNext: vi.fn(),
    handleAppInstallNext: vi.fn(),
    swipeNavigationHandlers: {
      onKeyDown: vi.fn(),
      onTouchStart: vi.fn(),
      onTouchMove: vi.fn(),
      onTouchEnd: vi.fn(),
      onTouchCancel: vi.fn(),
      onPointerDown: vi.fn(),
      onPointerMove: vi.fn(),
      onPointerUp: vi.fn(),
      onPointerCancel: vi.fn(),
    },
  };
}

describe('OnboardingWizardView desktop sidebar', () => {
  it('uses a non-scrolling, height-adaptive desktop layout', () => {
    const { container } = render(<OnboardingWizardView {...buildProps()} />);

    const sidebar = container.querySelector('[data-slot="onboarding-desktop-sidebar"]');
    const subtitle = container.querySelector('[data-slot="onboarding-sidebar-subtitle"]');
    const compactReason = container.querySelector(
      '[data-slot="onboarding-sidebar-compact-reason"]'
    );
    const descriptions = container.querySelectorAll(
      '[data-slot="onboarding-sidebar-step-description"]'
    );
    const stepRows = container.querySelectorAll('[data-slot="onboarding-sidebar-step-row"]');
    const context = container.querySelector('[data-slot="onboarding-sidebar-context"]');

    expect(sidebar?.className).toContain('overflow-hidden');
    expect(sidebar?.className).not.toContain('overflow-y-auto');
    expect(subtitle?.className).toContain('[@media(max-height:900px)]:hidden');
    expect(compactReason?.textContent).toBe('onboarding.shell.compactReason');
    expect(compactReason?.className).toContain('[@media(max-height:900px)]:block');
    expect(descriptions).toHaveLength(7);
    descriptions.forEach(description => {
      expect(description.className).toContain('[@media(max-height:900px)]:hidden');
    });
    expect(stepRows).toHaveLength(7);
    stepRows.forEach(stepRow => {
      expect(stepRow.className).toContain('[@media(max-height:900px)]:items-center');
    });
    expect(context?.className).toContain('[@media(min-height:1301px)]:lg:block');
  });

  it('navigates to completed steps from desktop and mobile progress controls', () => {
    const props = buildProps();
    props.step = 'appInstall';

    render(<OnboardingWizardView {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'onboarding.shell.steps.interests.label' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Mobile onboarding.shell.steps.groupSearch.label',
      })
    );

    expect(props.goToStep).toHaveBeenNthCalledWith(1, 'interests');
    expect(props.goToStep).toHaveBeenNthCalledWith(2, 'groupSearch');
  });

  it('disables active, future, skipped, and loading step controls', () => {
    const props = buildProps();
    props.step = 'ariaKai';

    const { rerender } = render(<OnboardingWizardView {...props} />);

    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'onboarding.shell.steps.confirm.label',
      }).disabled
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Mobile onboarding.shell.steps.confirm.label',
      }).disabled
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'onboarding.shell.steps.ariaKai.label',
      }).disabled
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'onboarding.shell.steps.appInstall.label',
      }).disabled
    ).toBe(true);

    rerender(<OnboardingWizardView {...props} isLoading />);

    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'onboarding.shell.steps.name.label',
      }).disabled
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Mobile onboarding.shell.steps.name.label',
      }).disabled
    ).toBe(true);
  });
});
