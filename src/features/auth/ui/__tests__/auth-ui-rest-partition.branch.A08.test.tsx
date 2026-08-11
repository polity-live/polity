/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/auth/onboarding/OnboardingGroupMap.tsx', () => ({
  OnboardingGroupMap: () => <div data-testid="group-map" />,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string) => (key === 'pages.pricing.tiers.free.period' ? key : `translated:${key}`),
    tArray: () => ['feature', 42],
  }),
}));

import { ForgotPasswordFormView } from '../ForgotPasswordFormView';
import { SignInFormView } from '../SignInFormView';
import { SignUpFormView } from '../SignUpFormView';
import { VerifyFormView } from '../VerifyFormView';
import { GroupSearchStepView } from '../../onboarding/GroupSearchStepView';
import {
  completeInterestSuggestions,
  rankInterestSuggestions,
} from '../../onboarding/interestSuggestions';
import { usePricingPageContainerController } from '@/features/payments/ui/usePricingPageContainerController';

const copy = <T,>() => new Proxy({}, { get: (_target, key) => String(key) }) as T;
const noop = vi.fn();

afterEach(cleanup);

describe('remaining auth form branches', () => {
  it('renders forgot-password without a display error', () => {
    render(
      <ForgotPasswordFormView
        copy={copy<ComponentProps<typeof ForgotPasswordFormView>['copy']>()}
        email="ada@example.test"
        sent={false}
        displayError={null}
        isSubmitting={false}
        onSubmit={noop}
        onEmailChange={noop}
        onBackToSignIn={noop}
      />
    );
    expect(
      document.querySelector('[data-action-id="auth.forgot-password.submit.reset"]')
    ).toBeTruthy();
  });

  it('renders sign-in validation error styling without an API error', () => {
    render(
      <SignInFormView
        copy={copy<ComponentProps<typeof SignInFormView>['copy']>()}
        email="invalid"
        password="password"
        magicLinkSent={false}
        displayError={null}
        isLoading={false}
        isSigningIn={false}
        isRedirecting={false}
        trimmedEmail="invalid"
        emailIsValid={false}
        showEmailError
        showEmailSuccess={false}
        onSubmit={noop}
        onEmailChange={noop}
        onEmailBlur={noop}
        onPasswordChange={noop}
        onMagicLink={noop}
        onGoogleAuth={noop}
        onForgotPassword={noop}
        onGoToSignUp={noop}
      />
    );
    expect(document.querySelector('[aria-invalid="true"]')).toBeTruthy();
  });

  it('renders all sign-up field errors without a display error', () => {
    render(
      <SignUpFormView
        copy={copy<ComponentProps<typeof SignUpFormView>['copy']>()}
        email="invalid"
        password="short"
        confirmPassword="different"
        pendingConfirmationEmail={null}
        displayError={null}
        isLoading={false}
        isSigningUp={false}
        isRedirecting={false}
        isSendingMagicLink={false}
        isFormValid={false}
        magicLinkDisabled
        showEmailError
        showEmailSuccess={false}
        showPasswordError
        showPasswordSuccess={false}
        showConfirmPasswordError
        showConfirmPasswordSuccess={false}
        onSubmit={noop}
        onEmailChange={noop}
        onEmailBlur={noop}
        onPasswordChange={noop}
        onPasswordBlur={noop}
        onConfirmPasswordChange={noop}
        onConfirmPasswordBlur={noop}
        onGoogleAuth={noop}
        onMagicLink={noop}
        onGoToSignIn={noop}
        onUseDifferentEmail={noop}
      />
    );
    expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(3);
  });

  it('renders verification without an error notice', () => {
    render(
      <VerifyFormView
        copy={copy<ComponentProps<typeof VerifyFormView>['copy']>()}
        email="ada@example.test"
        code={['', '', '', '', '', '']}
        displayError={null}
        isVerifying={false}
        isResending={false}
        setInputRef={noop}
        onCodeChange={noop}
        onCodeKeyDown={noop}
        onCodePaste={noop}
        onVerify={noop}
        onResendCode={noop}
        onBackToEmail={noop}
      />
    );
    expect(document.querySelector('[data-action-id="auth.verify.submit.code"]')).toBeTruthy();
  });
});

describe('remaining onboarding and pricing branches', () => {
  const groupProps = {
    selectedGroups: [],
    selectedGroupIds: new Set<string>(),
    activeGroupId: null,
    activeGroup: null,
    hasSelectedGroups: false,
    mappableGroups: [],
    unmappableGroupCount: 0,
    onClearSelectedGroups: noop,
    onNext: noop,
    onBack: noop,
    t: (key: string) => key,
    searchTerm: '',
    setSearchTerm: noop,
    filteredGroups: [],
    handleSelectGroup: noop,
    handleActivateGroup: noop,
    handleSkip: noop,
  };

  it('renders both loading and empty group-result states', () => {
    const view = render(<GroupSearchStepView {...groupProps} groupsLoading />);
    expect(view.container.querySelector('.animate-spin')).toBeTruthy();
    view.rerender(<GroupSearchStepView {...groupProps} groupsLoading={false} />);
    expect(view.container.textContent).toContain('onboarding.groupStep.noResults');

    const selectedGroup = { id: 'group', name: 'Selected Group', member_count: 1 } as never;
    view.rerender(
      <GroupSearchStepView
        {...groupProps}
        selectedGroups={[selectedGroup]}
        selectedGroupIds={new Set(['group'])}
        hasSelectedGroups
        groupsLoading={false}
      />
    );
    fireEvent.change(screen.getByPlaceholderText('onboarding.groupStep.searchPlaceholder'), {
      target: { value: 'civic' },
    });
    fireEvent.click(
      view.container.querySelector('[data-action-id="auth.onboarding.group-search.map.activate"]')!
    );
    expect(groupProps.setSearchTerm).toHaveBeenCalledWith('civic');
    expect(groupProps.handleActivateGroup).toHaveBeenCalledWith('group');
  });

  it('skips empty tags before and after normalization', () => {
    expect(rankInterestSuggestions([{ tag: null }, { tag: '  #  ' }, { tag: '#Civic' }])).toEqual([
      'Civic',
    ]);
    expect(completeInterestSuggestions(['', '#', 'Civic'], ['civic', 'Other'])).toEqual([
      'Civic',
      'Other',
    ]);
  });

  it('resolves optional pricing translations and filters non-string features', () => {
    const { result } = renderHook(() => usePricingPageContainerController());
    expect(result.current.tiers).toHaveLength(4);
    expect(result.current.tiers.some(tier => tier.highlighted)).toBe(true);
    expect(result.current.tiers.some(tier => tier.acceptsCustomAmount)).toBe(true);
    act(() => result.current.setCustomAmount('12'));
    expect(result.current.customAmount).toBe('12');
  });
});
