'use client';

import { Calendar, CheckCircle2, Crown, Users, Vote } from 'lucide-react';
import { BadgeControl } from '@/features/shared/ui/status';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';

function getWinningPreviewPercentage(items: { percentage: number }[]) {
  const winningPercentage = items.reduce((max, item) => Math.max(max, item.percentage), 0);
  return winningPercentage > 0 ? winningPercentage : null;
}

export function LandingVoteElectionPreview() {
  const { t, tArray } = useTranslation();
  const voteChoices = tArray('pages.home.publicLanding.voteElectionPreview.voteChoices').map(
    choice => {
      const [label = '', count = '', percentage = '0'] = choice.split('|');
      const parsedPercentage = Number.parseInt(percentage, 10);
      return {
        label,
        count,
        percentage: Number.isFinite(parsedPercentage) ? parsedPercentage : 0,
      };
    }
  );
  const winningVotePercentage = getWinningPreviewPercentage(voteChoices);
  const electionCandidates = tArray(
    'pages.home.publicLanding.voteElectionPreview.electionCandidates'
  ).map(candidate => {
    const [name = '', role = '', count = '', percentage = '0'] = candidate.split('|');
    const parsedPercentage = Number.parseInt(percentage, 10);
    return {
      name,
      role,
      count,
      percentage: Number.isFinite(parsedPercentage) ? parsedPercentage : 0,
    };
  });
  const winningCandidatePercentage = getWinningPreviewPercentage(electionCandidates);
  const metrics = tArray('pages.home.publicLanding.voteElectionPreview.metrics');
  const checklist = tArray('pages.home.publicLanding.voteElectionPreview.checklist');
  const winnerLabel = t('features.events.agenda.winner', 'Winner');

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="bg-card rounded-lg border p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {t('pages.home.publicLanding.voteElectionPreview.title')}
            </p>
            <p className="text-muted-foreground text-sm">
              {t('pages.home.publicLanding.voteElectionPreview.subtitle')}
            </p>
          </div>
          <BadgeControl variant="secondary">
            <Vote className="mr-1.5 h-3.5 w-3.5" />
            {t('pages.home.publicLanding.voteElectionPreview.badge')}
          </BadgeControl>
        </div>
        <div className="mt-6 space-y-4">
          <div>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {t('pages.home.publicLanding.voteElectionPreview.voteTitle')}
                </p>
                <p className="text-muted-foreground text-sm">
                  {t('pages.home.publicLanding.voteElectionPreview.voteMeta')}
                </p>
              </div>
              <Calendar className="text-brand h-5 w-5 flex-none" />
            </div>
            <div className="space-y-3">
              {voteChoices.map((choice, index) => {
                const isWinner =
                  winningVotePercentage !== null && choice.percentage === winningVotePercentage;
                return (
                  <div
                    key={choice.label}
                    className={cn(
                      'space-y-1.5 transition-[background-color,border-color,box-shadow]',
                      isWinner &&
                        'bg-card rounded-lg border border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] px-3 py-3 shadow-sm'
                    )}
                    data-slot="landing-vote-choice"
                    data-winner={isWinner ? 'true' : undefined}
                    data-framed={isWinner ? 'true' : undefined}
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="min-w-0 truncate font-medium">{choice.label}</span>
                        {isWinner && (
                          <BadgeControl tone="success" size="tiny" className="gap-1">
                            <Crown className="h-3.5 w-3.5" />
                            {winnerLabel}
                          </BadgeControl>
                        )}
                      </div>
                      <span className="text-muted-foreground flex-none">
                        {choice.count} · {choice.percentage}%
                      </span>
                    </div>
                    <div className="bg-muted/40 h-2 overflow-hidden rounded-full">
                      <div
                        data-slot="landing-vote-choice-bar"
                        className={cn(
                          'h-full rounded-full',
                          isWinner
                            ? 'bg-[var(--badge-success-fg)]'
                            : index === 0
                              ? 'bg-brand'
                              : 'bg-brand/35'
                        )}
                        style={{ width: `${choice.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid gap-2 border-t pt-4 sm:grid-cols-3">
            {metrics.map(metric => (
              <div key={metric} className="bg-muted/20 rounded-md border px-3 py-2 text-xs">
                {metric}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="bg-card rounded-lg border p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">
                {t('pages.home.publicLanding.voteElectionPreview.electionTitle')}
              </p>
              <p className="text-muted-foreground text-sm">
                {t('pages.home.publicLanding.voteElectionPreview.electionMeta')}
              </p>
            </div>
            <Users className="text-brand h-5 w-5 flex-none" />
          </div>
          <div className="space-y-3">
            {electionCandidates.map(candidate => {
              const isWinner =
                winningCandidatePercentage !== null &&
                candidate.percentage === winningCandidatePercentage;
              return (
                <div
                  key={candidate.name}
                  className={cn(
                    'space-y-2 transition-[background-color,border-color,box-shadow]',
                    isWinner &&
                      'bg-card rounded-lg border border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] px-3 py-3 shadow-sm'
                  )}
                  data-slot="landing-election-candidate"
                  data-winner={isWinner ? 'true' : undefined}
                  data-framed={isWinner ? 'true' : undefined}
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-brand/10 text-brand flex h-9 w-9 flex-none items-center justify-center rounded-md text-sm font-semibold">
                      {candidate.name
                        .split(' ')
                        .map(part => part[0])
                        .join('')
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-medium">{candidate.name}</p>
                        {isWinner && (
                          <BadgeControl tone="success" size="tiny" className="gap-1">
                            <Crown className="h-3.5 w-3.5" />
                            {winnerLabel}
                          </BadgeControl>
                        )}
                      </div>
                      <p className="text-muted-foreground truncate text-xs">{candidate.role}</p>
                    </div>
                    <span className="text-muted-foreground flex-none text-xs">
                      {candidate.count} · {candidate.percentage}%
                    </span>
                  </div>
                  <div className="bg-muted/40 h-1.5 overflow-hidden rounded-full">
                    <div
                      data-slot="landing-election-candidate-bar"
                      className={cn(
                        'h-full rounded-full',
                        isWinner ? 'bg-[var(--badge-success-fg)]' : 'bg-brand/70'
                      )}
                      style={{ width: `${candidate.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-card rounded-lg border p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="text-brand h-5 w-5" />
            <p className="font-semibold">
              {t('pages.home.publicLanding.voteElectionPreview.statusTitle')}
            </p>
          </div>
          <div className="space-y-2">
            {checklist.map(item => (
              <div key={item} className="flex gap-2 text-sm">
                <CheckCircle2 className="text-success mt-0.5 h-4 w-4 flex-none" />
                <span className="text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
