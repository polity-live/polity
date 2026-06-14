'use client';

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAuthStore } from '@/features/auth/auth.ts';
import { useAuthLogin } from '@/features/auth/hooks/useAuthLogin';
import { LoginFormView, type LoginFormCopy } from './LoginFormView';

export function LoginForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { error } = useAuthStore();
  const { isSending, sendMagicLink } = useAuthLogin();

  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) return;

    const result = await sendMagicLink(email);

    if (result.success) {
      navigate({ to: '/auth/verify', search: { email } });
    }
  };

  const copy: LoginFormCopy = {
    title: t('auth.login.title'),
    description: t('auth.login.description'),
    emailLabel: t('auth.login.emailLabel'),
    emailPlaceholder: t('auth.login.emailPlaceholder'),
    sendCode: t('auth.login.sendCode'),
    sending: t('auth.login.sending'),
    footerNoPassword: t('auth.login.footer.noPassword'),
    footerCheckEmail: t('auth.login.footer.checkEmail'),
  };

  return (
    <LoginFormView
      copy={copy}
      email={email}
      error={error}
      isSending={isSending}
      onSubmit={handleSubmit}
      onEmailChange={setEmail}
    />
  );
}
