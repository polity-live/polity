'use client';

import { ExternalLink, Loader2, Vote } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
export interface DecisionVoteButtonViewProps {
  decision: any;
  compact: any;
  onVote: any;
  canVote: any;
  isLoading: any;
}

export function DecisionVoteButtonView({
  decision,
  compact,
  onVote,
  canVote,
  isLoading,
}: DecisionVoteButtonViewProps) {
  if (decision.isClosed || !decision.canOpenVoteDialog || !decision.eventId) {
    return (
      <Button
        variant="ghost"
        size={compact ? 'sm' : 'default'}
        className="text-muted-foreground gap-2 rounded-md"
        asChild
      >
        <a href={decision.href}>
          <ExternalLink className="h-4 w-4" />
          {!compact ? <span>{translateText('generated.inline.0347_view_69bd4ef9')}</span> : null}
        </a>
      </Button>
    );
  }

  if (isLoading) {
    return (
      <Button
        variant="outline"
        size={compact ? 'sm' : 'default'}
        className="gap-2 rounded-md"
        disabled
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        {!compact ? <span>{translateText('generated.inline.0011_vote_64f87291')}</span> : null}
      </Button>
    );
  }

  if (!canVote()) {
    return null;
  }

  return (
    <Button
      size={compact ? 'sm' : 'default'}
      className="border-primary/30 bg-background text-primary hover:bg-primary/10 gap-2 rounded-md border font-semibold shadow-sm"
      variant="outline"
      aria-label={compact ? 'Vote' : undefined}
      onClick={event => {
        event.stopPropagation();
        onVote(decision);
      }}
    >
      <Vote className="h-4 w-4" />
      {!compact ? <span>{translateText('generated.inline.0011_vote_64f87291')}</span> : null}
    </Button>
  );
}
