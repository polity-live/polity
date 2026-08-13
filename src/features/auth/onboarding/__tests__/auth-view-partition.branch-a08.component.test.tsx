/* @vitest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Navigate: ({ to, search }: any) => (
    <div data-testid="navigate">
      {to}:{search.reason}
    </div>
  ),
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  AppBootLoadingState: () => <div>boot-loading</div>,
  PageSkeleton: () => <div>page-loading</div>,
  NotFound: () => <div>not-found</div>,
  SectionSkeleton: (props: any) => <div data-testid="section-loading" {...props} />,
}));
vi.mock('@/features/auth/ui/AccessDenied', () => ({
  AccessDenied: () => <div>access-denied</div>,
}));
vi.mock('@/features/create/ui/CreateRecoveryState', () => ({
  CreateRecoveryState: ({ draft }: any) => <div>recovery:{draft.id}</div>,
}));
vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count?: number }) =>
      `${key}${values?.count === undefined ? '' : `:${values.count}`}`,
  }),
}));
vi.mock('@/features/shared/theme', () => ({ featureThemeClassName: (key: string) => key }));
vi.mock('@/features/shared/utils/utils.ts', () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(' '),
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({
    children,
    textTransform: _textTransform,
    tone: _tone,
    size: _size,
    variant: _variant,
    ...props
  }: any) => <span {...props}>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/button.tsx', () => ({
  Button: ({ asChild, children, size: _size, variant: _variant, ...props }: any) =>
    asChild && React.isValidElement(children) ? (
      React.cloneElement(children as React.ReactElement<any>, props)
    ) : (
      <button {...props}>{children}</button>
    ),
}));
vi.mock('@/features/shared/ui/ui/card.tsx', () => ({
  Card: ({ children, surface: _surface, ...props }: any) => (
    <section {...props}>{children}</section>
  ),
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  CardHeader: ({ children, ...props }: any) => <header {...props}>{children}</header>,
  CardTitle: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
}));
vi.mock('@/features/shared/ui/form', () => ({
  FormControlLabel: ({ children, ...props }: any) => <label {...props}>{children}</label>,
  FormControlInput: (props: any) => <input {...props} />,
}));
vi.mock('../OnboardingStepShell', () => ({
  OnboardingStepShell: ({ actions, children }: any) => (
    <div>
      <div data-testid="actions">{actions}</div>
      {children}
    </div>
  ),
}));
vi.mock('@/features/shared/ui/navigation', () => ({
  SectionProgressTopBar: ({ items, onItemSelect }: any) => (
    <nav>
      <button onClick={() => onItemSelect('invalid')}>invalid-step</button>
      {items.map((item: any) => (
        <button
          key={item.id}
          data-testid={`mobile-${item.id}`}
          onClick={() => onItemSelect(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  ),
}));
vi.mock('@/features/shared/ui/ui/progress.tsx', () => ({
  Progress: ({ value }: any) => <div>progress:{value}</div>,
}));

vi.mock('../NameStep.tsx', () => ({ NameStep: () => <div data-testid="NameStep" /> }));
vi.mock('../GroupSearchStep.tsx', () => ({
  GroupSearchStep: () => <div data-testid="GroupSearchStep" />,
}));
vi.mock('../InterestStep.tsx', () => ({ InterestStep: () => <div data-testid="InterestStep" /> }));
vi.mock('../AppInstallStep.tsx', () => ({
  AppInstallStep: () => <div data-testid="AppInstallStep" />,
}));
vi.mock('@/features/assistant/ui/AriaKaiStep.tsx', () => ({
  AriaKaiStep: () => <div data-testid="AriaKaiStep" />,
}));

import { AuthGuardView } from '../../AuthGuardView';
import { EntityVisibilityGuardView } from '../../EntityVisibilityGuardView';
import { PermissionGuardView } from '../../PermissionGuardView';
import { MembershipConfirmStep } from '../MembershipConfirmStep';
import { NameStepView } from '../NameStepView';
import { OnboardingWizardView } from '../OnboardingWizardView';
import { SummaryStep } from '../SummaryStep';

afterEach(cleanup);

describe('guard views', () => {
  it('renders every auth, permission and entity state', () => {
    const view = render(
      <AuthGuardView isReady={false} isAllowed={false}>
        allowed
      </AuthGuardView>
    );
    expect(screen.getByText('boot-loading')).toBeTruthy();
    view.rerender(
      <AuthGuardView isReady isAllowed={false} fallback={<span>fallback</span>}>
        allowed
      </AuthGuardView>
    );
    expect(screen.getByText('fallback')).toBeTruthy();
    view.rerender(
      <AuthGuardView isReady isAllowed={false}>
        allowed
      </AuthGuardView>
    );
    expect(view.container.textContent).toBe('');
    view.rerender(
      <AuthGuardView isReady isAllowed>
        allowed
      </AuthGuardView>
    );
    expect(screen.getByText('allowed')).toBeTruthy();

    const can = vi.fn().mockReturnValue(false);
    view.rerender(
      <PermissionGuardView
        action="read"
        resource="group"
        context={null}
        fallback="denied"
        loadingComponent="custom-loading"
        can={can}
        isLoading
      >
        unused
      </PermissionGuardView>
    );
    expect(screen.getByText('custom-loading')).toBeTruthy();
    view.rerender(
      <PermissionGuardView
        action="read"
        resource="group"
        context={null}
        fallback="denied"
        loadingComponent={null}
        can={can}
        isLoading
      >
        unused
      </PermissionGuardView>
    );
    expect(screen.getByTestId('section-loading')).toBeTruthy();
    view.rerender(
      <PermissionGuardView
        action="read"
        resource="group"
        context={null}
        fallback="denied"
        loadingComponent={null}
        can={can}
        isLoading={false}
      >
        permitted
      </PermissionGuardView>
    );
    expect(screen.getByText('denied')).toBeTruthy();
    can.mockReturnValue(true);
    view.rerender(
      <PermissionGuardView
        action="read"
        resource="group"
        context={null}
        fallback="denied"
        loadingComponent={null}
        can={can}
        isLoading={false}
      >
        permitted
      </PermissionGuardView>
    );
    expect(screen.getByText('permitted')).toBeTruthy();
  });

  it.each([
    [{ state: 'loading' }, 'page-loading'],
    [{ state: 'error' }, 'access-denied'],
    [{ state: 'not-found' }, 'not-found'],
    [{ state: 'recovery', draft: { id: 'draft' } }, 'recovery:draft'],
    [{ state: 'unauthorized', reason: 'private' }, '/unauthorized:private'],
    [{ state: 'allowed' }, 'entity-content'],
  ] as const)('renders entity guard %o', (guard, expected) => {
    render(
      <EntityVisibilityGuardView guard={guard as never}>entity-content</EntityVisibilityGuardView>
    );
    expect(screen.getByText(expected)).toBeTruthy();
  });
});

const group = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Group ${id}`,
  member_count: 3,
  ...extra,
});

describe('onboarding step views', () => {
  it('covers name preview fallbacks, validation states and input actions', () => {
    const actions = {
      first: vi.fn(),
      last: vi.fn(),
      firstBlur: vi.fn(),
      lastBlur: vi.fn(),
      submit: vi.fn(),
    };
    const labels = {
      continue: 'Continue',
      description: 'Description',
      firstName: 'First',
      firstNamePlaceholder: 'First placeholder',
      lastName: 'Last',
      lastNamePlaceholder: 'Last placeholder',
      title: 'Title',
    };
    const view = render(
      <NameStepView
        firstName=""
        lastName=""
        isLoading
        firstNameRequirementText="first help"
        firstNameShowError
        firstNameShowSuccess={false}
        isFormValid={false}
        labels={labels}
        lastNameRequirementText="last help"
        lastNameShowError={false}
        lastNameShowSuccess
        onFirstNameBlur={actions.firstBlur}
        onFirstNameInputChange={actions.first}
        onLastNameBlur={actions.lastBlur}
        onLastNameInputChange={actions.last}
        onSubmit={actions.submit}
      />
    );
    expect(screen.getByText('First Last')).toBeTruthy();
    expect(screen.getByText('P')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('First'), { target: { value: 'Ada' } });
    fireEvent.blur(screen.getByLabelText('First'));
    fireEvent.change(screen.getByLabelText('Last'), { target: { value: 'Lovelace' } });
    fireEvent.blur(screen.getByLabelText('Last'));
    fireEvent.submit(view.container.querySelector('form')!);
    expect(actions.first).toHaveBeenCalledWith('Ada');
    expect(actions.submit).toHaveBeenCalled();

    view.rerender(
      <NameStepView
        firstName=" Ada "
        lastName=" Lovelace "
        firstNameRequirementText="first help"
        firstNameShowError={false}
        firstNameShowSuccess
        isFormValid
        labels={labels}
        lastNameRequirementText="last help"
        lastNameShowError
        lastNameShowSuccess={false}
        onFirstNameBlur={actions.firstBlur}
        onFirstNameInputChange={actions.first}
        onLastNameBlur={actions.lastBlur}
        onLastNameInputChange={actions.last}
        onSubmit={actions.submit}
      />
    );
    expect(screen.getByText('AL')).toBeTruthy();
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
  });

  it('covers membership pending, requested, batch, loading and no-selection actions', async () => {
    const actions = {
      confirm: vi.fn().mockResolvedValue(undefined),
      decline: vi.fn(),
      back: vi.fn(),
    };
    const view = render(
      <MembershipConfirmStep
        groups={[group('one') as never]}
        requestedGroupIds={[]}
        onConfirm={actions.confirm}
        onDecline={actions.decline}
        onBack={actions.back}
      />
    );
    fireEvent.click(
      screen
        .getByTestId('actions')
        .querySelector('[data-action-id="auth.onboarding.membership.confirm"]')!
    );
    fireEvent.click(
      screen
        .getByTestId('actions')
        .querySelector('[data-action-id="auth.onboarding.membership.decline"]')!
    );
    fireEvent.click(
      screen
        .getByTestId('actions')
        .querySelector('[data-action-id="auth.onboarding.membership.back"]')!
    );
    expect(actions.confirm).toHaveBeenCalled();

    view.rerender(
      <MembershipConfirmStep
        groups={[
          group('one', { description: 'Description', location: 'Berlin' }) as never,
          group('two') as never,
        ]}
        requestedGroupIds={['one']}
        onConfirm={actions.confirm}
        onDecline={actions.decline}
        onBack={actions.back}
        isLoading
      />
    );
    expect(screen.getByText('onboarding.confirmStep.titleMultiple')).toBeTruthy();
    expect(screen.getByText('onboarding.confirmStep.requestSending')).toBeTruthy();
    expect(screen.getByText('Description')).toBeTruthy();
    expect(screen.getByText('Berlin')).toBeTruthy();

    view.rerender(
      <MembershipConfirmStep
        groups={[group('one') as never, group('two') as never]}
        requestedGroupIds={[]}
        onConfirm={actions.confirm}
        onDecline={actions.decline}
        onBack={actions.back}
      />
    );
    expect(screen.getByText('onboarding.confirmStep.yesMultiple:2')).toBeTruthy();

    view.rerender(
      <MembershipConfirmStep
        groups={[group('one') as never]}
        requestedGroupIds={['one']}
        onConfirm={actions.confirm}
        onDecline={actions.decline}
        onBack={actions.back}
      />
    );
    fireEvent.click(
      screen
        .getByTestId('actions')
        .querySelector('[data-action-id="auth.onboarding.membership.continue-without-selection"]')!
    );
    expect(actions.decline).toHaveBeenCalledTimes(2);
  });

  it('covers summary cardinalities, destinations and modifier clicks', () => {
    const complete = vi.fn();
    const base = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      selectedGroups: [] as any[],
      selectedInterestTags: [] as string[],
      activeGroupId: null,
      membershipRequestSentGroupIds: [] as string[],
      userId: 'user',
      onComplete: complete,
    };
    const view = render(<SummaryStep {...base} />);
    expect(screen.getByText('onboarding.summaryStep.noGroup')).toBeTruthy();
    const links = screen.getAllByRole('link');
    links.forEach(link => link.addEventListener('click', event => event.preventDefault()));
    fireEvent.click(links[0]);
    fireEvent.click(links[1], { button: 1 });
    fireEvent.click(links[1], { metaKey: true });
    fireEvent.click(links[1], { ctrlKey: true });
    fireEvent.click(links[1], { shiftKey: true });
    fireEvent.click(links[1], { altKey: true });
    expect(complete).toHaveBeenCalledTimes(1);

    view.rerender(
      <SummaryStep
        {...base}
        selectedGroups={[group('one') as never]}
        activeGroupId="missing"
        membershipRequestSentGroupIds={['one']}
        selectedInterestTags={['civic']}
      />
    );
    expect(screen.getByText('onboarding.summaryStep.groupSelected')).toBeTruthy();
    expect(screen.getByText('onboarding.summaryStep.membershipRequested')).toBeTruthy();
    expect(screen.getByText('#civic')).toBeTruthy();

    view.rerender(
      <SummaryStep
        {...base}
        selectedGroups={[group('one') as never, group('two') as never]}
        activeGroupId="two"
        membershipRequestSentGroupIds={['one', 'two']}
        isLoading
      />
    );
    expect(screen.getByText('onboarding.summaryStep.groupsSelected')).toBeTruthy();
    expect(screen.getByText('onboarding.summaryStep.membershipRequestsSent')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('link')[0]);
    expect(complete).toHaveBeenCalledTimes(1);
  });
});

describe('OnboardingWizardView', () => {
  const handlers = {
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
    handleNameNext: vi.fn(),
    handleInterestsNext: vi.fn(),
    handleGroupNext: vi.fn(),
    handleMembershipConfirm: vi.fn(),
    handleMembershipDecline: vi.fn(),
    handleAriaKaiNext: vi.fn(),
    handleAppInstallNext: vi.fn(),
    onComplete: vi.fn(),
  };
  const base = {
    userId: 'user',
    userEmail: 'a@b.test',
    t: (key: string) => key,
    error: null,
    isLoading: false,
    data: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      selectedInterestTags: [],
      selectedGroups: [] as any[],
      activeGroupId: null,
      membershipRequestSentGroupIds: [],
    },
    allInterestSuggestions: [],
    swipeNavigationHandlers: {},
    ...handlers,
  };

  it('renders every step and enforces completed/skipped/loading navigation', () => {
    const view = render(<OnboardingWizardView {...(base as any)} step="name" />);
    expect(screen.getByTestId('NameStep')).toBeTruthy();
    fireEvent.click(screen.getByText('invalid-step'));
    expect(handlers.goToStep).not.toHaveBeenCalled();

    for (const [step, testId] of [
      ['interests', 'InterestStep'],
      ['groupSearch', 'GroupSearchStep'],
      ['ariaKai', 'AriaKaiStep'],
      ['appInstall', 'AppInstallStep'],
    ] as const) {
      view.rerender(
        <OnboardingWizardView
          {...(base as any)}
          step={step}
          error={step === 'interests' ? 'error-message' : null}
        />
      );
      expect(screen.getByTestId(testId)).toBeTruthy();
    }

    view.rerender(<OnboardingWizardView {...(base as any)} step="summary" />);
    expect(screen.getByText('onboarding.summaryStep.title')).toBeTruthy();

    view.rerender(
      <OnboardingWizardView
        {...(base as any)}
        step="confirm"
        data={{ ...base.data, selectedGroups: [group('one')] }}
      />
    );
    expect(screen.getByText('Group one')).toBeTruthy();

    view.rerender(
      <OnboardingWizardView
        {...(base as any)}
        step="summary"
        data={{ ...base.data, selectedGroups: [group('one')] }}
      />
    );
    fireEvent.click(screen.getByTestId('mobile-name'));
    expect(handlers.goToStep).toHaveBeenCalledWith('name');
    fireEvent.click(screen.getByLabelText('onboarding.shell.steps.name.label'));
    expect(handlers.goToStep).toHaveBeenCalledTimes(2);
    view.rerender(<OnboardingWizardView {...(base as any)} step="summary" isLoading />);
    fireEvent.click(screen.getByTestId('mobile-name'));
    expect(handlers.goToStep).toHaveBeenCalledTimes(2);
  });
});
