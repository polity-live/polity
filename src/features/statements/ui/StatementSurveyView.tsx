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
        {options.map((option: any) => {
          const isUserChoice = userVote?.option_id === option.optionId;
          const canChangeVote = hasVoted && !isExpired && !isUserChoice;
          const result = (
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
          );

          return (
            <div key={option.optionId} className="space-y-1">
              {hasVoted || isExpired ? (
                canChangeVote ? (
                  <button
                    type="button"
                    data-action-id="statements.survey.option.change"
                    className="hover:bg-muted/50 w-full cursor-pointer space-y-1 rounded-md p-1 text-left transition-colors"
                    onClick={() => onVote?.(option.optionId, userVote?.id)}
                  >
                    {result}
                  </button>
                ) : (
                  result
                )
              ) : (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  data-action-id="statements.survey.option.vote"
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
          data-action-id="statements.survey.vote.retract"
          onClick={() => onRetract(userVote?.id ?? '')}
        >
          {retractLabel}
        </Button>
      ) : null}
    </div>
  );
}
