/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DecisionItem } from '../types';

import { MobileDecisionCard } from '../MobileDecisionCard';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'features.timeline.terminal.castVote': 'Cast vote',
        'features.timeline.terminal.viewResults': 'View results',
      };

      return labels[key] ?? key;
    },
  }),
}));

function electionDecision(overrides: Partial<DecisionItem> = {}): DecisionItem {
  return {
    id: 'E-1',
    sourceId: 'election-1',
    type: 'election',
    title: 'Board election',
    body: 'Board',
    endsAt: new Date('2026-06-20T12:00:00Z'),
    status: 'elected',
    isClosed: true,
    isClosingSoon: false,
    isOpeningSoon: false,
    isRecentlyClosed: true,
    isUrgent: false,
    visibility: 'public',
    trend: { direction: 'stable', percentage: 0 },
    href: '/event/event-1/agenda/agenda-election',
    candidates: [
      { id: 'candidate-1', name: 'Polity Tester', votes: 3, actualPercentage: 75, isWinner: true },
      { id: 'candidate-2', name: 'Mina Bauer', votes: 1, actualPercentage: 25 },
    ],
    winnerName: 'Polity Tester',
    votedCount: 4,
    totalMembers: 5,
    turnout: 80,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('MobileDecisionCard', () => {
  it('renders election candidates as rows and keeps the action callback', () => {
    const onClick = vi.fn();
    const { container } = render(
      <MobileDecisionCard decision={electionDecision()} onClick={onClick} />
    );

    const rows = container.querySelectorAll('[data-election-candidate-row="true"]');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.getAttribute('data-winner')).toBe('true');
    expect(screen.getByText('Polity Tester')).toBeTruthy();
    expect(screen.getByText('3 · 75%')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /View results/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
