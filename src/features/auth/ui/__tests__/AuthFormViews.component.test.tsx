/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ForgotPasswordFormView } from '../ForgotPasswordFormView';
import { LoginFormView } from '../LoginFormView';
import { ResetPasswordFormView } from '../ResetPasswordFormView';
import { SignInFormView } from '../SignInFormView';
import { SignUpFormView } from '../SignUpFormView';
import { VerifyFormView } from '../VerifyFormView';

afterEach(cleanup);

const loginCopy: ComponentProps<typeof LoginFormView>['copy'] = {
  title: 'Login',
  description: 'Use your email',
  emailLabel: 'Email',
  emailPlaceholder: 'name@example.test',
  sendCode: 'Send code',
  sending: 'Sending code',
  footerNoPassword: 'No password required',
  footerCheckEmail: 'Check your inbox',
};

const forgotCopy: ComponentProps<typeof ForgotPasswordFormView>['copy'] = {
  title: 'Forgot password',
  description: 'Request a reset link',
  successTitle: 'Email sent',
  successDescription: 'A link was sent to',
  emailLabel: 'Email',
  emailPlaceholder: 'name@example.test',
  submit: 'Reset password',
  submitting: 'Requesting reset',
  backToSignIn: 'Back to sign in',
};

const resetCopy: ComponentProps<typeof ResetPasswordFormView>['copy'] = {
  title: 'Choose password',
  description: 'Enter it twice',
  newPassword: 'New password',
  newPasswordPlaceholder: 'New password',
  confirmPassword: 'Confirm password',
  confirmPasswordPlaceholder: 'Confirm password',
  submit: 'Save password',
  submitting: 'Saving password',
};

const verifyCopy: ComponentProps<typeof VerifyFormView>['copy'] = {
  title: 'Verify email',
  description: 'Enter the code sent to',
  codeLabel: 'Verification code',
  verifying: 'Verifying code',
  submit: 'Verify',
  back: 'Back',
  resend: 'Resend',
  checkSpam: 'Check spam',
  devNote: 'Development code',
};

const signInCopy: ComponentProps<typeof SignInFormView>['copy'] = {
  title: 'Sign in',
  description: 'Welcome back',
  emailLabel: 'Email',
  emailPlaceholder: 'name@example.test',
  emailHint: 'Use a valid email',
  passwordLabel: 'Password',
  passwordPlaceholder: 'Password',
  forgotPassword: 'Forgot password?',
  magicLinkSent: 'Magic link sent',
  submit: 'Sign in',
  submitting: 'Signing in',
  googleButton: 'Continue with Google',
  googleLoading: 'Opening Google',
  magicLinkAlt: 'or',
  magicLinkSending: 'Sending magic link',
  sendCode: 'Send magic link',
  noAccount: 'No account?',
  signUpLink: 'Create account',
};

const signUpCopy: ComponentProps<typeof SignUpFormView>['copy'] = {
  title: 'Create account',
  description: 'Join Polity',
  emailLabel: 'Email',
  emailPlaceholder: 'name@example.test',
  emailHint: 'Use a valid email',
  passwordLabel: 'Password',
  passwordPlaceholder: 'Password',
  passwordHint: 'At least six characters',
  confirmPasswordLabel: 'Confirm password',
  confirmPasswordPlaceholder: 'Confirm password',
  confirmPasswordHint: 'Passwords must match',
  submit: 'Create account',
  submitting: 'Creating account',
  googleButton: 'Continue with Google',
  googleLoading: 'Opening Google',
  magicLinkAlt: 'or',
  magicLinkSending: 'Sending code',
  sendCode: 'Send code',
  hasAccount: 'Already registered?',
  signInLink: 'Sign in',
  confirmationPendingTitle: 'Confirm your email',
  confirmationPendingDescription: 'Confirmation required',
  confirmationPendingInstructions: 'Open the confirmation link',
  useDifferentEmail: 'Use another email',
};

function expectNativeKeyboardAndFocusContract(actionId: string) {
  const action = [...document.querySelectorAll<HTMLElement>(`[data-action-id="${actionId}"]`)].find(
    element => element.tagName === 'BUTTON'
  );
  expect(action?.tagName).toBe('BUTTON');
  action?.focus();
  expect(document.activeElement).toBe(action);
}

