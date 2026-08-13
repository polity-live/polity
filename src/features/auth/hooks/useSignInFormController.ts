import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { useAuthStore } from '@/features/auth/auth.ts';
import { isValidEmailAddress } from '@/features/auth/logic/authValidation';
import {
  consumePendingSignInRedirect,
  getSafeSignInRedirect,
} from '@/features/auth/logic/authRedirects';
import { useDebounce } from '@/features/shared/hooks/use-debounce';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAuthSignIn } from './useAuthSignIn';
import { useGoogleAuth } from './useGoogleAuth';
import type { SignInFormCopy } from '../ui/SignInFormView';

type SignInLocationWindow = Pick<Window, 'location'>;

export function readRouteSignInRedirect(
  currentWindow: SignInLocationWindow | undefined = typeof window === 'undefined'
    ? undefined
    : window
) {
  return currentWindow ? new URL(currentWindow.location.href).searchParams.get('redirect') : null;
}

export function useSignInFormController() {
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
      const storedDestination = consumePendingSignInRedirect();
      const routeDestination = readRouteSignInRedirect();
      navigate({
        to: routeDestination ? getSafeSignInRedirect(routeDestination) : storedDestination,
      });
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

  const copy: SignInFormCopy = {
    title: t('auth.signIn.title'),
    description: t('auth.signIn.description'),
    emailLabel: t('auth.signIn.emailLabel'),
    emailPlaceholder: t('auth.signIn.emailPlaceholder'),
    emailHint: t('auth.signIn.emailHint'),
    passwordLabel: t('auth.signIn.passwordLabel'),
    passwordPlaceholder: t('auth.signIn.passwordPlaceholder'),
    forgotPassword: t('auth.signIn.forgotPassword'),
    magicLinkSent: t('auth.signIn.magicLinkSent'),
    submit: t('auth.signIn.submit'),
    submitting: t('auth.signIn.submitting'),
    googleButton: t('auth.signIn.googleButton'),
    googleLoading: t('auth.signIn.googleLoading'),
    magicLinkAlt: t('auth.signIn.magicLinkAlt'),
    magicLinkSending: t('auth.signIn.magicLinkSending'),
    sendCode: t('auth.signIn.sendCode'),
    noAccount: t('auth.signIn.noAccount'),
    signUpLink: t('auth.signIn.signUpLink'),
  };

  const isLoading = isSigningIn || isRedirecting;

  return {
    copy,
    email,
    password,
    magicLinkSent,
    displayError: localError || error,
    isLoading,
    isSigningIn,
    isRedirecting,
    trimmedEmail,
    emailIsValid,
    showEmailError,
    showEmailSuccess,
    onSubmit: handleSubmit,
    onEmailChange: (value: string) => {
      setEmail(value);
      setEmailTouched(true);
      setMagicLinkSent(false);
      setLocalError(null);
    },
    onEmailBlur: () => setEmailTouched(true),
    onPasswordChange: (value: string) => {
      setPassword(value);
      setLocalError(null);
    },
    onMagicLink: handleMagicLink,
    onGoogleAuth: handleGoogleAuth,
    onForgotPassword: () =>
      navigate({
        to: '/auth/forgot-password',
        search: { email: email || undefined },
      }),
    onGoToSignUp: () => navigate({ to: '/auth/sign-up' }),
  };
}
