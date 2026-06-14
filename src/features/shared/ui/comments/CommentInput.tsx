'use client';

import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { useCommentInputController } from '@/features/shared/hooks/useCommentInputController';
import { CommentInputView } from './CommentInputView';

interface CommentInputProps {
  onSubmit: (text: string) => Promise<void>;
  placeholder?: string;
  replyTo?: string;
  onCancelReply?: () => void;
  isSubmitting?: boolean;
  className?: string;
}

export function CommentInput({
  onSubmit,
  placeholder = translateText('generated.inline.0146_write_a_comment_7b01f9dc'),
  replyTo,
  onCancelReply,
  isSubmitting: isSubmittingProp = false,
  className,
}: CommentInputProps) {
  return (
    <CommentInputView
      placeholder={placeholder}
      replyTo={replyTo}
      onCancelReply={onCancelReply}
      className={className}
      {...useCommentInputController({ onSubmit, isSubmitting: isSubmittingProp })}
    />
  );
}
