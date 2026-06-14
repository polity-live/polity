// auth.ts
// Supabase authentication implementation using email+password and magic links
// Uses Supabase's built-in auth system

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createClient } from '@/lib/supabase/client';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

const AUTH_SERVICE_UNAVAILABLE_MESSAGE =
  'Authentication service is temporarily unavailable. Please try again in a moment.';
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
    return AUTH_SERVICE_UNAVAILABLE_MESSAGE;
  }

  return getErrorMessage(error) ?? fallback;
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
        const { data, error } = await retryTransientAuthFailure(() =>
          supabase.auth.signUp({ email, password })
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

        if (data.user?.id) {
          return { status: 'confirmation_required' };
        }

        return {
          status: 'error',
          error: 'Failed to create account',
        };
      } catch (error) {
        console.error('Failed to sign up:', error);
        const errorMessage = normalizeAuthErrorMessage(
          error,
          translateText('generated.inline.0023_failed_to_sign_up_c8c619af')
        );
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
          state.error = normalizeAuthErrorMessage(error, 'Invalid email or password');
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
              redirectTo: `${window.location.origin}/auth/callback`,
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
          state.error = normalizeAuthErrorMessage(error, 'Failed to start Google sign in');
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
            redirectTo: `${window.location.origin}/auth/sign-in`,
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
          state.error = normalizeAuthErrorMessage(error, 'Failed to send reset email');
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
        const { error } = await retryTransientAuthFailure(() =>
          supabase.auth.signInWithOtp({ email })
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
          state.error = normalizeAuthErrorMessage(error, 'Failed to send magic link');
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
          throw new Error('Authentication failed');
        }
      } catch (error) {
        console.error('Failed to verify magic code:', error);
        set(state => {
          state.isLoading = false;
          state.error = normalizeAuthErrorMessage(error, 'Invalid or expired code');
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
