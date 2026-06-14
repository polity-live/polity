import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { useAuthStore } from '@/features/auth/auth.ts';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAuthLogin } from './useAuthLogin';
import type { LoginFormCopy } from '../ui/LoginFormView';

export function useLoginFormController() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { error } = useAuthStore();
  const { isSending, sendMagicLink } = useAuthLogin();
  const [email, setEmail] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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

  return {
    copy,
    email,
    error,
    isSending,
    onSubmit: handleSubmit,
    onEmailChange: setEmail,
  };
}
