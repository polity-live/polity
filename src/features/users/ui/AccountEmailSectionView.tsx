import type { FormEventHandler } from 'react';
import { Mail } from 'lucide-react';

import {
  FormButton,
  FormControlInput,
  FormFieldShell,
  SettingsPanel,
  TextField,
} from '@/features/shared/ui/form';
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

        {requiresInitialPassword ? (
          <p className="text-muted-foreground text-sm">{copy.initialPasswordRequired}</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <FormFieldShell
              id="new-email"
              label={copy.newEmail}
              description={copy.emailHint}
              descriptionClassName={cn(
                'text-xs',
                showEmailError && 'text-destructive',
                showEmailSuccess && 'text-emerald-600 dark:text-emerald-400'
              )}
              invalid={showEmailError}
            >
              {({ id, describedBy, invalid }) => (
                <FormControlInput
                  id={id}
                  type="email"
                  placeholder={copy.newEmailPlaceholder}
                  value={newEmail}
                  onChange={event => onNewEmailChange(event.target.value)}
                  onBlur={onNewEmailBlur}
                  required
                  disabled={isBusy}
                  autoComplete="email"
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  data-valid={showEmailSuccess ? 'true' : undefined}
                />
              )}
            </FormFieldShell>

            {error ? <InlineNotice variant="destructive">{error}</InlineNotice> : null}

            <FormButton type="submit" disabled={!isValid || isBusy}>
              {isBusy ? <Spinner className="mr-2" /> : null}
              {isBusy ? copy.updating : copy.update}
            </FormButton>
          </form>
        )}
      </div>
    </SettingsPanel>
  );
}

export type { AccountEmailSectionCopy };
