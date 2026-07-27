// auth.ts
// Supabase authentication implementation using email+password and magic links
// Uses Supabase's built-in auth system

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createClient } from '@/lib/supabase/client';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { getAuthRedirectUrl } from '@/features/auth/logic/authRedirects';
import { storePendingGoogleLanguage } from '@/features/auth/logic/authLanguage';
import { useLanguageStore } from '@/features/shared/global-state/language.store';

const AUTH_RETRY_DELAY_MS = 750;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message;
  }

  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }

  return null;
}

function getErrorStatus(error: unknown): number | null {
  if (isRecord(error) && typeof error.status === 'number') {
    return error.status;
  }

  return null;
}

function isAlreadyRegisteredAuthError(error: unknown): boolean {
  return isRecord(error) && error.code === 'user_already_exists';
}

function isTransientAuthInfrastructureError(error: unknown): boolean {
  const message = getErrorMessage(error)?.toLowerCase() ?? '';
  const status = getErrorStatus(error);

  return (
    status === 502 ||
    message.includes('upstream server') ||
    message.includes('authretryablefetcherror') ||
    message.includes('bad gateway') ||
    message.includes('failed to fetch') ||
    message.includes('connection refused') ||
    message.includes('network request failed')
  );
}

function normalizeAuthErrorMessage(error: unknown, fallback: string): string {
  if (isTransientAuthInfrastructureError(error)) {
    return translateText('common.appErrors.auth_service_unavailable');
  }

  if (isRecord(error)) {
    if (error.code === 'invalid_credentials') {
      return translateText('auth.signIn.invalidCredentials');
    }
    if (error.code === 'otp_expired' || error.code === 'otp_disabled') {
      return translateText('features.auth.errors.invalidOrExpiredCode');
    }
    if (error.code === 'weak_password') {
      return translateText('auth.signUp.passwordTooShort');
    }
  }

  return fallback;
}

async function retryTransientAuthFailure<T extends { error: unknown | null }>(
  operation: () => Promise<T>
): Promise<T> {
  const result = await operation();

  if (!result.error || !isTransientAuthInfrastructureError(result.error)) {
    return result;
  }

  await new Promise(resolve => setTimeout(resolve, AUTH_RETRY_DELAY_MS));
  return operation();
}

// Define the authentication store state interface
// Note: Auth session state is managed by Supabase + AuthProvider.
// This store handles imperative auth operations (sign up, sign in, send OTP, verify, sign out)
// and their associated loading/error UI state.
interface AuthState {
  // Loading and error states
  isLoading: boolean;
  error: string | null;

  // Magic link flow state
  pendingEmail: string | null;

