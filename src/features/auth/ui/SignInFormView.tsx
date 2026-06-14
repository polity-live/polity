'use client';

import type { FormEvent } from 'react';
import { ArrowRight, LogIn, Mail } from 'lucide-react';

import { FormButton, FormCard, FormControlInput, FormFieldShell } from '@/features/shared/ui/form';
import { InlineNotice, Spinner } from '@/features/shared/ui/feedback';
import { cn } from '@/features/shared/utils/utils';
import { GoogleIcon } from './GoogleIcon';

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
        <FormFieldShell
          id="email"
          label={copy.emailLabel}
          description={copy.emailHint}
          descriptionClassName={cn(
            'text-xs',
            showEmailError && 'text-destructive',
            showEmailSuccess && 'text-emerald-600 dark:text-emerald-400'
          )}
        >
          {({ id, describedBy }) => (
            <FormControlInput
              id={id}
              type="email"
              placeholder={copy.emailPlaceholder}
              value={email}
              onChange={event => onEmailChange(event.target.value)}
              onBlur={onEmailBlur}
              required
              disabled={isLoading}
              autoComplete="email"
              aria-describedby={describedBy}
              aria-invalid={showEmailError}
              data-valid={showEmailSuccess ? 'true' : undefined}
            />
          )}
        </FormFieldShell>

        <FormFieldShell
          id="password"
          label={copy.passwordLabel}
          labelAction={
            <button
              type="button"
              className="text-muted-foreground hover:text-primary text-xs underline-offset-4 hover:underline"
              onClick={onForgotPassword}
            >
              {copy.forgotPassword}
            </button>
          }
        >
          {({ id }) => (
            <FormControlInput
              id={id}
              type="password"
              placeholder={copy.passwordPlaceholder}
              value={password}
              onChange={event => onPasswordChange(event.target.value)}
              required
              disabled={isLoading}
              autoComplete="current-password"
            />
          )}
        </FormFieldShell>

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
        className="mt-4 w-full border border-[#dadce0] bg-white text-[#3c4043] hover:bg-[#f8f9fa] dark:border-[#5f6368] dark:bg-[#202124] dark:text-[#e8eaed] dark:hover:bg-[#303134]"
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
          <button
            type="button"
            className="text-primary font-medium underline-offset-4 hover:underline"
            onClick={onGoToSignUp}
          >
            {copy.signUpLink}
          </button>
        </p>
      </div>
    </FormCard>
  );
}

export type { SignInFormCopy };
