import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from '@/features/shared/ui/ui/sonner';

import { createClient } from '@/lib/supabase/client';
import { useTranslation } from '@/features/shared/hooks/use-translation';

export function useAuthCallbackPageController() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    let isActive = true;

    const finalizeGoogleAuth = async () => {
      try {
        const supabase = createClient();
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get('code');

        if (code) {
          try {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              console.warn('Code exchange failed, falling back to session check:', error.message);
            }
          } catch (exchangeError) {
            console.warn('Code exchange threw, falling back to session check:', exchangeError);
          }
        }

        let user = (await supabase.auth.getUser()).data.user;

        if (!user?.id) {
          await new Promise(resolve => setTimeout(resolve, 500));
          user = (await supabase.auth.getUser()).data.user;
        }

        if (!user?.id) {
          throw new Error(t('auth.callback.failed'));
        }

        const createdAt = new Date(user.created_at).getTime();
        const isNewUser = Date.now() - createdAt < 300_000;

        if (isNewUser) {
          sessionStorage.setItem('polity_onboarding', 'true');
        }

        if (isActive) {
          navigate({ to: '/' });
        }
      } catch (error) {
        console.error('Failed to complete auth callback:', error);

        if (isActive) {
          toast.error(t('auth.callback.failed'));
          navigate({ to: '/auth/sign-in' });
        }
      }
    };

    void finalizeGoogleAuth();

    return () => {
      isActive = false;
    };
  }, [navigate, t]);
}
