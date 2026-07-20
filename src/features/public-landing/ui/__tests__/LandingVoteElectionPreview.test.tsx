/* @vitest-environment jsdom */

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LandingVoteElectionPreview } from '../PublicLandingPage';

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
    t: (key: string, fallback?: string) =>
      key === 'features.events.agenda.winner' ? 'Winner' : (fallback ?? key),
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
  CivicTimelineMap: () => null,
}));

vi.mock('@/features/timeline/ui/CivicTimelineRail', () => ({
  CivicTimelineRail: () => null,
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
