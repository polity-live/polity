import { useStatementSurvey } from '@/features/statements/hooks/useStatementSurvey';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { StatementSurveyView } from './StatementSurveyView';

interface StatementSurveyProps {
  survey: {
    id: string;
    question: string;
    ends_at: number;
    options?: {
      id: string;
      label: string;
      vote_count: number;
      position: number;
      votes?: { id: string; option_id: string; user_id: string }[];
    }[];
  };
  userId?: string;
  onVote?: (optionId: string, existingVoteId?: string) => void;
  onRetract?: (voteId: string) => void;
  className?: string;
}

export function StatementSurvey({
  survey,
  userId,
  onVote,
  onRetract,
  className,
}: StatementSurveyProps) {
  const { t } = useTranslation();
  const { percentages, totalVotes, userVote, isExpired, timeRemaining } = useStatementSurvey({
    survey,
    userId,
  });

  return (
    <StatementSurveyView
      className={className}
      isExpired={isExpired}
      onRetract={onRetract}
      onVote={onVote}
      options={percentages}
      question={survey.question}
      retractLabel={t('features.statements.survey.retract')}
      timeLabel={
        isExpired
          ? t('features.statements.survey.expired')
          : `${t('features.statements.survey.endsIn')} ${timeRemaining}`
      }
      totalVotesLabel={`${totalVotes} ${t('features.statements.survey.votes')}`}
      userVote={userVote}
    />
  );
}
