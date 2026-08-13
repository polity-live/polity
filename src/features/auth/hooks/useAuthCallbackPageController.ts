import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from '@/features/shared/ui/ui/sonner';

import { createClient } from '@/lib/supabase/client';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { consumePendingGoogleLanguage } from '@/features/auth/logic/authLanguage';
import {
  completeAuthCallback,
  type AuthCallbackGateway,
  type AuthCallbackUser,
} from '@/features/auth/logic/authCallbackService';

export function useAuthCallbackPageController() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    let isActive = true;

    const finalizeAuthCallback = async () => {
      try {
        const supabase = createClient();
        const gateway: AuthCallbackGateway = {
          exchangeCodeForSession: async code => {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            return { error };
          },
          getUser: async () => {
            const { data, error } = await supabase.auth.getUser();
            return { user: data.user as AuthCallbackUser | null, error };
          },
          updateLanguage: async language => {
            const { error } = await supabase.auth.updateUser({ data: { language } });
            return { error };
          },
        };
        const outcome = await completeAuthCallback({
          gateway,
          pendingLanguage: consumePendingGoogleLanguage(),
          search: window.location.search,
        });

        if (!outcome.ok) {
          throw new Error(t('auth.callback.failed'));
        }

        if (outcome.isNewUser) {
          sessionStorage.setItem('polity_onboarding', 'true');
        }

        if (isActive) {
          navigate({ to: outcome.destination });
        }
      } catch (error) {
        console.error('Failed to complete auth callback:', error);

        if (isActive) {
          toast.error(t('auth.callback.failed'));
          navigate({ to: '/auth/sign-in' });
        }
      }
    };

    void finalizeAuthCallback();

    return () => {
      isActive = false;
    };
  }, [navigate, t]);
}
