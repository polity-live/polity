'use client';

import { useVotePasswordInputController } from '@/features/shared/hooks/useVotePasswordInputController';
import { VotePasswordInputView } from './VotePasswordInputView';

export interface VotePasswordInputProps {
  'data-action-id'?: string;
  'data-action-scope'?: 'presentation';
  onSubmit: (password: string) => void;
  error?: string | null;
  noVotingPasswordSettingsHref?: string;
  isLoading?: boolean;
  className?: string;
}

export function VotePasswordInput({
  'data-action-id': actionId,
  'data-action-scope': _actionScope,
  onSubmit,
  error,
  noVotingPasswordSettingsHref,
  isLoading,
  className,
}: VotePasswordInputProps) {
  void _actionScope;
  return (
    <VotePasswordInputView
      error={error}
      noVotingPasswordSettingsHref={noVotingPasswordSettingsHref}
      isLoading={isLoading}
      className={className}
      data-action-id={actionId}
      {...useVotePasswordInputController({ onSubmit, error, isLoading })}
    />
  );
}
