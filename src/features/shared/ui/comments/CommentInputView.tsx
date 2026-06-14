import type { KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import { Textarea } from '@/features/shared/ui/ui/textarea';
import { cn } from '@/features/shared/utils/utils';

interface CommentInputViewProps {
  text: string;
  setText: (text: string) => void;
  isBusy: boolean;
  onSubmit: () => void | Promise<void>;
  onKeyDown: (event: KeyboardEvent) => void;
  placeholder: string;
  replyTo?: string;
  onCancelReply?: () => void;
  className?: string;
}

export function CommentInputView({
  text,
  setText,
  isBusy,
  onSubmit,
  onKeyDown,
  placeholder,
  replyTo,
  onCancelReply,
  className,
}: CommentInputViewProps) {
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
          onChange={event => setText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={2}
          className="flex-1 resize-none"
        />
        <Button size="sm" onClick={onSubmit} disabled={!text.trim() || isBusy} className="self-end">
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
