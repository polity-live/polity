import { useState } from 'react';
import { FormButton } from '@/features/shared/ui/form';
import { createClient } from '@/lib/supabase/client';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useLanguageStore } from '@/features/shared/global-state/language.store';
import { toast } from '@/features/shared/ui/ui/sonner';
import { isChatGptLoginEnabled, startChatGptAuth } from '../logic/chatgptAuth';

export function ChatGptLoginButton({ disabled = false }: { disabled?: boolean }) {
  const { t } = useTranslation();
  const [redirecting, setRedirecting] = useState(false);
  if (!isChatGptLoginEnabled()) return null;
  return (
    <FormButton
      type="button"
      disabled={disabled || redirecting}
      data-action-id="auth.authenticate.chatgpt"
      onClick={async () => {
        setRedirecting(true);
        try {
          await startChatGptAuth(createClient(), {
            mode: 'login',
            language: useLanguageStore.getState().language,
          });
        } catch {
          setRedirecting(false);
          toast.error(t('auth.chatgpt.failed'));
        }
      }}
    >
      {t(redirecting ? 'auth.chatgpt.loading' : 'auth.chatgpt.button')}
    </FormButton>
  );
}
