import type { FormEventHandler } from 'react';
import { AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';

import {
  FormButton,
  FormControlInput,
  FormFieldShell,
  SettingsPanel,
} from '@/features/shared/ui/form';
import { InlineNotice, Spinner } from '@/features/shared/ui/feedback';
import { BadgeControl } from '@/features/shared/ui/status';
import { cn } from '@/features/shared/utils/utils';

interface VotingPasswordTabCopy {
  title: string;
  description: string;
  set: string;
  notSet: string;
  initialPasswordRequired: string;
  newPassword: string;
  setPassword: string;
  confirmPassword: string;
  passwordHint: string;
  confirmPasswordHint: string;
  update: string;
  save: string;
}

interface VotingPasswordTabViewProps {
  copy: VotingPasswordTabCopy;
  hasVotingPassword: boolean;
  stateLoading: boolean;
  requiresInitialPassword: boolean;
  password: string;
  confirmPassword: string;
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

export function VotingPasswordTabView({
  copy,
  hasVotingPassword,
  stateLoading,
  requiresInitialPassword,
  password,
  confirmPassword,
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
}: VotingPasswordTabViewProps) {
  return (
    <div className="space-y-6">
      <SettingsPanel
        title={copy.title}
        description={copy.description}
        icon={<KeyRound className="h-5 w-5" />}
        action={
          !stateLoading ? (
            <BadgeControl variant={hasVotingPassword ? 'default' : 'secondary'}>
              {hasVotingPassword ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {copy.set}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {copy.notSet}
                </span>
              )}
            </BadgeControl>
          ) : null
        }
      >
        {requiresInitialPassword ? (
          <p className="text-muted-foreground text-sm">{copy.initialPasswordRequired}</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <FormFieldShell
              id="voting-password"
              label={hasVotingPassword ? copy.newPassword : copy.setPassword}
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
                  inputMode="numeric"
                  maxLength={4}
                  pattern="\d{4}"
                  placeholder="••••"
                  value={password}
                  onChange={event => onPasswordChange(event.target.value)}
                  onBlur={onPasswordBlur}
                  required
                  disabled={isBusy}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  data-valid={showPasswordSuccess ? 'true' : undefined}
                />
              )}
            </FormFieldShell>

            <FormFieldShell
              id="confirm-voting-password"
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
                  inputMode="numeric"
                  maxLength={4}
                  pattern="\d{4}"
                  placeholder="••••"
                  value={confirmPassword}
                  onChange={event => onConfirmPasswordChange(event.target.value)}
                  onBlur={onConfirmPasswordBlur}
                  required
                  disabled={isBusy}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  data-valid={showConfirmPasswordSuccess ? 'true' : undefined}
                />
              )}
            </FormFieldShell>

            {error ? <InlineNotice variant="destructive">{error}</InlineNotice> : null}

            <FormButton type="submit" disabled={!isValid || isBusy}>
              {isBusy ? <Spinner className="mr-2" /> : null}
              {hasVotingPassword ? copy.update : copy.save}
            </FormButton>
          </form>
        )}
      </SettingsPanel>
    </div>
  );
}

export type { VotingPasswordTabCopy };
