import type { ClipboardEvent, KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';

import { useAuthStore } from '@/features/auth/auth.ts';
import {
  translate as translateText,
  useTranslation,
} from '@/features/shared/hooks/use-translation';
import { useAuthVerification } from './useAuthVerification';
import type { VerifyFormCopy } from '../ui/VerifyFormView';

export function useVerifyFormController() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as Record<string, string>;
  const { requestMagicCode, error, clearError } = useAuthStore();
  const { isVerifying, verifyAndInitialize } = useAuthVerification();

  const email = searchParams.email || '';
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isResending, setIsResending] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!email) {
      navigate({ to: '/auth/sign-in' });
    }
  }, [email, navigate]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleVerify = async (codeToVerify?: string) => {
    const verificationCode = codeToVerify || code.join('');
    if (verificationCode.length !== 6) {
      return;
    }

    setVerificationError(null);
    const result = await verifyAndInitialize(email, verificationCode);

    if (result.success) {
      if (result.isNewUser) {
        sessionStorage.setItem('polity_onboarding', 'true');
      }
      navigate({ to: '/' });
    } else {
      setVerificationError(result.error || 'Verification failed');
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newCode.every(digit => digit !== '') && value) {
      void handleVerify(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pastedText = event.clipboardData
      .getData(translateText('generated.inline.0024_text_372ea08c'))
      .replace(/\D/g, '');

    if (pastedText.length === 6) {
      const newCode = pastedText.split('');
      setCode(newCode);
      void handleVerify(pastedText);
    }
  };

  const handleResendCode = async () => {
    setIsResending(true);
    clearError();

    const success = await requestMagicCode(email);
    setIsResending(false);

    if (success) {
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const copy: VerifyFormCopy = {
    title: t('auth.verify.title'),
    description: t('auth.verify.description'),
    codeLabel: t('auth.verify.codeLabel'),
    verifying: t('auth.verify.verifying'),
    submit: t('auth.verify.submit'),
    back: t('auth.verify.back'),
    resend: t('auth.verify.resend'),
    checkSpam: t('auth.verify.footer.checkSpam'),
    devNote: t('auth.verify.footer.devNote'),
  };

  return {
    copy,
    email,
    code,
    displayError: verificationError || error,
    isVerifying,
    isResending,
    setInputRef: (index: number, element: HTMLInputElement | null) => {
      inputRefs.current[index] = element;
    },
    onCodeChange: handleCodeChange,
    onCodeKeyDown: handleKeyDown,
    onCodePaste: handlePaste,
    onVerify: () => void handleVerify(),
    onResendCode: () => void handleResendCode(),
    onBackToEmail: () => navigate({ to: '/auth/sign-in' }),
  };
}
