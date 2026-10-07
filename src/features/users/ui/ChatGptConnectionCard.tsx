import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { createClient } from '@/lib/supabase/client';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useLanguageStore } from '@/features/shared/global-state/language.store';
import { toast } from '@/features/shared/ui/ui/sonner';
import {
  CHATGPT_AUTH_PROVIDER,
  isChatGptLoginEnabled,
  startChatGptAuth,
} from '@/features/auth/logic/chatgptAuth';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';

export function ChatGptConnectionCard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const connected = user?.linkedProviders.includes(CHATGPT_AUTH_PROVIDER) ?? false;
  const enabled = isChatGptLoginEnabled();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('pages.user.ai.chatgpt.title')}</CardTitle>
        <CardDescription>{t('pages.user.ai.chatgpt.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          {t(connected ? 'pages.user.ai.chatgpt.connected' : 'pages.user.ai.chatgpt.disconnected')}
        </p>
        <p className="text-muted-foreground">{t('pages.user.ai.chatgpt.planUnavailable')}</p>
        {!enabled && (
          <p className="text-muted-foreground">{t('pages.user.ai.chatgpt.loginUnavailable')}</p>
        )}
        {!connected && (
          <Button
            type="button"
            variant="outline"
            disabled={!enabled || busy || !user}
            data-action-id="users.ai.chatgpt.link"
            onClick={async () => {
              setBusy(true);
              try {
                await startChatGptAuth(createClient(), {
                  mode: 'link',
                  language: useLanguageStore.getState().language,
                });
              } catch {
                setBusy(false);
                toast.error(t('auth.chatgpt.failed'));
              }
            }}
          >
            {t('pages.user.ai.chatgpt.link')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
