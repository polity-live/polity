'use client';

import { useState } from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import { Textarea } from '@/features/shared/ui/ui/textarea';
import { Send } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface CommentInputProps {
  onSubmit: (text: string) => Promise<void>;
  placeholder?: string;
  replyTo?: string;
  onCancelReply?: () => void;
  className?: string;
}

export function CommentInput({
  onSubmit,
  placeholder = translateText('generated.inline.0146_write_a_comment_7b01f9dc'),
  replyTo,
  onCancelReply,
  className,
}: CommentInputProps) {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(text.trim());
      setText('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {replyTo && (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span>
            {translateText('generated.inline.1112_replying_to_dc7ded47')}
            {replyTo}
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            className="hover:text-foreground text-xs underline"
          >
            {translateText('generated.inline.0065_cancel_77dfd213')}
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          className="flex-1 resize-none"
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!text.trim() || isSubmitting}
          className="self-end"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {text.length}
        {translateText('generated.inline.1113_characters_ctrl_enter_to_submit_ec3a274b')}
      </p>
    </div>
  );
}