describe('auth form view contracts', () => {
  it('handles login input, submission, error, disabled, and loading states', () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onEmailChange = vi.fn();
    const { rerender } = render(
      <LoginFormView
        copy={loginCopy}
        email=""
        error={null}
        isSending={false}
        onSubmit={onSubmit}
        onEmailChange={onEmailChange}
      />
    );

    expect(screen.getByRole('button', { name: 'Send code' }).hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByLabelText('Email*'), {
      target: { value: 'ada@example.test' },
    });
    expect(onEmailChange).toHaveBeenCalledWith('ada@example.test');

    rerender(
      <LoginFormView
        copy={loginCopy}
        email="ada@example.test"
        error="Delivery failed"
        isSending={false}
        onSubmit={onSubmit}
        onEmailChange={onEmailChange}
      />
    );
    fireEvent.submit(screen.getByRole('button', { name: 'Send code' }).closest('form')!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Delivery failed')).toBeTruthy();

    rerender(
      <LoginFormView
        copy={loginCopy}
        email="ada@example.test"
        error="Not authorized"
        isSending={false}
        onSubmit={onSubmit}
        onEmailChange={onEmailChange}
      />
    );
    expect(screen.getByText('Not authorized')).toBeTruthy();

    rerender(
      <LoginFormView
        copy={loginCopy}
        email="ada@example.test"
        error={null}
        isSending
        onSubmit={onSubmit}
        onEmailChange={onEmailChange}
      />
    );
    expect(screen.getByRole('button', { name: 'Sending code' }).hasAttribute('disabled')).toBe(
      true
    );
    expect(screen.getByLabelText('Email*').hasAttribute('disabled')).toBe(true);
  });

  it('handles forgot-password request, failure, success, and both back actions', () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onEmailChange = vi.fn();
    const onBackToSignIn = vi.fn();
    const { rerender } = render(
      <ForgotPasswordFormView
        copy={forgotCopy}
        email="ada@example.test"
        sent={false}
        displayError="Reset unavailable"
        isSubmitting={false}
        onSubmit={onSubmit}
        onEmailChange={onEmailChange}
        onBackToSignIn={onBackToSignIn}
      />
    );

    fireEvent.change(screen.getByLabelText('Email*'), {
      target: { value: 'grace@example.test' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Reset password' }).closest('form')!);
    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expectNativeKeyboardAndFocusContract('auth.forgot-password.navigate.sign-in');
    expect(onEmailChange).toHaveBeenCalledWith('grace@example.test');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onBackToSignIn).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Reset unavailable')).toBeTruthy();

    rerender(
      <ForgotPasswordFormView
        copy={forgotCopy}
        email="ada@example.test"
        sent={false}
        displayError="Not authorized"
        isSubmitting
        onSubmit={onSubmit}
        onEmailChange={onEmailChange}
        onBackToSignIn={onBackToSignIn}
      />
    );
    expect(screen.getByText('Not authorized')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Requesting reset' }).hasAttribute('disabled')).toBe(
      true
    );

    rerender(
      <ForgotPasswordFormView
        copy={forgotCopy}
        email="ada@example.test"
        sent
        displayError={null}
        isSubmitting={false}
        onSubmit={onSubmit}
        onEmailChange={onEmailChange}
        onBackToSignIn={onBackToSignIn}
      />
    );
    expect(screen.getByText('ada@example.test')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(onBackToSignIn).toHaveBeenCalledTimes(2);
  });

  it('handles reset-password fields, failure, submission, and loading state', () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onPasswordChange = vi.fn();
    const onConfirmPasswordChange = vi.fn();
    const { rerender } = render(
      <ResetPasswordFormView
        copy={resetCopy}
        password="secret1"
        confirmPassword="secret1"
        error="Token expired"
        isSubmitting={false}
        onSubmit={onSubmit}
        onPasswordChange={onPasswordChange}
        onConfirmPasswordChange={onConfirmPasswordChange}
      />
    );

    const passwordFields = screen.getAllByLabelText(/password/i);
    fireEvent.change(passwordFields[0], { target: { value: 'secret2' } });
    fireEvent.change(passwordFields[1], { target: { value: 'secret2' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save password' }).closest('form')!);
    expect(onPasswordChange).toHaveBeenCalledWith('secret2');
    expect(onConfirmPasswordChange).toHaveBeenCalledWith('secret2');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Token expired')).toBeTruthy();

    rerender(
      <ResetPasswordFormView
        copy={resetCopy}
        password="secret1"
        confirmPassword="secret1"
        error="Not authorized"
        isSubmitting={false}
        onSubmit={onSubmit}
        onPasswordChange={onPasswordChange}
        onConfirmPasswordChange={onConfirmPasswordChange}
      />
    );
    expect(screen.getByText('Not authorized')).toBeTruthy();

    rerender(
      <ResetPasswordFormView
        copy={resetCopy}
        password="secret1"
        confirmPassword="secret1"
        error={null}
        isSubmitting
        onSubmit={onSubmit}
        onPasswordChange={onPasswordChange}
        onConfirmPasswordChange={onConfirmPasswordChange}
      />
    );
    expect(screen.getByRole('button', { name: 'Saving password' }).hasAttribute('disabled')).toBe(
      true
    );
  });

  it('routes verification input, keyboard, paste, submit, resend, and back actions', () => {
    const callbacks = {
      setInputRef: vi.fn(),
      onCodeChange: vi.fn(),
      onCodeKeyDown: vi.fn(),
      onCodePaste: vi.fn(),
      onVerify: vi.fn(),
      onResendCode: vi.fn(),
      onBackToEmail: vi.fn(),
    };
    const { rerender } = render(
      <VerifyFormView
        copy={verifyCopy}
        email="ada@example.test"
        code={['1', '2', '3', '4', '5', '6']}
        displayError="Wrong code"
        isVerifying={false}
        isResending={false}
        {...callbacks}
      />
    );

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: '9' } });
    fireEvent.keyDown(inputs[1], { key: 'Backspace' });
    fireEvent.paste(inputs[0], { clipboardData: { getData: () => '654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    fireEvent.click(screen.getByRole('button', { name: 'Resend' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(callbacks.setInputRef).toHaveBeenCalled();
    expect(callbacks.onCodeChange).toHaveBeenCalledWith(0, '9');
    expect(callbacks.onCodeKeyDown).toHaveBeenCalledWith(1, expect.anything());
    expect(callbacks.onCodePaste).toHaveBeenCalledTimes(1);
    expect(callbacks.onVerify).toHaveBeenCalledTimes(1);
    expect(callbacks.onResendCode).toHaveBeenCalledTimes(1);
    expect(callbacks.onBackToEmail).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Wrong code')).toBeTruthy();

    expectNativeKeyboardAndFocusContract('auth.verify.submit.code');
    expectNativeKeyboardAndFocusContract('auth.verify.resend.code');
    expectNativeKeyboardAndFocusContract('auth.verify.navigate.email');
    rerender(
      <VerifyFormView
        copy={verifyCopy}
        email="ada@example.test"
        code={['1', '2', '3', '4', '5', '6']}
        displayError="Not authorized"
        isVerifying
        isResending
        {...callbacks}
      />
    );
    expect(screen.getByText('Not authorized')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verifying code' }).hasAttribute('disabled')).toBe(
      true
    );
    expect(screen.getByRole('button', { name: 'Resend' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Back' }).hasAttribute('disabled')).toBe(true);
  });

  it('handles sign-in validation, notices, submit, and alternate authentication actions', () => {
    const callbacks = {
      onSubmit: vi.fn((event: React.FormEvent) => event.preventDefault()),
      onEmailChange: vi.fn(),
      onEmailBlur: vi.fn(),
      onPasswordChange: vi.fn(),
      onMagicLink: vi.fn(),
      onGoogleAuth: vi.fn(),
      onForgotPassword: vi.fn(),
      onGoToSignUp: vi.fn(),
    };
    const { rerender } = render(
      <SignInFormView
        copy={signInCopy}
        email="ada@example.test"
        password="secret1"
        magicLinkSent
        displayError="Sign in failed"
        isLoading={false}
        isSigningIn={false}
        isRedirecting={false}
        trimmedEmail="ada@example.test"
        emailIsValid
        showEmailError={false}
        showEmailSuccess
        {...callbacks}
      />
    );

    fireEvent.change(screen.getByLabelText('Email*'), {
      target: { value: 'grace@example.test' },
    });
    fireEvent.blur(screen.getByLabelText('Email*'));
    fireEvent.change(screen.getByLabelText('Password*'), { target: { value: 'secret2' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!);
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send magic link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(callbacks.onEmailChange).toHaveBeenCalledWith('grace@example.test');
    expect(callbacks.onEmailBlur).toHaveBeenCalledTimes(1);
    expect(callbacks.onPasswordChange).toHaveBeenCalledWith('secret2');
    expect(callbacks.onSubmit).toHaveBeenCalledTimes(1);
    expect(callbacks.onForgotPassword).toHaveBeenCalledTimes(1);
    expect(callbacks.onGoogleAuth).toHaveBeenCalledTimes(1);
    expect(callbacks.onMagicLink).toHaveBeenCalledTimes(1);
    expect(callbacks.onGoToSignUp).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Sign in failed')).toBeTruthy();
    expect(screen.getByText('Magic link sent')).toBeTruthy();
    expectNativeKeyboardAndFocusContract('auth.sign-in.navigate.forgot-password');
    expectNativeKeyboardAndFocusContract('auth.sign-in.navigate.sign-up');

    rerender(
      <SignInFormView
        copy={signInCopy}
        email="ada@example.test"
        password="secret1"
        magicLinkSent={false}
        displayError="Not authorized"
        isLoading
        isSigningIn
        isRedirecting
        trimmedEmail="ada@example.test"
        emailIsValid
        showEmailError={false}
        showEmailSuccess={false}
        {...callbacks}
      />
    );
    expect(screen.getByText('Not authorized')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Signing in' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Opening Google' }).hasAttribute('disabled')).toBe(
      true
    );
    expect(
      screen.getByRole('button', { name: 'Sending magic link' }).hasAttribute('disabled')
    ).toBe(true);
  });

  it('handles sign-up field, submit, provider, magic-link, and navigation actions', () => {
    const callbacks = {
      onSubmit: vi.fn((event: React.FormEvent) => event.preventDefault()),
      onEmailChange: vi.fn(),
      onEmailBlur: vi.fn(),
      onPasswordChange: vi.fn(),
      onPasswordBlur: vi.fn(),
      onConfirmPasswordChange: vi.fn(),
      onConfirmPasswordBlur: vi.fn(),
      onGoogleAuth: vi.fn(),
      onMagicLink: vi.fn(),
      onGoToSignIn: vi.fn(),
      onUseDifferentEmail: vi.fn(),
    };
    const { rerender } = render(
      <SignUpFormView
        copy={signUpCopy}
        email="ada@example.test"
        password="secret1"
        confirmPassword="secret1"
        pendingConfirmationEmail={null}
        displayError="Registration warning"
        isLoading={false}
        isSigningUp={false}
        isRedirecting={false}
        isSendingMagicLink={false}
        isFormValid
        magicLinkDisabled={false}
        showEmailError={false}
        showEmailSuccess
        showPasswordError={false}
        showPasswordSuccess
        showConfirmPasswordError={false}
        showConfirmPasswordSuccess
        {...callbacks}
      />
    );

    fireEvent.change(screen.getByLabelText('Email*'), {
      target: { value: 'grace@example.test' },
    });
    fireEvent.blur(screen.getByLabelText('Email*'));
    const passwordFields = screen.getAllByLabelText(/password/i);
    fireEvent.change(passwordFields[0], { target: { value: 'secret2' } });
    fireEvent.blur(passwordFields[0]);
    fireEvent.change(passwordFields[1], { target: { value: 'secret2' } });
    fireEvent.blur(passwordFields[1]);
    fireEvent.submit(screen.getByRole('button', { name: 'Create account' }).closest('form')!);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(callbacks.onEmailChange).toHaveBeenCalledWith('grace@example.test');
    expect(callbacks.onPasswordChange).toHaveBeenCalledWith('secret2');
    expect(callbacks.onConfirmPasswordChange).toHaveBeenCalledWith('secret2');
    expect(callbacks.onSubmit).toHaveBeenCalledTimes(1);
    expect(callbacks.onGoogleAuth).toHaveBeenCalledTimes(1);
    expect(callbacks.onMagicLink).toHaveBeenCalledTimes(1);
    expect(callbacks.onGoToSignIn).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Registration warning')).toBeTruthy();

    rerender(
      <SignUpFormView
        copy={signUpCopy}
        email="ada@example.test"
        password="secret1"
        confirmPassword="secret1"
        pendingConfirmationEmail={null}
        displayError="Not authorized"
        isLoading
        isSigningUp
        isRedirecting
        isSendingMagicLink
        isFormValid
        magicLinkDisabled
        showEmailError={false}
        showEmailSuccess={false}
        showPasswordError={false}
        showPasswordSuccess={false}
        showConfirmPasswordError={false}
        showConfirmPasswordSuccess={false}
        {...callbacks}
      />
    );
    expect(screen.getByText('Not authorized')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Creating account' }).hasAttribute('disabled')).toBe(
      true
    );
    expect(screen.getByRole('button', { name: 'Opening Google' }).hasAttribute('disabled')).toBe(
      true
    );
    expect(screen.getByRole('button', { name: 'Sending code' }).hasAttribute('disabled')).toBe(
      true
    );

    rerender(
      <SignUpFormView
        copy={signUpCopy}
        email="ada@example.test"
        password=""
        confirmPassword=""
        pendingConfirmationEmail="ada@example.test"
        displayError={null}
        isLoading={false}
        isSigningUp={false}
        isRedirecting={false}
        isSendingMagicLink={false}
        isFormValid={false}
        magicLinkDisabled
        showEmailError={false}
        showEmailSuccess={false}
        showPasswordError={false}
        showPasswordSuccess={false}
        showConfirmPasswordError={false}
        showConfirmPasswordSuccess={false}
        {...callbacks}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use another email' }));
    expectNativeKeyboardAndFocusContract('auth.sign-up.navigate.sign-in');
    expectNativeKeyboardAndFocusContract('auth.sign-up.change.email');
    expect(callbacks.onGoToSignIn).toHaveBeenCalledTimes(2);
    expect(callbacks.onUseDifferentEmail).toHaveBeenCalledTimes(1);
  });
});
