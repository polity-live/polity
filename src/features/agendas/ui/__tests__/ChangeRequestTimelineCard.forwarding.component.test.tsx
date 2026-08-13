/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChangeRequestTimelineCard } from '../ChangeRequestTimelineCard';

vi.mock('@/features/change-requests/ui/CREditorPreview', () => ({
  CREditorPreview: () => null,
}));

vi.mock('@/features/amendments/city-design/ui/CityDesignChangeRequestPreview', () => ({
  CityDesignChangeRequestPreview: () => null,
}));

vi.mock('@/features/editor/ui/SuggestionViewToggle', () => ({
  SuggestionViewToggle: () => null,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params }: { children: ReactNode; to: string; params: { id: string } }) => (
    <a href={to.replace('$id', params.id)}>{children}</a>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({
    t: (key: string, valuesOrFallback?: unknown, fallback?: string) => {
      const labels: Record<string, string> = {
        'features.agendas.crTimeline.acceptAmendment': 'Accept amendment',
        'features.agendas.crTimeline.accepted': 'Accepted',
        'features.agendas.crTimeline.votersParticipated': 'voted',
        'features.events.agenda.defaultChoiceLabels.yes': 'Yes',
        'features.events.agenda.forwarding.completedPrefix':
          'The amendment was successfully forwarded to',
        'features.events.agenda.forwarding.completedSuffix': '.',
        'features.events.agenda.noVotesYet': 'No votes yet',
        'features.events.agenda.winner': 'Winner',
        'features.events.voting.phases.closed': 'Closed',
      };
      return (
        labels[key] ??
        (typeof fallback === 'string'
          ? fallback
          : typeof valuesOrFallback === 'string'
            ? valuesOrFallback
            : key)
      );
    },
  }),
}));

afterEach(cleanup);

function timelineItem(isClosingVote: boolean) {
  return {
    id: isClosingVote ? 'closing-step' : 'cr-step',
    agenda_item_id: 'agenda-1',
    change_request_id: isClosingVote ? null : 'cr-1',
    is_closing_vote: isClosingVote,
    status: 'completed',
    change_request: isClosingVote ? null : { id: 'cr-1', title: 'CR-1' },
    vote: {
      id: 'vote-1',
      title: 'Amendment: A1',
      status: 'closed',
      majority_type: 'simple',
      choices: [{ id: 'yes', label: 'yes', order_index: 0 }],
      voters: [],
      indicative_decisions: [],
      final_decisions: [],
      offline_tallies: [],
    },
  };
}

const forwardingPreview = {
  status: 'forwarded' as const,
  nextEventId: 'event-next',
  nextEventTitle: 'EH1',
  nextGroupName: 'H1',
};

describe('ChangeRequestTimelineCard forwarding', () => {
  it('shows the forwarding result directly below a closing vote', () => {
    const { container } = render(
      <ChangeRequestTimelineCard
        item={timelineItem(true) as never}
        index={0}
        isCurrent={false}
        hasUserVoted={false}
        userSelectedChoiceIds={[]}
        canManage={false}
        canVote={false}
        editingMode="event_final_closing_vote"
        forwardingPreview={forwardingPreview}
      />
    );

    expect(screen.getByText(/successfully forwarded/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'EH1' }).getAttribute('href')).toBe(
      '/event/event-next/agenda'
    );
    expect(container.querySelector('[data-forwarding-status="forwarded"]')).toBeTruthy();
  });

  it('does not show forwarding information on a normal change request vote', () => {
    const { container } = render(
      <ChangeRequestTimelineCard
        item={timelineItem(false) as never}
        index={0}
        isCurrent={false}
        hasUserVoted={false}
        userSelectedChoiceIds={[]}
        canManage={false}
        canVote={false}
        editingMode="event_final_closing_vote"
        forwardingPreview={forwardingPreview}
      />
    );

    expect(container.querySelector('[data-forwarding-status]')).toBeNull();
  });
});
