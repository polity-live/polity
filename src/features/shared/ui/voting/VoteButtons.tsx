import { cn } from '@/features/shared/utils/utils';
import { ArrowBigUp, ArrowBigDown } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export type VoteValue = 1 | 0 | -1;

interface VoteButtonsProps {
  upvotes: number;
  downvotes: number;
  /** Current user's vote: 1 = up, -1 = down, 0 = none */
  userVote: VoteValue;
  onVote: (vote: VoteValue) => void;
  size?: 'sm' | 'default' | 'lg';
  orientation?: 'vertical' | 'horizontal';
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
  userVote,
  onVote,
  size = 'default',
  orientation = 'vertical',
  className,
}: VoteButtonsProps) {
  const score = upvotes - downvotes;
  const s = sizeMap[size];
  const isVertical = orientation === 'vertical';

  const handleUp = () => onVote(userVote === 1 ? 0 : 1);
  const handleDown = () => onVote(userVote === -1 ? 0 : -1);

  return (
    <div
      className={cn('flex items-center gap-0.5', isVertical ? 'flex-col' : 'flex-row', className)}
    >
      <Button
        variant="ghost"
        size="icon"
        className={cn(s.btn, userVote === 1 && 'text-[var(--badge-success-fg)]')}
        onClick={handleUp}
        aria-label={translateText('generated.inline.1150_upvote_c52661f1')}
      >
        <ArrowBigUp className={cn(s.icon, userVote === 1 && 'fill-current')} />
      </Button>

      <span
        className={cn(
          'text-sm font-semibold tabular-nums select-none',
          score > 0 && 'text-[var(--badge-success-fg)]',
          score < 0 && 'text-[var(--badge-danger-fg)]'
        )}
      >
        {score}
      </span>

      <Button
        variant="ghost"
        size="icon"
        className={cn(s.btn, userVote === -1 && 'text-[var(--badge-danger-fg)]')}
        onClick={handleDown}
        aria-label={translateText('generated.inline.1151_downvote_fef514a0')}
      >
        <ArrowBigDown className={cn(s.icon, userVote === -1 && 'fill-current')} />
      </Button>
    </div>
  );
}
