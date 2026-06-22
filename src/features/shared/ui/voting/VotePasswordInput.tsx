'use client';

import { useVotePasswordInputController } from '@/features/shared/hooks/useVotePasswordInputController';
import { VotePasswordInputView } from './VotePasswordInputView';

export interface VotePasswordInputProps {
  onSubmit: (password: string) => void;
  error?: string | null;
  noVotingPasswordSettingsHref?: string;
  isLoading?: boolean;
  className?: string;
}

export function VotePasswordInput({
  onSubmit,
  error,
  noVotingPasswordSettingsHref,
  isLoading,
  className,
}: VotePasswordInputProps) {
  return (
    <VotePasswordInputView
      error={error}
      noVotingPasswordSettingsHref={noVotingPasswordSettingsHref}
      isLoading={isLoading}
      className={className}
      {...useVotePasswordInputController({ onSubmit, error, isLoading })}
    />
  );
}
