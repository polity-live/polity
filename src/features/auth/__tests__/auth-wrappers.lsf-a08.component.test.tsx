/* @vitest-environment jsdom */

import { cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ensureController: vi.fn(() => ({ ready: true })),
  ensureView: vi.fn(() => null),
  groupController: vi.fn((props: unknown) => ({ controller: 'group', props })),
  groupView: vi.fn(() => null),
  nameController: vi.fn(() => ({ controller: 'name' })),
  nameView: vi.fn(() => null),
  onboardingController: vi.fn((props: unknown) => ({ controller: 'onboarding', props })),
  onboardingView: vi.fn(() => null),
  callbackController: vi.fn(),
  callbackView: vi.fn(() => null),
  forgotController: vi.fn(() => ({ controller: 'forgot' })),
  forgotView: vi.fn(() => null),
  resetController: vi.fn(() => ({ controller: 'reset' })),
  resetView: vi.fn(() => null),
  signInController: vi.fn(() => ({ controller: 'sign-in' })),
  signInView: vi.fn(() => null),
  signUpController: vi.fn(() => ({ controller: 'sign-up' })),
  signUpView: vi.fn(() => null),
  verifyController: vi.fn(() => ({ controller: 'verify' })),
  verifyView: vi.fn(() => null),
  permissions: vi.fn(() => ({ can: vi.fn(), isLoading: false })),
}));

vi.mock('../hooks/useEnsureUserController', () => ({
  useEnsureUserController: mocks.ensureController,
}));
vi.mock('../EnsureUserView', () => ({ EnsureUserView: mocks.ensureView }));
vi.mock('../onboarding/useGroupSearchStepController', () => ({
  useGroupSearchStepController: mocks.groupController,
}));
vi.mock('../onboarding/GroupSearchStepView', () => ({ GroupSearchStepView: mocks.groupView }));
vi.mock('../hooks/useNameStepController', () => ({
  useNameStepController: mocks.nameController,
}));
vi.mock('../onboarding/NameStepView', () => ({ NameStepView: mocks.nameView }));
vi.mock('../onboarding/useOnboardingWizardController', () => ({
  useOnboardingWizardController: mocks.onboardingController,
}));
vi.mock('../onboarding/OnboardingWizardView', () => ({
  OnboardingWizardView: mocks.onboardingView,
}));
vi.mock('../hooks/useAuthCallbackPageController', () => ({
  useAuthCallbackPageController: mocks.callbackController,
}));
vi.mock('../ui/AuthCallbackPageView', () => ({ AuthCallbackPageView: mocks.callbackView }));
vi.mock('../hooks/useForgotPasswordFormController', () => ({
  useForgotPasswordFormController: mocks.forgotController,
}));
vi.mock('../ui/ForgotPasswordFormView', () => ({ ForgotPasswordFormView: mocks.forgotView }));
vi.mock('../hooks/useResetPasswordFormController', () => ({
  useResetPasswordFormController: mocks.resetController,
}));
vi.mock('../ui/ResetPasswordFormView', () => ({ ResetPasswordFormView: mocks.resetView }));
vi.mock('../hooks/useSignInFormController', () => ({
  useSignInFormController: mocks.signInController,
}));
vi.mock('../ui/SignInFormView', () => ({ SignInFormView: mocks.signInView }));
vi.mock('../hooks/useSignUpFormController', () => ({
  useSignUpFormController: mocks.signUpController,
}));
vi.mock('../ui/SignUpFormView', () => ({ SignUpFormView: mocks.signUpView }));
vi.mock('../hooks/useVerifyFormController', () => ({
  useVerifyFormController: mocks.verifyController,
}));
vi.mock('../ui/VerifyFormView', () => ({ VerifyFormView: mocks.verifyView }));
vi.mock('@/zero/rbac/usePermissions', () => ({ usePermissions: mocks.permissions }));

import { EnsureUser } from '../EnsureUser';
import { GroupSearchStep } from '../onboarding/GroupSearchStep';
import { NameStep } from '../onboarding/NameStep';
import { OnboardingWizard } from '../onboarding/OnboardingWizard';
import { AuthCallbackPage } from '../ui/AuthCallbackPage';
import { ForgotPasswordForm } from '../ui/ForgotPasswordForm';
import { ResetPasswordForm } from '../ui/ResetPasswordForm';
import { SignInForm } from '../ui/SignInForm';
import { SignUpForm } from '../ui/SignUpForm';
import { VerifyForm } from '../ui/VerifyForm';
import { usePermissionGuardController } from '../usePermissionGuardController';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('auth LSF wrapper contracts', () => {
  it('connects auth and onboarding controllers to every view', () => {
    render(
      <>
        <EnsureUser>child</EnsureUser>
        <GroupSearchStep
          selectedGroups={[]}
          interestTags={[]}
          activeGroupId={null}
          onToggleGroup={vi.fn()}
          onActiveGroupChange={vi.fn()}
          onClearSelectedGroups={vi.fn()}
          onNext={vi.fn()}
          onBack={vi.fn()}
        />
        <NameStep
          firstName="Ada"
          lastName="Lovelace"
          onFirstNameChange={vi.fn()}
          onLastNameChange={vi.fn()}
          onNext={vi.fn()}
        />
        <OnboardingWizard userId="user-1" userEmail="ada@example.test" onComplete={vi.fn()} />
        <AuthCallbackPage />
        <ForgotPasswordForm />
        <ResetPasswordForm />
        <SignInForm />
        <SignUpForm />
        <VerifyForm />
      </>
    );

    expect(mocks.ensureView).toHaveBeenCalledOnce();
    expect(mocks.groupView).toHaveBeenCalledOnce();
    expect(mocks.nameView).toHaveBeenCalledOnce();
    expect(mocks.onboardingView).toHaveBeenCalledOnce();
    expect(mocks.callbackController).toHaveBeenCalledOnce();
    expect(mocks.forgotView).toHaveBeenCalledOnce();
    expect(mocks.resetView).toHaveBeenCalledOnce();
    expect(mocks.signInView).toHaveBeenCalledOnce();
    expect(mocks.signUpView).toHaveBeenCalledOnce();
    expect(mocks.verifyView).toHaveBeenCalledOnce();
  });

  it('returns the permission service and all guard inputs', () => {
    const children = <span>allowed</span>;
    const fallback = <span>denied</span>;
    const loadingComponent = <span>loading</span>;
    const context = { groupId: 'group-1' } as never;
    const { result } = renderHook(() =>
      usePermissionGuardController({
        children,
        action: 'read' as never,
        resource: 'groups' as never,
        context,
        fallback,
        loadingComponent,
      })
    );

    expect(result.current).toMatchObject({
      children,
      fallback,
      loadingComponent,
      context,
      isLoading: false,
    });
    expect(result.current.can).toEqual(expect.any(Function));
  });
});
