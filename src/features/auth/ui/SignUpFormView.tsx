import type { FormEventHandler } from 'react';
import { ArrowRight, Mail, MailCheck, UserPlus } from 'lucide-react';

import { FormButton, FormCard, PasswordField, TextField } from '@/features/shared/ui/form';
import { InlineNotice, Spinner } from '@/features/shared/ui/feedback';
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
      <FormCard
        title={copy.confirmationPendingTitle}
        description={copy.confirmationPendingDescription}
        icon={<MailCheck className="h-12 w-12 text-blue-500" />}
        contentClassName="space-y-4"
      >
        <InlineNotice variant="info">{copy.confirmationPendingInstructions}</InlineNotice>

        <FormButton className="w-full" onClick={onGoToSignIn}>
          {copy.signInLink}
        </FormButton>

        <FormButton
          type="button"
          variant="outline"
          className="w-full"
          onClick={onUseDifferentEmail}
        >
          {copy.useDifferentEmail}
        </FormButton>
      </FormCard>
    );
  }

  return (
    <FormCard
      title={copy.title}
      description={copy.description}
      icon={<UserPlus className="h-12 w-12 text-blue-500" />}
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
          descriptionClassName={fieldHintClassName(showEmailError, showEmailSuccess)}
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
          onBlur={onPasswordBlur}
          description={copy.passwordHint}
          descriptionClassName={fieldHintClassName(showPasswordError, showPasswordSuccess)}
          invalid={showPasswordError}
          required
          minLength={6}
          disabled={isLoading}
          autoComplete="new-password"
          data-valid={showPasswordSuccess ? 'true' : undefined}
        />

        <PasswordField
          id="confirm-password"
          label={copy.confirmPasswordLabel}
          placeholder={copy.confirmPasswordPlaceholder}
          value={confirmPassword}
          onValueChange={onConfirmPasswordChange}
          onBlur={onConfirmPasswordBlur}
          description={copy.confirmPasswordHint}
          descriptionClassName={fieldHintClassName(
            showConfirmPasswordError,
            showConfirmPasswordSuccess
          )}
          invalid={showConfirmPasswordError}
          required
          minLength={6}
          disabled={isLoading}
          autoComplete="new-password"
          data-valid={showConfirmPasswordSuccess ? 'true' : undefined}
        />

        {displayError ? <InlineNotice variant="destructive">{displayError}</InlineNotice> : null}

        <FormButton type="submit" className="w-full" disabled={isLoading || !isFormValid}>
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
        type="button"
        variant="outline"
        className="w-full"
        onClick={onMagicLink}
        disabled={magicLinkDisabled}
      >
        {isSendingMagicLink ? <Spinner className="mr-2" /> : <Mail className="mr-2 h-4 w-4" />}
        {isSendingMagicLink ? copy.magicLinkSending : copy.sendCode}
      </FormButton>

      <div className="text-muted-foreground mt-6 text-center text-sm">
        <p>
          {copy.hasAccount}{' '}
          <FormButton
            type="button"
            variant="link"
            className="h-auto p-0 font-medium"
            onClick={onGoToSignIn}
          >
            {copy.signInLink}
          </FormButton>
        </p>
      </div>
    </FormCard>
  );
}

export type { SignUpFormCopy };