  // Actions — password auth
  signUpWithPassword: (email: string, password: string) => Promise<SignUpWithPasswordResult>;
  signInWithPassword: (email: string, password: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;

  // Actions — magic link auth
  requestMagicCode: (email: string) => Promise<boolean>;
  verifyMagicCode: (email: string, code: string) => Promise<boolean>;

  // Actions — general
  signOut: () => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

export interface SignUpWithPasswordResult {
  status: 'authenticated' | 'confirmation_required' | 'error';
  error?: string;
}

// Create the authentication store (no persistence — Supabase manages auth tokens)
export const useAuthStore = create<AuthState>()(
  immer(set => ({
    // Initial state
    isLoading: false,
    error: null,
    pendingEmail: null,

    // Actions — password auth
    signUpWithPassword: async (email: string, password: string) => {
      set(state => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const supabase = createClient();
        const language = useLanguageStore.getState().language;
        const { data, error } = await retryTransientAuthFailure(() =>
          supabase.auth.signUp({
            email,
            password,
            options: {
              data: { language },
              emailRedirectTo: getAuthRedirectUrl('/auth/callback'),
            },
          })
        );

        if (error) {
          throw error;
        }

        set(state => {
          state.isLoading = false;
        });

        if (data.session && data.user?.id) {
          return { status: 'authenticated' };
        }

        if (data.user?.identities?.length === 0) {
          const errorMessage = translateText('auth.signUp.emailAlreadyRegistered');
          set(state => {
            state.error = errorMessage;
          });
          return {
            status: 'error',
            error: errorMessage,
          };
        }

        if (data.user?.id) {
          return { status: 'confirmation_required' };
        }

        return {
          status: 'error',
          error: translateText('auth.signUp.signUpFailed'),
        };
      } catch (error) {
        console.error('Failed to sign up:', error);
        const errorMessage = isAlreadyRegisteredAuthError(error)
          ? translateText('auth.signUp.emailAlreadyRegistered')
          : normalizeAuthErrorMessage(error, translateText('auth.signUp.signUpFailed'));
        set(state => {
          state.isLoading = false;
          state.error = errorMessage;
        });
        return {
          status: 'error',
          error: errorMessage,
        };
      }
    },

    signInWithPassword: async (email: string, password: string) => {
      set(state => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const supabase = createClient();
        storePendingGoogleLanguage(useLanguageStore.getState().language);
        const { error } = await retryTransientAuthFailure(() =>
          supabase.auth.signInWithPassword({ email, password })
        );

        if (error) {
          throw error;
        }

        set(state => {
          state.isLoading = false;
        });

        return true;
      } catch (error) {
        console.error('Failed to sign in:', error);
        set(state => {
          state.isLoading = false;
          state.error = normalizeAuthErrorMessage(
            error,
            translateText('auth.signIn.invalidCredentials')
          );
        });
        return false;
      }
    },

    signInWithGoogle: async () => {
      set(state => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const supabase = createClient();
        const { error } = await retryTransientAuthFailure(() =>
          supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: getAuthRedirectUrl('/auth/callback'),
            },
          })
        );

        if (error) {
          throw error;
        }

        set(state => {
          state.isLoading = false;
        });

        return true;
      } catch (error) {
        console.error('Failed to start Google sign in:', error);
        set(state => {
          state.isLoading = false;
          state.error = normalizeAuthErrorMessage(
            error,
            translateText('features.auth.errors.googleSignInFailed')
          );
        });
        return false;
      }
    },

    resetPassword: async (email: string) => {
      set(state => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const supabase = createClient();
        const { error } = await retryTransientAuthFailure(() =>
          supabase.auth.resetPasswordForEmail(email, {
            redirectTo: getAuthRedirectUrl(
              `/auth/callback?next=${encodeURIComponent('/auth/reset-password')}`
            ),
          })
        );

        if (error) {
          throw error;
        }

        set(state => {
          state.isLoading = false;
        });

        return true;
      } catch (error) {
        console.error('Failed to send reset email:', error);
        set(state => {
          state.isLoading = false;
          state.error = normalizeAuthErrorMessage(
            error,
            translateText('auth.forgotPassword.sendFailed')
          );
        });
        return false;
      }
    },

    // Actions — magic link auth
    requestMagicCode: async (email: string) => {
      set(state => {
        state.isLoading = true;
        state.error = null;
        state.pendingEmail = email;
      });

      try {
        const supabase = createClient();
        const language = useLanguageStore.getState().language;
        const { error } = await retryTransientAuthFailure(() =>
          supabase.auth.signInWithOtp({
            email,
            options: {
              data: { language },
              emailRedirectTo: getAuthRedirectUrl('/auth/callback'),
            },
          })
        );

        if (error) {
          throw error;
        }

        set(state => {
          state.isLoading = false;
        });

        return true;
      } catch (error) {
        console.error('Failed to send magic link:', error);
        set(state => {
          state.isLoading = false;
          state.error = normalizeAuthErrorMessage(
            error,
            translateText('features.auth.errors.magicLinkFailed')
          );
        });
        return false;
      }
    },

    verifyMagicCode: async (email: string, code: string) => {
      set(state => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const supabase = createClient();
        const { data, error } = await retryTransientAuthFailure(() =>
          supabase.auth.verifyOtp({
            email,
            token: code,
            type: 'magiclink',
          })
        );

        if (error) {
          throw error;
        }

        if (data.user) {
          set(state => {
            state.isLoading = false;
            state.pendingEmail = null;
          });

          return true;
        } else {
          throw new Error(translateText('features.auth.errors.authenticationFailed'));
        }
      } catch (error) {
        console.error('Failed to verify magic code:', error);
        set(state => {
          state.isLoading = false;
          state.error = normalizeAuthErrorMessage(
            error,
            translateText('features.auth.errors.invalidOrExpiredCode')
          );
        });
        return false;
      }
    },

    signOut: async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
    },

    clearError: () =>
      set(state => {
        state.error = null;
      }),

    setLoading: (loading: boolean) =>
      set(state => {
        state.isLoading = loading;
      }),
  }))
);
