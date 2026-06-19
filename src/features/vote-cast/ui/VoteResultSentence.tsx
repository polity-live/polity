'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import { Crown } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { formatVoteResultSentence } from '../logic/votePhaseHelpers';

interface VoteResultSentenceProps {
  type: 'vote' | 'election';
  result: 'passed' | 'rejected' | 'tie';
  winnerName?: string;
  winnerLink?: string;
  roleName?: string;
  roleLink?: string;
  voteSharePercent?: number;
  isFinal?: boolean;
  className?: string;
}

/**
 * Standardized result sentence displayed above vote results.
 *
 * For elections: "For the election of <role>, <winner> won with <share>% of votes."
 * For votes: "The motion was accepted/rejected with <share>% of votes."
 *
 * Winner gets a crown icon + golden highlight when the final vote is over.
 */
export function VoteResultSentence({
  type,
  result,
  winnerName,
  winnerLink,
  roleName,
  roleLink,
  voteSharePercent,
  isFinal,
  className,
}: VoteResultSentenceProps) {
  const { t } = useTranslation();

  const isWinner = result === 'passed' && type === 'election' && winnerName;

  // Render a semantic sentence using the pure helper
  const plainSentence = formatVoteResultSentence(
    type,
    result,
    winnerName,
    roleName,
    voteSharePercent
  );

  // For elections with a winner, render a rich version with links + crown
  if (isWinner && isFinal) {
    const rolePart = roleName ? (
      roleLink ? (
        <Link to={roleLink} className="hover:text-primary font-medium underline underline-offset-4">
          {roleName}
        </Link>
      ) : (
        <span className="font-medium">{roleName}</span>
      )
    ) : null;

    const winnerPart = winnerLink ? (
      <Link
        to={winnerLink}
        className={featureThemeClassName('votecastVoteResultSentenceWarningText')}
      >
        {winnerName}
      </Link>
    ) : (
      <span className={featureThemeClassName('votecastVoteResultSentenceWarningTextAlpha')}>
        {winnerName}
      </span>
    );

    return (
      <div
        className={cn(
          'rounded-lg border px-4 py-3 shadow-sm',
          featureThemeClassName('votecastVoteResultSentenceWarningPanel'),
          className
        )}
      >
        <Crown className={featureThemeClassName('votecastVoteResultSentenceWarningIcon')} />
        <p>
          {rolePart ? (
            <>
              {t('features.events.voting.forElectionOf')} {rolePart}, {winnerPart}{' '}
              {t('features.events.voting.wonWith', 'won')}
              {voteSharePercent !== undefined && (
                <>
                  {' '}
                  {t('features.events.voting.withShare', 'with')} {voteSharePercent}%{' '}
                  {t('features.events.voting.ofVotes')}
                </>
              )}
              .
            </>
          ) : (
            <>
              {winnerPart} {t('features.events.voting.wonElection')}
              {voteSharePercent !== undefined && (
                <>
                  {' '}
                  {t('features.events.voting.withShare', 'with')} {voteSharePercent}%
                </>
              )}
              .
            </>
          )}
        </p>
      </div>
    );
  }

  // Default: simple text sentence
  const isSuccess = result === 'passed';

  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3 text-sm shadow-sm',
        isSuccess
          ? featureThemeClassName('votecastVoteResultSentenceSuccessBackground')
          : result === 'rejected'
            ? featureThemeClassName('votecastVoteResultSentenceDangerBackground')
            : featureThemeClassName('votecastVoteResultSentenceWarningBackground'),
        className
      )}
    >
      <p>{plainSentence}</p>
    </div>
  );
}
