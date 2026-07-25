/* @vitest-environment jsdom */

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LandingActivityStripPreview, LandingVoteElectionPreview } from '../PublicLandingPage';

const translationArrays = vi.hoisted((): Record<string, string[]> => ({
  'pages.home.publicLanding.voteElectionPreview.voteChoices': [
    'Yes|138|62',
    'No|54|24',
    'Abstain|31|14',
  ],
  'pages.home.publicLanding.voteElectionPreview.electionCandidates': [
    'Maya Schneider|Speaker|84|44',
    'Jonas Weber|Deputy|61|32',
    'Aylin Kaya|Board seat|45|24',
  ],
  'pages.home.publicLanding.voteElectionPreview.metrics': [
    '223 votes recorded',
    '71% turnout',
    'Quorum reached',
  ],
  'pages.home.publicLanding.voteElectionPreview.checklist': [
    'Voting window open',
    'Named results prepared',
    'Election record generated automatically',
  ],
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) =>
      key === 'features.events.agenda.winner'
        ? 'Winner'
        : typeof fallback === 'string'
          ? fallback
          : (fallback?.defaultValue ?? key),
    tArray: (key: string) => translationArrays[key] ?? [],
  }),
}));

vi.mock('@/features/messages/ui/AssistantMessageInput', () => ({
  AssistantMessageInput: () => null,
}));

vi.mock('@/features/network/ui/NetworkFlowBase', () => ({
  NetworkFlowBase: () => null,
}));

vi.mock('@/features/network/ui/NetworkControlPanel', () => ({
  NetworkControlPanel: () => null,
}));

vi.mock('@/features/network/ui/NetworkEntityDialog', () => ({
  NetworkEntityDialog: () => null,
}));

vi.mock('@/features/network/ui/networkVisualHelpers', () => ({
  createGroupNodeLegendItem: () => ({}),
  getGroupNodeDisplayLabel: (label: string) => label,
  getGroupNodeStyle: () => ({}),
}));

vi.mock('@/features/shared/ui/typeahead', () => ({
  EntitySearchBar: () => null,
}));

vi.mock('@/features/search/ui/SearchResultCard', () => ({
  SearchResultCard: () => null,
}));

vi.mock('@/features/messages/ui/MessageBubble', () => ({
  MessageBubble: () => null,
}));

vi.mock('@/features/messages/ui/ConversationHeader', () => ({
  ConversationHeader: () => null,
}));

vi.mock('@/features/timeline/ui/cards/AgendaItemTimelineCard', () => ({
  AgendaItemTimelineCard: () => null,
}));

vi.mock('@/features/timeline/ui/CivicTimelineMap', () => ({
  CivicTimelineMap: () => <div data-testid="mock-civic-timeline-map" />,
}));

vi.mock('@/features/timeline/ui/CivicTimelineRail', () => ({
  CivicTimelineRail: () => <div data-testid="mock-civic-timeline-rail" />,
}));

vi.mock('@/features/public-landing/hooks/useLandingNetworkPreviewState', () => ({
  useLandingNetworkPreviewState: () => ({}),
}));

vi.mock('../LandingAmendmentSectionContent', () => ({
  LandingAmendmentSectionContentContainer: () => null,
}));

vi.mock('@/features/shared/motion', () => ({
  MotionGroup: () => null,
  MotionItem: () => null,
  ScrollReveal: () => null,
}));

vi.mock('@/features/shared/ui/navigation/SmartLink', () => ({
  SmartLink: () => null,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('LandingVoteElectionPreview', () => {
  it('marks winning vote and election bars with the app winner treatment', () => {
    const { container } = render(<LandingVoteElectionPreview />);

    const voteRows = Array.from(
      container.querySelectorAll<HTMLElement>('[data-slot="landing-vote-choice"]')
    );
    const candidateRows = Array.from(
      container.querySelectorAll<HTMLElement>('[data-slot="landing-election-candidate"]')
    );

    expect(voteRows).toHaveLength(3);
    expect(candidateRows).toHaveLength(3);

    expect(voteRows[0].getAttribute('data-winner')).toBe('true');
    expect(voteRows[0].getAttribute('data-framed')).toBe('true');
    expect(voteRows[1].getAttribute('data-winner')).toBeNull();
    expect(candidateRows[0].getAttribute('data-winner')).toBe('true');
    expect(candidateRows[0].getAttribute('data-framed')).toBe('true');
    expect(candidateRows[1].getAttribute('data-winner')).toBeNull();

    expect(within(voteRows[0]).getByText('Winner')).toBeTruthy();
    expect(within(candidateRows[0]).getByText('Winner')).toBeTruthy();
    expect(screen.getAllByText('Winner')).toHaveLength(2);

    expect(voteRows[0].className).toContain('border-[var(--badge-success-border)]');
    expect(voteRows[0].className).toContain('bg-[var(--badge-success-bg)]');
    expect(candidateRows[0].className).toContain('border-[var(--badge-success-border)]');
    expect(candidateRows[0].className).toContain('bg-[var(--badge-success-bg)]');

    const voteWinnerBar = voteRows[0].querySelector<HTMLElement>(
      '[data-slot="landing-vote-choice-bar"]'
    );
    const candidateWinnerBar = candidateRows[0].querySelector<HTMLElement>(
      '[data-slot="landing-election-candidate-bar"]'
    );

    expect(voteWinnerBar?.className).toContain('bg-[var(--badge-success-fg)]');
    expect(voteWinnerBar?.className).not.toContain('bg-brand');
    expect(candidateWinnerBar?.className).toContain('bg-[var(--badge-success-fg)]');
    expect(candidateWinnerBar?.className).not.toContain('bg-brand');
  });
});

describe('LandingActivityStripPreview', () => {
  it('uses shrinkable map and rail columns in a single-column mobile grid', () => {
    const { container } = render(<LandingActivityStripPreview />);

    const grid = container.querySelector<HTMLElement>('[data-slot="landing-activity-grid"]');
    const mapColumn = container.querySelector<HTMLElement>(
      '[data-slot="landing-activity-map-column"]'
    );
    const railColumn = container.querySelector<HTMLElement>(
      '[data-slot="landing-activity-rail-column"]'
    );

    expect(grid?.className).toContain('min-w-0');
    expect(grid?.className).toContain('grid-cols-1');
    expect(grid?.className).toContain('lg:grid-cols-[minmax(280px,0.82fr)_minmax(0,1.18fr)]');
    expect(mapColumn?.className).toContain('min-w-0');
    expect(mapColumn?.className).toContain('max-w-full');
    expect(railColumn?.className).toContain('min-w-0');
    expect(railColumn?.className).toContain('max-w-full');
    expect(screen.getByTestId('mock-civic-timeline-map')).toBeTruthy();
    expect(screen.getByTestId('mock-civic-timeline-rail')).toBeTruthy();
  });
});
