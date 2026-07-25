import { cn } from '@/features/shared/utils/utils';
import { ArrowBigDown, ArrowBigUp, ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export type VoteValue = 1 | 0 | -1;

export interface VoteButtonsProps {
  upvotes?: number;
  downvotes?: number;
  /** May be supplied directly when only the aggregate score is available. */
  score?: number;
  /** Current user's vote: 1 = up, -1 = down, 0 = none */
  userVote: VoteValue;
  onVote: (vote: VoteValue) => void;
  size?: 'sm' | 'default' | 'lg';
  orientation?: 'vertical' | 'horizontal';
  presentation?: 'plain' | 'surface';
  isPending?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { icon: 'h-4 w-4', btn: 'h-7 w-7' },
  default: { icon: 'h-5 w-5', btn: 'h-8 w-8' },
  lg: { icon: 'h-6 w-6', btn: 'h-10 w-10' },
} as const;

export function VoteButtons({
  upvotes,
  downvotes,
  score: suppliedScore,
  userVote,
  onVote,
  size = 'default',
  orientation = 'vertical',
  presentation = 'plain',
  isPending = false,
  className,
}: VoteButtonsProps) {
  const score = suppliedScore ?? (upvotes ?? 0) - (downvotes ?? 0);
  const s = sizeMap[size];
  const isVertical = orientation === 'vertical';
  const isSurface = presentation === 'surface';

  const handleUp = () => onVote(userVote === 1 ? 0 : 1);
  const handleDown = () => onVote(userVote === -1 ? 0 : -1);
  const UpIcon = isSurface ? ArrowUp : ArrowBigUp;
  const DownIcon = isSurface ? ArrowDown : ArrowBigDown;

  return (
    <div
      data-slot="vote-buttons"
      data-presentation={presentation}
      className={cn(
        'flex items-center gap-0.5',
        isVertical ? 'flex-col' : 'flex-row',
        isSurface && 'rounded-md bg-[var(--surface-muted)] p-0.5',
        className
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        presentation={isSurface ? 'mutedTiny' : undefined}
        className={cn(
          s.btn,
          isSurface && 'p-0',
          userVote === 1 &&
            (isSurface
              ? 'bg-[var(--badge-accent-bg)] text-[var(--badge-accent-fg)] hover:bg-[var(--badge-accent-bg)] hover:text-[var(--badge-accent-fg)]'
              : 'text-[var(--badge-success-fg)]')
        )}
        onClick={handleUp}
        disabled={isPending}
        aria-pressed={userVote === 1}
        aria-label={translateText('generated.inline.1150_upvote_c52661f1')}
      >
        <UpIcon className={cn(s.icon, !isSurface && userVote === 1 && 'fill-current')} />
      </Button>

      <span
        data-slot="vote-score"
        className={cn(
          'min-w-5 text-center font-semibold tabular-nums select-none',
          isSurface ? 'text-xs' : 'text-sm',
          isSurface && userVote === 1 && 'text-[var(--badge-accent-fg)]',
          isSurface && userVote === -1 && 'text-[var(--badge-info-fg)]',
          !isSurface && score > 0 && 'text-[var(--badge-success-fg)]',
          !isSurface && score < 0 && 'text-[var(--badge-danger-fg)]'
        )}
      >
        {score}
      </span>

      <Button
        variant="ghost"
        size="icon"
        presentation={isSurface ? 'mutedTiny' : undefined}
        className={cn(
          s.btn,
          isSurface && 'p-0',
          userVote === -1 &&
            (isSurface
              ? 'bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)] hover:bg-[var(--badge-info-bg)] hover:text-[var(--badge-info-fg)]'
              : 'text-[var(--badge-danger-fg)]')
        )}
        onClick={handleDown}
        disabled={isPending}
        aria-pressed={userVote === -1}
        aria-label={translateText('generated.inline.1151_downvote_fef514a0')}
      >
        <DownIcon className={cn(s.icon, !isSurface && userVote === -1 && 'fill-current')} />
      </Button>
    </div>
  );
}
