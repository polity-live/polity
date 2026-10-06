import { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from '@/features/shared/ui/ui/sonner';

import { createClient } from '@/lib/supabase/client';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { consumePendingGoogleLanguage } from '@/features/auth/logic/authLanguage';
import { consumeChatGptLinkUser } from '@/features/auth/logic/chatgptAuth';
import {
  completeAuthCallback,
  type AuthCallbackGateway,
  type AuthCallbackUser,
  type AuthCallbackOutcome,
} from '@/features/auth/logic/authCallbackService';

export function useAuthCallbackPageController() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const completion = useRef<Promise<AuthCallbackOutcome> | null>(null);
  const linkUserId = useRef<string | null>(null);

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
        if (!completion.current) {
          linkUserId.current = consumeChatGptLinkUser();
          completion.current = completeAuthCallback({
            gateway,
            pendingLanguage: consumePendingGoogleLanguage(),
            search: window.location.search,
            expectedLinkUserId: linkUserId.current,
          });
        }
        const outcome = await completion.current;

        if (!outcome.ok) {
          throw new Error(t('auth.callback.failed'));
        }

        if (outcome.isNewUser) {
          sessionStorage.setItem('polity_onboarding', 'true');
        }

        if (isActive) {
          if (
            new URLSearchParams(window.location.search).get('chatgpt') === 'link' &&
            linkUserId.current
          ) {
            navigate({
              to: '/user/$id/settings',
              params: { id: linkUserId.current },
              search: { tab: 'ai' },
            });
          } else {
            navigate({ to: outcome.destination });
          }
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
