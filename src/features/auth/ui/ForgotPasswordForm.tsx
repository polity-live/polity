'use client';

import { useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAuthStore } from '@/features/auth/auth.ts';
import { useAuthSignIn } from '@/features/auth/hooks/useAuthSignIn';
import { ForgotPasswordFormView, type ForgotPasswordFormCopy } from './ForgotPasswordFormView';

export function ForgotPasswordForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as Record<string, string>;
  const { error, clearError } = useAuthStore();
  const { isSigningIn, resetPassword } = useAuthSignIn();

  const [email, setEmail] = useState(searchParams.email || '');
  const [sent, setSent] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email) return;

    const result = await resetPassword(email);

    if (result.success) {
      setSent(true);
    } else {
      setLocalError(result.error ?? null);
    }
  };

  const displayError = localError || error;
  const copy: ForgotPasswordFormCopy = {
    title: t('auth.forgotPassword.title'),
    description: t('auth.forgotPassword.description'),
    successTitle: t('auth.forgotPassword.successTitle'),
    successDescription: t('auth.forgotPassword.successDescription'),
    emailLabel: t('auth.forgotPassword.emailLabel'),
    emailPlaceholder: t('auth.forgotPassword.emailPlaceholder'),
    submit: t('auth.forgotPassword.submit'),
    submitting: t('auth.forgotPassword.submitting'),
    backToSignIn: t('auth.forgotPassword.backToSignIn'),
  };

  return (
    <ForgotPasswordFormView
      copy={copy}
      email={email}
      sent={sent}
      displayError={displayError}
      isSubmitting={isSigningIn}
      onSubmit={handleSubmit}
      onEmailChange={value => {
        setEmail(value);
        setLocalError(null);
        clearError();
      }}
      onBackToSignIn={() => navigate({ to: '/auth/sign-in' })}
    />
  );
}
