'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { useAuthStore } from '@/features/auth/auth.ts';
import { useAuthSignUp } from '@/features/auth/hooks/useAuthSignUp';
import { useGoogleAuth } from '@/features/auth/hooks/useGoogleAuth';
import {
  isValidEmailAddress,
  isValidPassword,
  passwordsMatch,
} from '@/features/auth/logic/authValidation';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useDebounce } from '@/features/shared/hooks/use-debounce';
import { SignUpFormView, type SignUpFormCopy } from './SignUpFormView';

export function SignUpForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { error, clearError } = useAuthStore();
  const { isSigningUp, isSendingMagicLink, signUp, sendMagicLink } = useAuthSignUp();
  const { isRedirecting, continueWithGoogle } = useGoogleAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);

  const trimmedEmail = email.trim();
  const debouncedEmail = useDebounce(trimmedEmail);
  const debouncedPassword = useDebounce(password);
  const debouncedConfirmPassword = useDebounce(confirmPassword);

  const emailIsValid = isValidEmailAddress(trimmedEmail);
  const passwordIsValid = isValidPassword(password);
  const passwordsAreMatching = passwordsMatch(password, confirmPassword);
  const isFormValid =
    trimmedEmail.length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    emailIsValid &&
    passwordIsValid &&
    passwordsAreMatching;

  const showEmailError =
    emailTouched && debouncedEmail.length > 0 && !isValidEmailAddress(debouncedEmail);
  const showEmailSuccess =
    emailTouched && debouncedEmail.length > 0 && isValidEmailAddress(debouncedEmail);
  const showPasswordError =
    passwordTouched && debouncedPassword.length > 0 && !isValidPassword(debouncedPassword);
  const showPasswordSuccess =
    passwordTouched && debouncedPassword.length > 0 && isValidPassword(debouncedPassword);
  const showConfirmPasswordError =
    confirmPasswordTouched &&
    debouncedConfirmPassword.length > 0 &&
    !passwordsMatch(debouncedPassword, debouncedConfirmPassword);
  const showConfirmPasswordSuccess =
    confirmPasswordTouched && passwordsMatch(debouncedPassword, debouncedConfirmPassword);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    setPendingConfirmationEmail(null);
    clearError();
    setEmailTouched(true);
    setPasswordTouched(true);
    setConfirmPasswordTouched(true);

    if (!trimmedEmail || !password || !confirmPassword) return;

    if (!emailIsValid) {
      setLocalError(t('auth.signUp.emailHint'));
      return;
    }

    if (!passwordIsValid) {
      setLocalError(t('auth.signUp.passwordTooShort'));
      return;
    }

    if (!passwordsAreMatching) {
      setLocalError(t('auth.signUp.passwordMismatch'));
      return;
    }

    const result = await signUp(trimmedEmail, password);

    if (result.status === 'authenticated') {
      sessionStorage.setItem('polity_onboarding', 'true');
      navigate({ to: '/' });
    } else if (result.status === 'confirmation_required') {
      setPendingConfirmationEmail(trimmedEmail);
    } else {
      setLocalError(result.error ?? null);
    }
  };

  const handleGoogleAuth = async () => {
    setLocalError(null);
    clearError();
    await continueWithGoogle('sign-up');
  };

  const handleMagicLink = async () => {
    setEmailTouched(true);

    if (!trimmedEmail || !emailIsValid) {
      setLocalError(t('auth.signUp.emailHint'));
      return;
    }

    setLocalError(null);
    clearError();

    const result = await sendMagicLink(trimmedEmail);

    if (result.success) {
      navigate({ to: '/auth/verify', search: { email: trimmedEmail } });
    } else {
      setLocalError(result.error ?? null);
    }
  };

  const copy: SignUpFormCopy = {
    title: t('auth.signUp.title'),
    description: t('auth.signUp.description'),
    emailLabel: t('auth.signUp.emailLabel'),
    emailPlaceholder: t('auth.signUp.emailPlaceholder'),
    emailHint: t('auth.signUp.emailHint'),
    passwordLabel: t('auth.signUp.passwordLabel'),
    passwordPlaceholder: t('auth.signUp.passwordPlaceholder'),
    passwordHint: t('auth.signUp.passwordHint'),
    confirmPasswordLabel: t('auth.signUp.confirmPasswordLabel'),
    confirmPasswordPlaceholder: t('auth.signUp.confirmPasswordPlaceholder'),
    confirmPasswordHint: t('auth.signUp.confirmPasswordHint'),
    submit: t('auth.signUp.submit'),
    submitting: t('auth.signUp.submitting'),
    googleButton: t('auth.signUp.googleButton'),
    googleLoading: t('auth.signUp.googleLoading'),
    magicLinkAlt: t('auth.signUp.magicLinkAlt'),
    magicLinkSending: t('auth.signUp.magicLinkSending'),
    sendCode: t('auth.signUp.sendCode'),
    hasAccount: t('auth.signUp.hasAccount'),
    signInLink: t('auth.signUp.signInLink'),
    confirmationPendingTitle: t('auth.signUp.confirmationPendingTitle'),
    confirmationPendingDescription: t('auth.signUp.confirmationPendingDescription', {
      email: pendingConfirmationEmail ?? '',
    }),
    confirmationPendingInstructions: t('auth.signUp.confirmationPendingInstructions'),
    useDifferentEmail: t('auth.signUp.useDifferentEmail'),
  };

  const isLoading = isSigningUp || isSendingMagicLink || isRedirecting;

  return (
    <SignUpFormView
      copy={copy}
      email={email}
      password={password}
      confirmPassword={confirmPassword}
      pendingConfirmationEmail={pendingConfirmationEmail}
      displayError={localError || error}
      isLoading={isLoading}
      isSigningUp={isSigningUp}
      isRedirecting={isRedirecting}
      isSendingMagicLink={isSendingMagicLink}
      isFormValid={isFormValid}
      magicLinkDisabled={isLoading || !trimmedEmail || !emailIsValid}
      showEmailError={showEmailError}
      showEmailSuccess={showEmailSuccess}
      showPasswordError={showPasswordError}
      showPasswordSuccess={showPasswordSuccess}
      showConfirmPasswordError={showConfirmPasswordError}
      showConfirmPasswordSuccess={showConfirmPasswordSuccess}
      onSubmit={handleSubmit}
      onEmailChange={value => {
        setEmail(value);
        setEmailTouched(true);
        setLocalError(null);
      }}
      onEmailBlur={() => setEmailTouched(true)}
      onPasswordChange={value => {
        setPassword(value);
        setPasswordTouched(true);
        setLocalError(null);
      }}
      onPasswordBlur={() => setPasswordTouched(true)}
      onConfirmPasswordChange={value => {
        setConfirmPassword(value);
        setConfirmPasswordTouched(true);
        setLocalError(null);
      }}
      onConfirmPasswordBlur={() => setConfirmPasswordTouched(true)}
      onGoogleAuth={handleGoogleAuth}
      onMagicLink={handleMagicLink}
      onGoToSignIn={() => navigate({ to: '/auth/sign-in' })}
      onUseDifferentEmail={() => {
        setPendingConfirmationEmail(null);
        setPassword('');
        setConfirmPassword('');
      }}
    />
  );
}
