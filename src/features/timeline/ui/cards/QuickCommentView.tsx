'use client';

import * as React from 'react';
import { MessageCircle, Send, X, Loader2 } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { FormControlTextarea } from '@/features/shared/ui/form';
import { cn } from '@/features/shared/utils/utils';

export interface QuickCommentProps {
  /** Content item ID to comment on */
  contentId: string;
  /** Content type */
  contentType: 'amendment' | 'event' | 'blog' | 'statement' | 'group';
  /** Called when comment is submitted */
  onSubmit?: (comment: string) => Promise<void>;
  /** Number of existing comments */
  commentCount?: number;
  /** Placeholder text */
  placeholder?: string;
  /** Show in expanded state by default */
  defaultExpanded?: boolean;
  /** Compact mode for card footers */
  compact?: boolean;
  className?: string;
}
export interface QuickCommentViewProps {
  className: any;
  comment: any;
  commentCount: any;
  compact: any;
  defaultExpanded: any;
  defaultPlaceholder: any;
  handleBlur: any;
  handleCancel: any;
  handleFocus: any;
  handleKeyDown: any;
  handleSubmit: any;
  inputRef: any;
  isExpanded: any;
  isSubmitting: any;
  onSubmit: any;
  placeholder: any;
  setComment: any;
  setIsExpanded: any;
  setIsSubmitting: any;
  t: any;
}

export function QuickCommentView({
  className,
  comment,
  commentCount,
  defaultPlaceholder,
  handleBlur,
  handleCancel,
  handleFocus,
  handleKeyDown,
  handleSubmit,
  inputRef,
  isExpanded,
  isSubmitting,
  placeholder,
  setComment,
  setIsExpanded,
  t,
}: QuickCommentViewProps) {
  return (
    <div className={cn('relative', className)}>
      {/* Collapsed state - simple input */}
      {!isExpanded && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          presentation="mutedTiny"
          data-slot="discussion-action-bar"
          className="h-7 px-2"
          onClick={() => {
            setIsExpanded(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          <MessageCircle className="size-3.5" />
          <span className="text-muted-foreground text-sm">{placeholder || defaultPlaceholder}</span>
          {commentCount > 0 ? <span>{commentCount}</span> : null}
        </Button>
      )}

      {/* Expanded state - full textarea */}
      {isExpanded && (
        <div className="space-y-2">
          <FormControlTextarea
            ref={inputRef}
            value={comment}
            onChange={e => setComment(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || defaultPlaceholder}
            className={cn(
              'border-input bg-background w-full resize-none rounded-lg border px-3 py-2 text-sm',
              'focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none',
              'placeholder:text-muted-foreground',
              'min-h-[80px]'
            )}
            rows={3}
            autoFocus
          />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">
              {t('features.timeline.comments.ctrlEnterSubmit')}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSubmitting}>
                <X className="mr-1 h-4 w-4" />
                {t('common.cancel')}
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={!comment.trim() || isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1 h-4 w-4" />
                )}
                {t('common.send')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
