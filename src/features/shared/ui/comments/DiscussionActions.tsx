import type { ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';

import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import { VoteButtons, type VoteValue } from '@/features/shared/ui/voting';
import { cn } from '@/features/shared/utils/utils';

interface DiscussionActionBarProps {
  score?: number;
  showVoting?: boolean;
  hasUpvoted?: boolean;
  hasDownvoted?: boolean;
  isVoting?: boolean;
  onUpvote?: () => void | Promise<void>;
  onDownvote?: () => void | Promise<void>;
  children?: ReactNode;
  className?: string;
}

export function DiscussionActionBar({
  score,
  showVoting = score !== undefined,
  hasUpvoted,
  hasDownvoted,
  isVoting,
  onUpvote,
  onDownvote,
  children,
  className,
}: DiscussionActionBarProps) {
  const userVote: VoteValue = hasUpvoted ? 1 : hasDownvoted ? -1 : 0;
  const handleVote = (vote: VoteValue) => {
    if (vote === 1 || (vote === 0 && hasUpvoted)) {
      void onUpvote?.();
    } else if (vote === -1 || (vote === 0 && hasDownvoted)) {
      void onDownvote?.();
    }
  };

  return (
    <div
      data-slot="discussion-action-bar"
      className={cn('text-muted-foreground flex min-h-8 flex-wrap items-center gap-2', className)}
    >
      {showVoting ? (
        <VoteButtons
          score={score ?? 0}
          userVote={userVote}
          onVote={handleVote}
          size="sm"
          orientation="horizontal"
          presentation="surface"
          isPending={isVoting}
        />
      ) : score !== undefined ? (
        <span
          data-slot="discussion-score"
          className="min-w-7 rounded-md bg-[var(--surface-muted)] px-2 py-1 text-center text-xs font-semibold tabular-nums"
        >
          {score}
        </span>
      ) : null}
      {children}
    </div>
  );
}

interface DiscussionCollapseToggleProps {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}

export function DiscussionCollapseToggle({
  collapsed,
  onToggle,
  className,
}: DiscussionCollapseToggleProps) {
  const label = collapsed
    ? translateText('common.actions.expand')
    : translateText('common.actions.collapse');

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      presentation="mutedTiny"
      data-slot="discussion-collapse-toggle"
      aria-expanded={!collapsed}
      title={label}
      onClick={onToggle}
      className={cn('size-6 rounded-full p-0', className)}
    >
      {collapsed ? <Plus className="size-3.5" /> : <Minus className="size-3.5" />}
    </Button>
  );
}
