'use client';

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAuthStore } from '@/features/auth/auth.ts';
import { useAuthSignIn } from '@/features/auth/hooks/useAuthSignIn';
import { useGoogleAuth } from '@/features/auth/hooks/useGoogleAuth';
import { useDebounce } from '@/features/shared/hooks/use-debounce';
import { isValidEmailAddress } from '@/features/auth/logic/authValidation';
import { SignInFormView } from './SignInFormView';

export function SignInForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { error, clearError } = useAuthStore();
  const { isSigningIn, signIn, sendMagicLink } = useAuthSignIn();
  const { isRedirecting, continueWithGoogle } = useGoogleAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);

  const trimmedEmail = email.trim();
  const debouncedEmail = useDebounce(trimmedEmail);
  const emailIsValid = isValidEmailAddress(trimmedEmail);
  const showEmailError =
    emailTouched && debouncedEmail.length > 0 && !isValidEmailAddress(debouncedEmail);
  const showEmailSuccess =
    emailTouched && debouncedEmail.length > 0 && isValidEmailAddress(debouncedEmail);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    setEmailTouched(true);

    if (!trimmedEmail || !password) return;

    if (!emailIsValid) {
      setLocalError(t('auth.signIn.emailHint'));
      return;
    }

    const result = await signIn(trimmedEmail, password);

    if (result.success) {
      if (result.isNewUser) {
        sessionStorage.setItem('polity_onboarding', 'true');
      }
      navigate({ to: '/' });
    } else {
      setLocalError(result.error ?? null);
    }
  };

  const handleMagicLink = async () => {
    setEmailTouched(true);

    if (!trimmedEmail || !emailIsValid) {
      setLocalError(t('auth.signIn.emailHint'));
      return;
    }
    setLocalError(null);
    clearError();
    setMagicLinkSent(false);

    const result = await sendMagicLink(trimmedEmail);

    if (result.success) {
      setMagicLinkSent(true);
      navigate({ to: '/auth/verify', search: { email: trimmedEmail } });
    } else {
      setLocalError(result.error ?? null);
    }
  };

  const handleGoogleAuth = async () => {
    setLocalError(null);
    clearError();
    await continueWithGoogle('sign-in');
  };

  const displayError = localError || error;
  const isLoading = isSigningIn || isRedirecting;

  return (
    <SignInFormView
      email={email}
      password={password}
      magicLinkSent={magicLinkSent}
      displayError={displayError}
      isLoading={isLoading}
      isSigningIn={isSigningIn}
      isRedirecting={isRedirecting}
      trimmedEmail={trimmedEmail}
      emailIsValid={emailIsValid}
      showEmailError={showEmailError}
      showEmailSuccess={showEmailSuccess}
      onSubmit={handleSubmit}
      onEmailChange={value => {
        setEmail(value);
        setEmailTouched(true);
        setMagicLinkSent(false);
        setLocalError(null);
      }}
      onEmailBlur={() => setEmailTouched(true)}
      onPasswordChange={value => {
        setPassword(value);
        setLocalError(null);
      }}
      onMagicLink={handleMagicLink}
      onGoogleAuth={handleGoogleAuth}
    />
  );
}
