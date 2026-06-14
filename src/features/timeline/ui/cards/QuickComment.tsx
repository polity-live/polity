'use client';

import * as React from 'react';
import { MessageCircle, Send, X, Loader2 } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { FormControlTextarea } from '@/features/shared/ui/form';
import { cn } from '@/features/shared/utils/utils';
import { useTranslation } from '@/features/shared/hooks/use-translation';

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

/**
 * QuickComment - Inline comment input for timeline cards
 *
 * Expands on focus, collapses on blur when empty
 */
export function QuickComment({
  onSubmit,
  commentCount = 0,
  placeholder,
  defaultExpanded = false,
  compact = false,
  className,
}: QuickCommentProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const [comment, setComment] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  const defaultPlaceholder = t('features.timeline.comments.addComment');

  const handleFocus = () => {
    setIsExpanded(true);
  };

  const handleBlur = () => {
    if (!comment.trim()) {
      setIsExpanded(false);
    }
  };

  const handleCancel = () => {
    setComment('');
    setIsExpanded(false);
    inputRef.current?.blur();
  };

  const handleSubmit = async () => {
    if (!comment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit?.(comment.trim());
      setComment('');
      setIsExpanded(false);
    } catch (error) {
      console.error('Failed to submit comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (compact && !isExpanded) {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setIsExpanded(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className={cn(
          'text-muted-foreground hover:text-foreground h-auto gap-1.5 p-0 text-sm transition-colors hover:bg-transparent',
          className
        )}
      >
        <MessageCircle className="h-4 w-4" />
        {commentCount > 0 && <span>{commentCount}</span>}
      </Button>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {/* Collapsed state - simple input */}
      {!isExpanded && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-full px-3 py-2',
            'bg-muted/50 hover:bg-muted cursor-text transition-colors'
          )}
          onClick={() => {
            setIsExpanded(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          <MessageCircle className="text-muted-foreground h-4 w-4" />
          <span className="text-muted-foreground text-sm">{placeholder || defaultPlaceholder}</span>
        </div>
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

/**
 * CommentPreview - Shows preview of recent comments
 */
export function CommentPreview({
  comments,
  maxComments = 2,
  onViewAll,
  className,
}: {
  comments: {
    id: string;
    author: string;
    content: string;
    createdAt: number;
  }[];
  maxComments?: number;
  onViewAll?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const visibleComments = comments.slice(0, maxComments);
  const hiddenCount = comments.length - maxComments;

  if (comments.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {visibleComments.map(comment => (
        <div key={comment.id} className="flex gap-2 text-sm">
          <span className="text-foreground font-medium">{comment.author}</span>
          <span className="text-muted-foreground line-clamp-1">{comment.content}</span>
        </div>
      ))}
      {hiddenCount > 0 && onViewAll && (
        <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={onViewAll}>
          {t('features.timeline.comments.viewAll', { count: comments.length })}
        </Button>
      )}
    </div>
  );
}
