'use client';

import { useVotePasswordInputController } from '@/features/shared/hooks/useVotePasswordInputController';
import { VotePasswordInputView } from './VotePasswordInputView';

export interface VotePasswordInputProps {
  onSubmit: (password: string) => void;
  error?: string | null;
  isLoading?: boolean;
  className?: string;
}

export function VotePasswordInput({
  onSubmit,
  error,
  isLoading,
  className,
}: VotePasswordInputProps) {
  return (
    <VotePasswordInputView
      error={error}
      isLoading={isLoading}
      className={className}
      {...useVotePasswordInputController({ onSubmit, error, isLoading })}
    />
  );
}
