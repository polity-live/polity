import type React from 'react';

import { CurrentPasswordConfirmationDialog } from './CurrentPasswordConfirmationDialog';
import { AccountPasswordSectionView } from './AccountPasswordSectionView';

interface AccountPasswordSectionShellViewProps {
  accountPasswordProps: React.ComponentProps<typeof AccountPasswordSectionView>;
  confirmationDialogProps: React.ComponentProps<typeof CurrentPasswordConfirmationDialog>;
  requiresInitialPassword: boolean;
}

export function AccountPasswordSectionShellView({
  accountPasswordProps,
  confirmationDialogProps,
  requiresInitialPassword,
}: AccountPasswordSectionShellViewProps) {
  return (
    <>
      <AccountPasswordSectionView {...accountPasswordProps} />
      {requiresInitialPassword ? null : (
        <CurrentPasswordConfirmationDialog {...confirmationDialogProps} />
      )}
    </>
  );
}
