import type { FormEventHandler } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Mail, MailCheck, UserPlus } from 'lucide-react';

import { Alert, AlertDescription } from '@/features/shared/ui/ui/alert';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Input } from '@/features/shared/ui/ui/input';
import { Spinner } from '@/features/shared/ui/ui/spinner';
import { FormFieldShell } from '@/features/shared/ui/form';
import { cn } from '@/features/shared/utils/utils';
import { GoogleIcon } from './GoogleIcon';

interface SignUpFormCopy {
  title: string;
  description: string;
  emailLabel: string;
  emailPlaceholder: string;
  emailHint: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  passwordHint: string;
  confirmPasswordLabel: string;
  confirmPasswordPlaceholder: string;
  confirmPasswordHint: string;
  submit: string;
  submitting: string;
  googleButton: string;
  googleLoading: string;
  magicLinkAlt: string;
  magicLinkSending: string;
  sendCode: string;
  hasAccount: string;
  signInLink: string;
  confirmationPendingTitle: string;
  confirmationPendingDescription: string;
  confirmationPendingInstructions: string;
  useDifferentEmail: string;
}

interface SignUpFormViewProps {
  copy: SignUpFormCopy;
  email: string;
  password: string;
  confirmPassword: string;
  pendingConfirmationEmail: string | null;
  displayError: string | null;
  isLoading: boolean;
  isSigningUp: boolean;
  isRedirecting: boolean;
  isSendingMagicLink: boolean;
  isFormValid: boolean;
  magicLinkDisabled: boolean;
  showEmailError: boolean;
  showEmailSuccess: boolean;
  showPasswordError: boolean;
  showPasswordSuccess: boolean;
  showConfirmPasswordError: boolean;
  showConfirmPasswordSuccess: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onEmailChange: (value: string) => void;
  onEmailBlur: () => void;
  onPasswordChange: (value: string) => void;
  onPasswordBlur: () => void;
  onConfirmPasswordChange: (value: string) => void;
  onConfirmPasswordBlur: () => void;
  onGoogleAuth: () => void;
  onMagicLink: () => void;
  onGoToSignIn: () => void;
  onUseDifferentEmail: () => void;
}

function fieldHintClassName(hasError: boolean, hasSuccess: boolean) {
  return cn(
    'text-xs',
    hasError && 'text-destructive',
    hasSuccess && 'text-emerald-600 dark:text-emerald-400'
  );
}

export function SignUpFormView({
  copy,
  email,
  password,
  confirmPassword,
  pendingConfirmationEmail,
  displayError,
  isLoading,
  isSigningUp,
  isRedirecting,
  isSendingMagicLink,
  isFormValid,
  magicLinkDisabled,
  showEmailError,
  showEmailSuccess,
  showPasswordError,
  showPasswordSuccess,
  showConfirmPasswordError,
  showConfirmPasswordSuccess,
  onSubmit,
  onEmailChange,
  onEmailBlur,
  onPasswordChange,
  onPasswordBlur,
  onConfirmPasswordChange,
  onConfirmPasswordBlur,
  onGoogleAuth,
  onMagicLink,
  onGoToSignIn,
  onUseDifferentEmail,
}: SignUpFormViewProps) {
  if (pendingConfirmationEmail) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mb-4 flex justify-center">
              <MailCheck className="h-12 w-12 text-blue-500" />
            </div>
            <CardTitle className="text-2xl font-bold">{copy.confirmationPendingTitle}</CardTitle>
            <CardDescription>{copy.confirmationPendingDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>{copy.confirmationPendingInstructions}</AlertDescription>
            </Alert>

            <Button className="w-full" onClick={onGoToSignIn}>
              {copy.signInLink}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onUseDifferentEmail}
            >
              {copy.useDifferentEmail}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <UserPlus className="h-12 w-12 text-blue-500" />
          </div>
          <CardTitle className="text-2xl font-bold">{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormFieldShell
              id="email"
              label={copy.emailLabel}
              description={copy.emailHint}
              descriptionClassName={fieldHintClassName(showEmailError, showEmailSuccess)}
              invalid={showEmailError}
              required
            >
              {({ id, describedBy, invalid }) => (
                <Input
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
                  aria-invalid={invalid}
                  data-valid={showEmailSuccess ? 'true' : undefined}
                />
              )}
            </FormFieldShell>

            <FormFieldShell
              id="password"
              label={copy.passwordLabel}
              description={copy.passwordHint}
              descriptionClassName={fieldHintClassName(showPasswordError, showPasswordSuccess)}
              invalid={showPasswordError}
              required
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  type="password"
                  placeholder={copy.passwordPlaceholder}
                  value={password}
                  onChange={event => onPasswordChange(event.target.value)}
                  onBlur={onPasswordBlur}
                  required
                  minLength={6}
                  disabled={isLoading}
                  autoComplete="new-password"
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  data-valid={showPasswordSuccess ? 'true' : undefined}
                />
              )}
            </FormFieldShell>

            <FormFieldShell
              id="confirm-password"
              label={copy.confirmPasswordLabel}
              description={copy.confirmPasswordHint}
              descriptionClassName={fieldHintClassName(
                showConfirmPasswordError,
                showConfirmPasswordSuccess
              )}
              invalid={showConfirmPasswordError}
              required
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  type="password"
                  placeholder={copy.confirmPasswordPlaceholder}
                  value={confirmPassword}
                  onChange={event => onConfirmPasswordChange(event.target.value)}
                  onBlur={onConfirmPasswordBlur}
                  required
                  minLength={6}
                  disabled={isLoading}
                  autoComplete="new-password"
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  data-valid={showConfirmPasswordSuccess ? 'true' : undefined}
                />
              )}
            </FormFieldShell>

            {displayError ? (
              <Alert variant="destructive">
                <AlertDescription>{displayError}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" className="w-full" disabled={isLoading || !isFormValid}>
              {isSigningUp ? (
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
            </Button>
          </form>

          <Button
            type="button"
            className="mt-4 w-full border border-[#dadce0] bg-white text-[#3c4043] hover:bg-[#f8f9fa] dark:border-[#5f6368] dark:bg-[#202124] dark:text-[#e8eaed] dark:hover:bg-[#303134]"
            onClick={onGoogleAuth}
            disabled={isLoading}
          >
            {isRedirecting ? <Spinner className="mr-2" /> : <GoogleIcon className="mr-2 h-5 w-5" />}
            {isRedirecting ? copy.googleLoading : copy.googleButton}
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card text-muted-foreground px-2">{copy.magicLinkAlt}</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onMagicLink}
            disabled={magicLinkDisabled}
          >
            {isSendingMagicLink ? <Spinner className="mr-2" /> : <Mail className="mr-2 h-4 w-4" />}
            {isSendingMagicLink ? copy.magicLinkSending : copy.sendCode}
          </Button>

          <div className="text-muted-foreground mt-6 text-center text-sm">
            <p>
              {copy.hasAccount}{' '}
              <Link
                to="/auth/sign-in"
                className="text-primary font-medium underline-offset-4 hover:underline"
              >
                {copy.signInLink}
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export type { SignUpFormCopy };
