/**
 * Account Actions Hook
 * Business logic for updating account password and email via Supabase Auth
 */

import { useState, useCallback } from 'react';
import { toast } from '@/features/shared/ui/ui/sonner';
import { createClient } from '@/lib/supabase/client';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useAuth } from '@/providers/auth-provider';
import { getAuthRedirectUrl } from '@/features/auth/logic/authRedirects';

interface AccountActionResult {
  success: boolean;
  error?: string;
  verificationRequired?: boolean;
}

interface UseAccountActionsReturn {
  isUpdating: boolean;
  verifyCurrentPassword: (currentPassword: string) => Promise<AccountActionResult>;
  updateAccountPassword: (
    newPassword: string,
    currentPassword?: string,
    nonce?: string
  ) => Promise<AccountActionResult>;
  updateAccountEmail: (newEmail: string, currentPassword?: string) => Promise<AccountActionResult>;
}

/**
 * Hook for updating account password and email
 * Sensitive account changes require verifying the current account password first.
 */
export function useAccountActions(): UseAccountActionsReturn {
  const { t } = useTranslation();
  const { user, authStateLoading, refreshAuthState } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);

  const verifyCurrentPassword = useCallback(
    async (currentPassword: string): Promise<AccountActionResult> => {
      if (authStateLoading || user?.hasPassword === null) {
        return {
          success: false,
          error: t('pages.user.securityConfirmation.unavailable'),
        };
      }

      if (user?.hasPassword === false) {
        return {
          success: false,
          error: t('pages.user.securityConfirmation.initialPasswordRequired'),
        };
      }

      if (currentPassword.length === 0) {
        return {
          success: false,
          error: t('pages.user.securityConfirmation.passwordRequired'),
        };
      }

      if (!user?.email) {
        return {
          success: false,
          error: t('pages.user.securityConfirmation.unavailable'),
        };
      }

      try {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });

        if (error) {
          return {
            success: false,
            error: t('pages.user.securityConfirmation.invalidPassword'),
          };
        }

        return { success: true };
      } catch (error) {
        console.error('Failed to verify current password:', error);
        return {
          success: false,
          error: t('pages.user.securityConfirmation.unavailable'),
        };
      }
    },
    [authStateLoading, t, user?.email, user?.hasPassword]
  );

  const updateAccountPassword = useCallback(
    async (
      newPassword: string,
      currentPassword?: string,
      nonce?: string
    ): Promise<AccountActionResult> => {
      setIsUpdating(true);
      try {
        if (authStateLoading || !user || user.hasPassword === null) {
          return {
            success: false,
            error: t('pages.user.securityConfirmation.unavailable'),
          };
        }

        if (!nonce && user.hasPassword) {
          const verificationResult = await verifyCurrentPassword(currentPassword ?? '');
          if (!verificationResult.success) {
            return verificationResult;
          }
        }

        const supabase = createClient();
        if (!nonce) {
          const { error } = await supabase.auth.reauthenticate();
          if (error) throw error;
          return { success: false, verificationRequired: true };
        }

        const { error } = await supabase.auth.updateUser({
          password: newPassword,
          nonce,
          ...(user.hasPassword && currentPassword ? { current_password: currentPassword } : {}),
        });

        if (error) {
          throw error;
        }

        await refreshAuthState();
        toast.success(t('pages.user.accountPassword.success'));
        return { success: true };
      } catch (error) {
        console.error('Failed to update password:', error);
        const errorMessage = t('pages.user.accountPassword.failed');
        toast.error(errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        setIsUpdating(false);
      }
    },
    [authStateLoading, refreshAuthState, t, user?.hasPassword, verifyCurrentPassword]
  );

  const updateAccountEmail = useCallback(
    async (newEmail: string, currentPassword?: string): Promise<AccountActionResult> => {
      setIsUpdating(true);
      try {
        if (authStateLoading || !user || user.hasPassword === null) {
          return {
            success: false,
            error: t('pages.user.securityConfirmation.unavailable'),
          };
        }

        if (user.hasPassword) {
          const verificationResult = await verifyCurrentPassword(currentPassword ?? '');
          if (!verificationResult.success) {
            return verificationResult;
          }
        }

        const supabase = createClient();
        const { data, error } = await supabase.auth.updateUser(
          { email: newEmail },
          { emailRedirectTo: getAuthRedirectUrl('/auth/callback') }
        );

        if (error) {
          throw error;
        }

        await refreshAuthState();

        const emailUpdatedImmediately = data.user?.email === newEmail;
        toast.success(
          emailUpdatedImmediately
            ? t('pages.user.accountEmail.success')
            : t('pages.user.accountEmail.confirmationSent')
        );
        return { success: true };
      } catch (error) {
        console.error('Failed to update email:', error);
        const errorMessage = t('pages.user.accountEmail.failed');
        toast.error(errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        setIsUpdating(false);
      }
    },
    [authStateLoading, refreshAuthState, t, user?.hasPassword, verifyCurrentPassword]
  );

  return { isUpdating, verifyCurrentPassword, updateAccountPassword, updateAccountEmail };
}
