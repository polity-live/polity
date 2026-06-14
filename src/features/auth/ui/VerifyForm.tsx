'use client';

import { useState, useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';

import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { useAuthStore } from '@/features/auth/auth.ts';
import { useAuthVerification } from '@/features/auth/hooks/useAuthVerification';
import { VerifyFormView, type VerifyFormCopy } from './VerifyFormView';

export function VerifyForm() {
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
    // Focus the first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all fields are filled
    if (newCode.every(digit => digit !== '') && value) {
      void handleVerify(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      // Focus previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData
      .getData(translateText('generated.inline.0024_text_372ea08c'))
      .replace(/\D/g, '');

    if (pastedText.length === 6) {
      const newCode = pastedText.split('');
      setCode(newCode);
      void handleVerify(pastedText);
    }
  };

  const handleVerify = async (codeToVerify?: string) => {
    const verificationCode = codeToVerify || code.join('');
    if (verificationCode.length !== 6) {
      return;
    }

    console.log('🔐 Starting verification with Aria & Kai initialization');
    setVerificationError(null);

    const result = await verifyAndInitialize(email, verificationCode);

    if (result.success) {
      console.log('✅ Verification successful, isNewUser:', result.isNewUser);

      if (result.isNewUser) {
        // New user - set onboarding flag BEFORE navigating (TanStack Router strips unknown search params)
        console.log('🎉 Setting polity_onboarding in sessionStorage and navigating to /');
        sessionStorage.setItem('polity_onboarding', 'true');
        navigate({ to: '/' });
      } else {
        // Existing user - redirect to homepage
        console.log('✅ Existing user, redirecting to homepage');
        navigate({ to: '/' });
      }
    } else {
      console.log('❌ Verification failed:', result.error);
      setVerificationError(result.error || 'Verification failed');
    }
  };

  const handleResendCode = async () => {
    setIsResending(true);
    clearError();

    const success = await requestMagicCode(email);
    setIsResending(false);

    if (success) {
      setCode(['', '', '', '', '', '']);
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    }
  };

  const handleBackToEmail = () => {
    navigate({ to: '/auth/sign-in' });
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

  return (
    <VerifyFormView
      copy={copy}
      email={email}
      code={code}
      displayError={verificationError || error}
      isVerifying={isVerifying}
      isResending={isResending}
      setInputRef={(index, element) => {
        inputRefs.current[index] = element;
      }}
      onCodeChange={handleCodeChange}
      onCodeKeyDown={handleKeyDown}
      onCodePaste={handlePaste}
      onVerify={() => void handleVerify()}
      onResendCode={() => void handleResendCode()}
      onBackToEmail={handleBackToEmail}
    />
  );
}
