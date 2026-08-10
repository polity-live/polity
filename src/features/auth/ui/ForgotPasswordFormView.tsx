import { featureThemeClassName } from '@/features/shared/theme';
import type { FormEventHandler } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';

import { FormButton, FormCard, TextField } from '@/features/shared/ui/form';
import { InlineNotice, Spinner } from '@/features/shared/ui/feedback';

interface ForgotPasswordFormCopy {
  title: string;
  description: string;
  successTitle: string;
  successDescription: string;
  emailLabel: string;
  emailPlaceholder: string;
  submit: string;
  submitting: string;
  backToSignIn: string;
}

interface ForgotPasswordFormViewProps {
  copy: ForgotPasswordFormCopy;
  email: string;
  sent: boolean;
  displayError: string | null;
  isSubmitting: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onEmailChange: (value: string) => void;
  onBackToSignIn: () => void;
}

export function ForgotPasswordFormView({
  copy,
  email,
  sent,
  displayError,
  isSubmitting,
  onSubmit,
  onEmailChange,
  onBackToSignIn,
}: ForgotPasswordFormViewProps) {
  return (
    <FormCard
      title={sent ? copy.successTitle : copy.title}
      description={
        sent ? (
          <>
            {copy.successDescription} <strong>{email}</strong>
          </>
        ) : (
          copy.description
        )
      }
      icon={
        sent ? (
          <CheckCircle2 className={featureThemeClassName('authForgotPasswordFormSuccessIcon')} />
        ) : (
          <KeyRound className={featureThemeClassName('authForgotPasswordFormInfoIcon')} />
        )
      }
    >
      {sent ? (
        <FormButton
          data-action-id="auth.forgot-password.navigate.sign-in"
          type="button"
          variant="outline"
          className="w-full"
          onClick={onBackToSignIn}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {copy.backToSignIn}
        </FormButton>
      ) : (
        <>
          <form
            data-action-id="auth.forgot-password.submit.reset"
            onSubmit={onSubmit}
            className="space-y-4"
          >
            <TextField
              id="email"
              type="email"
              label={copy.emailLabel}
              placeholder={copy.emailPlaceholder}
              value={email}
              onValueChange={onEmailChange}
              required
              disabled={isSubmitting}
              autoComplete="email"
            />

            {displayError ? (
              <InlineNotice variant="destructive">{displayError}</InlineNotice>
            ) : null}

            <FormButton
              data-action-id="auth.forgot-password.submit.reset"
              type="submit"
              className="w-full"
              disabled={isSubmitting || !email}
            >
              {isSubmitting ? (
                <>
                  <Spinner className="mr-2" />
                  {copy.submitting}
                </>
              ) : (
                copy.submit
              )}
            </FormButton>
          </form>

          <div className="text-muted-foreground mt-6 text-center text-sm">
            <FormButton
              data-action-id="auth.forgot-password.navigate.sign-in"
              type="button"
              variant="link"
              className="h-auto p-0 font-medium"
              onClick={onBackToSignIn}
            >
              <ArrowLeft className="mr-1 inline h-3 w-3" />
              {copy.backToSignIn}
            </FormButton>
          </div>
        </>
      )}
    </FormCard>
  );
}

export type { ForgotPasswordFormCopy };
