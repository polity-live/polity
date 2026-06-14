import { Check, Clock } from 'lucide-react';

import { cn } from '@/features/shared/utils/utils';
import { Button } from '@/features/shared/ui/ui/button';

interface StatementSurveyOptionViewModel {
  optionId: string;
  label: string;
  percent: number;
}

interface StatementSurveyVoteViewModel {
  id: string;
  option_id: string;
}

interface StatementSurveyViewProps {
  className?: string;
  isExpired: boolean;
  onRetract?: (voteId: string) => void;
  onVote?: (optionId: string, existingVoteId?: string) => void;
  options: StatementSurveyOptionViewModel[];
  question: string;
  timeLabel: string;
  totalVotesLabel: string;
  userVote?: StatementSurveyVoteViewModel | null;
  retractLabel: string;
}

export function StatementSurveyView({
  className,
  isExpired,
  onRetract,
  onVote,
  options,
  question,
  retractLabel,
  timeLabel,
  totalVotesLabel,
  userVote,
}: StatementSurveyViewProps) {
  const hasVoted = userVote != null;

  return (
    <div className={cn('space-y-3 rounded-lg border p-4', className)}>
      <p className="font-semibold">{question}</p>

      <div className="space-y-2">
        {options.map(option => {
          const isUserChoice = userVote?.option_id === option.optionId;
          const canChangeVote = hasVoted && !isExpired && !isUserChoice;

          return (
            <div
              key={option.optionId}
              className={cn(
                'space-y-1',
                canChangeVote && 'hover:bg-muted/50 cursor-pointer rounded-md p-1 transition-colors'
              )}
              onClick={canChangeVote ? () => onVote?.(option.optionId, userVote?.id) : undefined}
            >
              {hasVoted || isExpired ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className={cn(isUserChoice && 'font-semibold')}>
                      {isUserChoice && <Check className="mr-1 inline h-3 w-3" />}
                      {option.label}
                    </span>
                    <span className="text-muted-foreground">{option.percent}%</span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        isUserChoice ? 'bg-primary' : 'bg-primary/40'
                      )}
                      style={{ width: `${option.percent}%` }}
                    />
                  </div>
                </>
              ) : (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => onVote?.(option.optionId)}
                >
                  {option.label}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>{totalVotesLabel}</span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {timeLabel}
        </span>
      </div>

      {hasVoted && !isExpired && onRetract ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground w-full text-xs"
          onClick={() => onRetract(userVote?.id ?? '')}
        >
          {retractLabel}
        </Button>
      ) : null}
    </div>
  );
}
