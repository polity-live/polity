import type { FormEventHandler } from 'react';
import { KeyRound } from 'lucide-react';

import { FormButton, FormCard, PasswordField } from '@/features/shared/ui/form';
import { InlineNotice, Spinner } from '@/features/shared/ui/feedback';

interface ResetPasswordFormCopy {
  title: string;
  description: string;
  newPassword: string;
  newPasswordPlaceholder: string;
  confirmPassword: string;
  confirmPasswordPlaceholder: string;
  submit: string;
  submitting: string;
}

interface ResetPasswordFormViewProps {
  copy: ResetPasswordFormCopy;
  password: string;
  confirmPassword: string;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
}

export function ResetPasswordFormView({
  copy,
  password,
  confirmPassword,
  error,
  isSubmitting,
  onSubmit,
  onPasswordChange,
  onConfirmPasswordChange,
}: ResetPasswordFormViewProps) {
  return (
    <FormCard title={copy.title} description={copy.description} icon={<KeyRound />}>
      <form onSubmit={onSubmit} className="space-y-4">
        <PasswordField
          id="reset-password"
          label={copy.newPassword}
          placeholder={copy.newPasswordPlaceholder}
          value={password}
          onValueChange={onPasswordChange}
          autoComplete="new-password"
          minLength={6}
          required
          disabled={isSubmitting}
        />
        <PasswordField
          id="reset-password-confirm"
          label={copy.confirmPassword}
          placeholder={copy.confirmPasswordPlaceholder}
          value={confirmPassword}
          onValueChange={onConfirmPasswordChange}
          autoComplete="new-password"
          minLength={6}
          required
          disabled={isSubmitting}
        />
        {error ? <InlineNotice variant="destructive">{error}</InlineNotice> : null}
        <FormButton
          type="submit"
          className="w-full"
          disabled={!password || !confirmPassword || isSubmitting}
        >
          {isSubmitting ? <Spinner className="mr-2" /> : null}
          {isSubmitting ? copy.submitting : copy.submit}
        </FormButton>
      </form>
    </FormCard>
  );
}

export type { ResetPasswordFormCopy };
