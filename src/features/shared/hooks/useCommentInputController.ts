import type { KeyboardEvent } from 'react';
import { useState } from 'react';

interface UseCommentInputControllerOptions {
  onSubmit: (text: string) => Promise<void>;
  isSubmitting: boolean;
}

export function useCommentInputController({
  onSubmit,
  isSubmitting: isSubmittingProp,
}: UseCommentInputControllerOptions) {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isBusy = isSubmitting || isSubmittingProp;

  const handleSubmit = async () => {
    if (!text.trim() || isBusy) return;
    setIsSubmitting(true);
    try {
      await onSubmit(text.trim());
      setText('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void handleSubmit();
    }
  };

  return {
    text,
    setText,
    isBusy,
    onSubmit: handleSubmit,
    onKeyDown: handleKeyDown,
  };
}
