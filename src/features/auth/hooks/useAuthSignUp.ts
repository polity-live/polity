/**
 * Auth Sign-Up Hook
 * Business logic for email+password registration
 */

import { useState, useCallback } from 'react';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useAuthStore } from '../auth';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface SignUpResult {
  status: 'authenticated' | 'confirmation_required' | 'error';
  error?: string;
}

interface UseAuthSignUpReturn {
  isSigningUp: boolean;
  isSendingMagicLink: boolean;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  sendMagicLink: (email: string) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Hook for handling email+password sign-up
 */
export function useAuthSignUp(): UseAuthSignUpReturn {
  const { t } = useTranslation();
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const { signUpWithPassword, requestMagicCode } = useAuthStore();

  const signUp = useCallback(
    async (email: string, password: string): Promise<SignUpResult> => {
      setIsSigningUp(true);

      try {
        const result = await signUpWithPassword(email, password);

        if (result.status === 'error') {
          return { status: 'error', error: result.error ?? t('auth.signUp.signUpFailed') };
        }

        if (result.status === 'confirmation_required') {
          return { status: 'confirmation_required' };
        }

        return { status: 'authenticated' };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : t('features.auth.errors.unexpectedError');
        toast.error(errorMessage);
        return { status: 'error', error: errorMessage };
      } finally {
        setIsSigningUp(false);
      }
    },
    [signUpWithPassword, t]
  );

  const sendMagicLink = useCallback(
    async (email: string): Promise<{ success: boolean; error?: string }> => {
      setIsSendingMagicLink(true);

      try {
        const success = await requestMagicCode(email);

        if (!success) {
          return { success: false, error: t('features.auth.errors.magicLinkFailed') };
        }

        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : t('features.auth.errors.unexpectedError');
        toast.error(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setIsSendingMagicLink(false);
      }
    },
    [requestMagicCode, t]
  );

  return { isSigningUp, isSendingMagicLink, signUp, sendMagicLink };
}
