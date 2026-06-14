import type React from 'react';

import { CurrentPasswordConfirmationDialog } from './CurrentPasswordConfirmationDialog';
import { VotingPasswordTabView } from './VotingPasswordTabView';

interface VotingPasswordTabShellViewProps {
  votingPasswordProps: React.ComponentProps<typeof VotingPasswordTabView>;
  confirmationDialogProps: React.ComponentProps<typeof CurrentPasswordConfirmationDialog>;
  requiresInitialPassword: boolean;
}

export function VotingPasswordTabShellView({
  votingPasswordProps,
  confirmationDialogProps,
  requiresInitialPassword,
}: VotingPasswordTabShellViewProps) {
  return (
    <>
      <VotingPasswordTabView {...votingPasswordProps} />
      {requiresInitialPassword ? null : (
        <CurrentPasswordConfirmationDialog {...confirmationDialogProps} />
      )}
    </>
  );
}
