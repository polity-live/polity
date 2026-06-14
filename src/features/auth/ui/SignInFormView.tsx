'use client';

import type { FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, LogIn, Mail } from 'lucide-react';

import { Alert, AlertDescription } from '@/features/shared/ui/ui/alert';
import { Button } from '@/features/shared/ui/ui/button';
import { FormFieldShell } from '@/features/shared/ui/form';
import { Input } from '@/features/shared/ui/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Spinner } from '@/features/shared/ui/ui/spinner';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { GoogleIcon } from './GoogleIcon';

interface SignInFormViewProps {
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
}

export function SignInFormView({
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
}: SignInFormViewProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <LogIn className="text-brand h-12 w-12" />
          </div>
          <CardTitle className="text-2xl font-bold">{t('auth.signIn.title')}</CardTitle>
          <CardDescription>{t('auth.signIn.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormFieldShell
              id="email"
              label={t('auth.signIn.emailLabel')}
              description={t('auth.signIn.emailHint')}
              descriptionClassName={cn(
                'text-xs',
                showEmailError && 'text-destructive',
                showEmailSuccess && 'text-emerald-600 dark:text-emerald-400'
              )}
            >
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  type="email"
                  placeholder={t('auth.signIn.emailPlaceholder')}
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
              label={t('auth.signIn.passwordLabel')}
              labelAction={
                <Link
                  to="/auth/forgot-password"
                  search={{ email: email || undefined }}
                  className="text-muted-foreground hover:text-primary text-xs underline-offset-4 hover:underline"
                >
                  {t('auth.signIn.forgotPassword')}
                </Link>
              }
            >
              {({ id }) => (
                <Input
                  id={id}
                  type="password"
                  placeholder={t('auth.signIn.passwordPlaceholder')}
                  value={password}
                  onChange={event => onPasswordChange(event.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              )}
            </FormFieldShell>

            {displayError ? (
              <Alert variant="destructive">
                <AlertDescription>{displayError}</AlertDescription>
              </Alert>
            ) : null}

            {magicLinkSent ? (
              <Alert>
                <AlertDescription>{t('auth.signIn.magicLinkSent')}</AlertDescription>
              </Alert>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !trimmedEmail || !password || !emailIsValid}
            >
              {isSigningIn ? (
                <>
                  <Spinner className="mr-2" />
                  {t('auth.signIn.submitting')}
                </>
              ) : (
                <>
                  {t('auth.signIn.submit')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <Button
            type="button"
            className="mt-4 w-full border border-[#dadce0] bg-white text-[#3c4043] hover:bg-[#f8f9fa] dark:border-[#5f6368] dark:bg-[#202124] dark:text-[#e8eaed] dark:hover:bg-[#303134]"
            onClick={onGoogleAuth}
            disabled={isLoading}
          >
            {isRedirecting ? <Spinner className="mr-2" /> : <GoogleIcon className="mr-2 h-5 w-5" />}
            {isRedirecting ? t('auth.signIn.googleLoading') : t('auth.signIn.googleButton')}
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card text-muted-foreground px-2">
                {t('auth.signIn.magicLinkAlt')}
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={onMagicLink}
            disabled={isLoading || !trimmedEmail || !emailIsValid}
          >
            <Mail className="mr-2 h-4 w-4" />
            {isSigningIn ? t('auth.signIn.magicLinkSending') : t('auth.signIn.sendCode')}
          </Button>

          <div className="text-muted-foreground mt-6 text-center text-sm">
            <p>
              {t('auth.signIn.noAccount')}{' '}
              <Link
                to="/auth/sign-up"
                className="text-primary font-medium underline-offset-4 hover:underline"
              >
                {t('auth.signIn.signUpLink')}
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
