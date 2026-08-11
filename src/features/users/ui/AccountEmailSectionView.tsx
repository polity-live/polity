import { featureThemeClassName } from '@/features/shared/theme';
import type { FormEventHandler } from 'react';
import { Mail } from 'lucide-react';

import { FormButton, SettingsPanel, TextField } from '@/features/shared/ui/form';
import { InlineNotice, Spinner } from '@/features/shared/ui/feedback';
import { cn } from '@/features/shared/utils/utils';

interface AccountEmailSectionCopy {
  title: string;
  description: string;
  currentEmail: string;
  newEmail: string;
  newEmailPlaceholder: string;
  emailHint: string;
  initialPasswordRequired: string;
  update: string;
  updating: string;
}

interface AccountEmailSectionViewProps {
  copy: AccountEmailSectionCopy;
  currentEmailValue: string;
  newEmail: string;
  requiresInitialPassword: boolean;
  isBusy: boolean;
  isValid: boolean;
  error: string | null;
  showEmailError: boolean;
  showEmailSuccess: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onNewEmailChange: (value: string) => void;
  onNewEmailBlur: () => void;
}

export function AccountEmailSectionView({
  copy,
  currentEmailValue,
  newEmail,
  requiresInitialPassword,
  isBusy,
  isValid,
  error,
  showEmailError,
  showEmailSuccess,
  onSubmit,
  onNewEmailChange,
  onNewEmailBlur,
}: AccountEmailSectionViewProps) {
  return (
    <SettingsPanel
      title={copy.title}
      description={copy.description}
      icon={<Mail className="h-5 w-5" />}
    >
      <div className="space-y-4">
        <TextField
          label={copy.currentEmail}
          value={currentEmailValue}
          onValueChange={() => undefined}
          disabled
          className="bg-muted"
        />

        <form onSubmit={onSubmit} className="space-y-4" data-action-id="users.account.email.submit">
          {requiresInitialPassword ? (
            <p className="text-muted-foreground text-sm">{copy.initialPasswordRequired}</p>
          ) : null}
          <TextField
            id="new-email"
            type="email"
            label={copy.newEmail}
            placeholder={copy.newEmailPlaceholder}
            value={newEmail}
            onValueChange={onNewEmailChange}
            onBlur={onNewEmailBlur}
            description={copy.emailHint}
            descriptionClassName={cn(
              'text-xs',
              showEmailError && 'text-destructive',
              showEmailSuccess && featureThemeClassName('authNameStepSuccessText')
            )}
            invalid={showEmailError}
            required
            disabled={isBusy}
            autoComplete="email"
            data-valid={showEmailSuccess ? 'true' : undefined}
          />

          {error ? <InlineNotice variant="destructive">{error}</InlineNotice> : null}

          <FormButton
            type="submit"
            disabled={!isValid || isBusy}
            data-action-id="users.account.email.submit"
          >
            {isBusy ? <Spinner className="mr-2" /> : null}
            {isBusy ? copy.updating : copy.update}
          </FormButton>
        </form>
      </div>
    </SettingsPanel>
  );
}

export type { AccountEmailSectionCopy };
