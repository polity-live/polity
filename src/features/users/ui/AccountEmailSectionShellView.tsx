import type React from 'react';

import { CurrentPasswordConfirmationDialog } from './CurrentPasswordConfirmationDialog';
import { AccountEmailSectionView } from './AccountEmailSectionView';

interface AccountEmailSectionShellViewProps {
  accountEmailProps: React.ComponentProps<typeof AccountEmailSectionView>;
  confirmationDialogProps: React.ComponentProps<typeof CurrentPasswordConfirmationDialog>;
  requiresInitialPassword: boolean;
}

export function AccountEmailSectionShellView({
  accountEmailProps,
  confirmationDialogProps,
  requiresInitialPassword,
}: AccountEmailSectionShellViewProps) {
  return (
    <>
      <AccountEmailSectionView {...accountEmailProps} />
      {requiresInitialPassword ? null : (
        <CurrentPasswordConfirmationDialog {...confirmationDialogProps} />
      )}
    </>
  );
}
