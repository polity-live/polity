import { featureThemeClassName } from '@/features/shared/theme';
import type { FormEventHandler } from 'react';
import { ArrowRight, Mail } from 'lucide-react';

import { FormButton, FormCard, TextField } from '@/features/shared/ui/form';
import { InlineNotice, Spinner } from '@/features/shared/ui/feedback';

interface LoginFormCopy {
  title: string;
  description: string;
  emailLabel: string;
  emailPlaceholder: string;
  sendCode: string;
  sending: string;
  footerNoPassword: string;
  footerCheckEmail: string;
}

interface LoginFormViewProps {
  copy: LoginFormCopy;
  email: string;
  error: string | null;
  isSending: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onEmailChange: (value: string) => void;
}

export function LoginFormView({
  copy,
  email,
  error,
  isSending,
  onSubmit,
  onEmailChange,
}: LoginFormViewProps) {
  return (
    <FormCard
      title={copy.title}
      description={copy.description}
      icon={<Mail className={featureThemeClassName('authForgotPasswordFormInfoIcon')} />}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <TextField
          id="email"
          type="email"
          label={copy.emailLabel}
          placeholder={copy.emailPlaceholder}
          value={email}
          onValueChange={onEmailChange}
          required
          disabled={isSending}
          autoComplete="email"
        />

        {error ? <InlineNotice variant="destructive">{error}</InlineNotice> : null}

        <FormButton type="submit" className="w-full" disabled={isSending || !email}>
          {isSending ? (
            <>
              <Spinner className="mr-2" />
              {copy.sending}
            </>
          ) : (
            <>
              {copy.sendCode}
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </FormButton>
      </form>

      <div className="text-muted-foreground mt-6 text-center text-sm">
        <p>{copy.footerNoPassword}</p>
        <p>{copy.footerCheckEmail}</p>
      </div>
    </FormCard>
  );
}

export type { LoginFormCopy };
