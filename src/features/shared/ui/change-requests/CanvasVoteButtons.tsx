import { CheckIcon, XIcon } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';

export type CanvasVoteChoice = 'accept' | 'reject' | 'abstain';

export function CanvasVoteButtons({
  selected,
  disabled,
  labels,
  actionIdPrefix,
  onVote,
}: {
  selected?: string | null;
  disabled?: boolean;
  labels: Record<CanvasVoteChoice, string>;
  actionIdPrefix: string;
  onVote: (choice: CanvasVoteChoice) => void | Promise<void>;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(['accept', 'reject', 'abstain'] as const).map(choice => (
        <Button
          key={choice}
          data-action-id={`${actionIdPrefix}.${choice}`}
          type="button"
          variant={
            choice === 'accept' ? 'default' : choice === 'reject' ? 'destructive' : 'outline'
          }
          presentation={choice === 'accept' ? 'success' : undefined}
          className={cn(selected === choice && 'ring-ring ring-2 ring-offset-1')}
          aria-pressed={selected === choice}
          disabled={disabled}
          onClick={() => void onVote(choice)}
        >
          {choice === 'accept' && <CheckIcon className="mr-2 size-4" />}
          {choice === 'reject' && <XIcon className="mr-2 size-4" />}
          {labels[choice]}
        </Button>
      ))}
    </div>
  );
}
