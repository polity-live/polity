import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { isValidPassword, passwordsMatch } from '@/features/auth/logic/authValidation';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { createClient } from '@/lib/supabase/client';
import type { ResetPasswordFormCopy } from '../ui/ResetPasswordFormView';

export function useResetPasswordFormController() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!isValidPassword(password)) {
      setError(t('auth.resetPassword.tooShort'));
      return;
    }
    if (!passwordsMatch(password, confirmPassword)) {
      setError(t('auth.resetPassword.mismatch'));
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      navigate({ to: '/auth/sign-in', replace: true });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : t('auth.resetPassword.failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const copy: ResetPasswordFormCopy = {
    title: t('auth.resetPassword.title'),
    description: t('auth.resetPassword.description'),
    newPassword: t('auth.resetPassword.newPassword'),
    newPasswordPlaceholder: t('auth.resetPassword.newPasswordPlaceholder'),
    confirmPassword: t('auth.resetPassword.confirmPassword'),
    confirmPasswordPlaceholder: t('auth.resetPassword.confirmPasswordPlaceholder'),
    submit: t('auth.resetPassword.submit'),
    submitting: t('auth.resetPassword.submitting'),
  };

  return {
    copy,
    password,
    confirmPassword,
    error,
    isSubmitting,
    onSubmit: handleSubmit,
    onPasswordChange: (value: string) => {
      setPassword(value);
      setError(null);
    },
    onConfirmPasswordChange: (value: string) => {
      setConfirmPassword(value);
      setError(null);
    },
  };
}
