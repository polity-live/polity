import type { FormEventHandler } from 'react';
import { KeyRound } from 'lucide-react';

import {
  FormButton,
  FormControlInput,
  FormFieldShell,
  SettingsPanel,
} from '@/features/shared/ui/form';
import { InlineNotice, Spinner } from '@/features/shared/ui/feedback';
import { cn } from '@/features/shared/utils/utils';

interface AccountPasswordSectionCopy {
  title: string;
  description: string;
  initialDescription: string;
  newPassword: string;
  newPasswordPlaceholder: string;
  passwordHint: string;
  confirmPassword: string;
  confirmPasswordPlaceholder: string;
  confirmPasswordHint: string;
  initialHelp: string;
  update: string;
  updating: string;
  setInitialPassword: string;
}

interface AccountPasswordSectionViewProps {
  copy: AccountPasswordSectionCopy;
  password: string;
  confirmPassword: string;
  requiresInitialPassword: boolean;
  isBusy: boolean;
  isValid: boolean;
  error: string | null;
  showPasswordError: boolean;
  showPasswordSuccess: boolean;
  showConfirmPasswordError: boolean;
  showConfirmPasswordSuccess: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onPasswordChange: (value: string) => void;
  onPasswordBlur: () => void;
  onConfirmPasswordChange: (value: string) => void;
  onConfirmPasswordBlur: () => void;
}

export function AccountPasswordSectionView({
  copy,
  password,
  confirmPassword,
  requiresInitialPassword,
  isBusy,
  isValid,
  error,
  showPasswordError,
  showPasswordSuccess,
  showConfirmPasswordError,
  showConfirmPasswordSuccess,
  onSubmit,
  onPasswordChange,
  onPasswordBlur,
  onConfirmPasswordChange,
  onConfirmPasswordBlur,
}: AccountPasswordSectionViewProps) {
  return (
    <SettingsPanel
      title={copy.title}
      description={requiresInitialPassword ? copy.initialDescription : copy.description}
      icon={<KeyRound className="h-5 w-5" />}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <FormFieldShell
          id="account-password"
          label={copy.newPassword}
          description={copy.passwordHint}
          descriptionClassName={cn(
            'text-xs',
            showPasswordError && 'text-destructive',
            showPasswordSuccess && 'text-emerald-600 dark:text-emerald-400'
          )}
          invalid={showPasswordError}
        >
          {({ id, describedBy, invalid }) => (
            <FormControlInput
              id={id}
              type="password"
              placeholder={copy.newPasswordPlaceholder}
              value={password}
              onChange={event => onPasswordChange(event.target.value)}
              onBlur={onPasswordBlur}
              minLength={6}
              required
              disabled={isBusy}
              autoComplete="new-password"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              data-valid={showPasswordSuccess ? 'true' : undefined}
            />
          )}
        </FormFieldShell>

        <FormFieldShell
          id="account-password-confirm"
          label={copy.confirmPassword}
          description={copy.confirmPasswordHint}
          descriptionClassName={cn(
            'text-xs',
            showConfirmPasswordError && 'text-destructive',
            showConfirmPasswordSuccess && 'text-emerald-600 dark:text-emerald-400'
          )}
          invalid={showConfirmPasswordError}
        >
          {({ id, describedBy, invalid }) => (
            <FormControlInput
              id={id}
              type="password"
              placeholder={copy.confirmPasswordPlaceholder}
              value={confirmPassword}
              onChange={event => onConfirmPasswordChange(event.target.value)}
              onBlur={onConfirmPasswordBlur}
              minLength={6}
              required
              disabled={isBusy}
              autoComplete="new-password"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              data-valid={showConfirmPasswordSuccess ? 'true' : undefined}
            />
          )}
        </FormFieldShell>

        {requiresInitialPassword ? (
          <p className="text-muted-foreground text-sm">{copy.initialHelp}</p>
        ) : null}

        {error ? <InlineNotice variant="destructive">{error}</InlineNotice> : null}

        <FormButton type="submit" disabled={!isValid || isBusy}>
          {isBusy ? <Spinner className="mr-2" /> : null}
          {isBusy ? copy.updating : requiresInitialPassword ? copy.setInitialPassword : copy.update}
        </FormButton>
      </form>
    </SettingsPanel>
  );
}

export type { AccountPasswordSectionCopy };
