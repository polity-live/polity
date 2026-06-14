'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import type { FormEvent } from 'react';
import { ArrowRight, LogIn, Mail } from 'lucide-react';

import { FormButton, FormCard, PasswordField, TextField } from '@/features/shared/ui/form';
import { InlineNotice, Spinner } from '@/features/shared/ui/feedback';
import { cn } from '@/features/shared/utils/utils';
import { GoogleIcon } from '@/features/shared/ui/icons';

interface SignInFormCopy {
  title: string;
  description: string;
  emailLabel: string;
  emailPlaceholder: string;
  emailHint: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  forgotPassword: string;
  magicLinkSent: string;
  submit: string;
  submitting: string;
  googleButton: string;
  googleLoading: string;
  magicLinkAlt: string;
  magicLinkSending: string;
  sendCode: string;
  noAccount: string;
  signUpLink: string;
}

interface SignInFormViewProps {
  copy: SignInFormCopy;
  email: string;
  password: string;
  magicLinkSent: boolean;
  displayError: string | null;
  isLoading: boolean;
  isSigningIn: boolean;
  isRedirecting: boolean;
  trimmedEmail: string;
  emailIsValid: boolean;
  showEmailError: boolean;
  showEmailSuccess: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEmailChange: (value: string) => void;
  onEmailBlur: () => void;
  onPasswordChange: (value: string) => void;
  onMagicLink: () => void;
  onGoogleAuth: () => void;
  onForgotPassword: () => void;
  onGoToSignUp: () => void;
}

export function SignInFormView({
  copy,
  email,
  password,
  magicLinkSent,
  displayError,
  isLoading,
  isSigningIn,
  isRedirecting,
  trimmedEmail,
  emailIsValid,
  showEmailError,
  showEmailSuccess,
  onSubmit,
  onEmailChange,
  onEmailBlur,
  onPasswordChange,
  onMagicLink,
  onGoogleAuth,
  onForgotPassword,
  onGoToSignUp,
}: SignInFormViewProps) {
  return (
    <FormCard
      title={copy.title}
      description={copy.description}
      icon={<LogIn className="text-brand h-12 w-12" />}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <TextField
          id="email"
          type="email"
          label={copy.emailLabel}
          placeholder={copy.emailPlaceholder}
          value={email}
          onValueChange={onEmailChange}
          onBlur={onEmailBlur}
          description={copy.emailHint}
          descriptionClassName={cn(
            'text-xs',
            showEmailError && 'text-destructive',
            showEmailSuccess && featureThemeClassName('authNameStepSuccessText')
          )}
          invalid={showEmailError}
          required
          disabled={isLoading}
          autoComplete="email"
          data-valid={showEmailSuccess ? 'true' : undefined}
        />

        <PasswordField
          id="password"
          label={copy.passwordLabel}
          placeholder={copy.passwordPlaceholder}
          value={password}
          onValueChange={onPasswordChange}
          required
          disabled={isLoading}
          autoComplete="current-password"
          labelAction={
            <FormButton
              type="button"
              variant="link"
              className="text-muted-foreground hover:text-primary h-auto p-0 text-xs"
              onClick={onForgotPassword}
            >
              {copy.forgotPassword}
            </FormButton>
          }
        />

        {displayError ? <InlineNotice variant="destructive">{displayError}</InlineNotice> : null}

        {magicLinkSent ? <InlineNotice variant="success">{copy.magicLinkSent}</InlineNotice> : null}

        <FormButton
          type="submit"
          className="w-full"
          disabled={isLoading || !trimmedEmail || !password || !emailIsValid}
        >
          {isSigningIn ? (
            <>
              <Spinner className="mr-2" />
              {copy.submitting}
            </>
          ) : (
            <>
              {copy.submit}
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </FormButton>
      </form>

      <FormButton
        type="button"
        className={featureThemeClassName('authSignInFormContrastBadge')}
        onClick={onGoogleAuth}
        disabled={isLoading}
      >
        {isRedirecting ? <Spinner className="mr-2" /> : <GoogleIcon className="mr-2 h-5 w-5" />}
        {isRedirecting ? copy.googleLoading : copy.googleButton}
      </FormButton>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card text-muted-foreground px-2">{copy.magicLinkAlt}</span>
        </div>
      </div>

      <FormButton
        variant="outline"
        className="w-full"
        onClick={onMagicLink}
        disabled={isLoading || !trimmedEmail || !emailIsValid}
      >
        <Mail className="mr-2 h-4 w-4" />
        {isSigningIn ? copy.magicLinkSending : copy.sendCode}
      </FormButton>

      <div className="text-muted-foreground mt-6 text-center text-sm">
        <p>
          {copy.noAccount}{' '}
          <FormButton
            type="button"
            variant="link"
            className="h-auto p-0 font-medium"
            onClick={onGoToSignUp}
          >
            {copy.signUpLink}
          </FormButton>
        </p>
      </div>
    </FormCard>
  );
}

export type { SignInFormCopy };
