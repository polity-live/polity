/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MembershipCompositionPanelView } from '../MembershipCompositionPanelView';

vi.mock('@/features/charts/ui/ChartRenderer', () => ({
  ChartRenderer: () => <div data-testid="chart" />,
}));

afterEach(() => {
  cleanup();
});

const labels = {
  title: 'Composition',
  description: 'Group composition',
  modePercent: '%',
  modeAbsolute: 'Absolute',
  membersTitle: 'Members',
  membersDescription: 'Members by source',
  membersEmpty: 'No members',
  leadershipTitle: 'Leadership',
  leadershipDescription: 'Leadership by source',
  leadershipEmpty: 'No leadership',
  loading: 'Loading',
  total: (count: number) => `Total: ${count}`,
  leadershipFootnote: 'Leadership can count multiple roles.',
};

describe('MembershipCompositionPanelView', () => {
  it('shows absolute counts next to percentages in the composition table', () => {
    render(
      <MembershipCompositionPanelView
        isLoading={false}
        displayMode="percent"
        memberRows={[
          {
            key: 'B3',
            label: 'B3',
            memberCount: 5,
            leadershipAssignmentCount: 0,
            memberPercentage: 62.5,
            leadershipPercentage: 0,
            value: 5,
            percentage: 62.5,
            fill: '#111111',
          },
        ]}
        leadershipRows={[]}
        labels={labels}
        onDisplayModeChange={vi.fn()}
      />
    );

    expect(screen.getByText('62.5% (5)')).toBeTruthy();
  });

  it('keeps percentages visible when absolute display mode is selected', () => {
    render(
      <MembershipCompositionPanelView
        isLoading={false}
        displayMode="absolute"
        memberRows={[
          {
            key: 'B3',
            label: 'B3',
            memberCount: 5,
            leadershipAssignmentCount: 0,
            memberPercentage: 62.5,
            leadershipPercentage: 0,
            value: 5,
            percentage: 62.5,
            fill: '#111111',
          },
        ]}
        leadershipRows={[]}
        labels={labels}
        onDisplayModeChange={vi.fn()}
      />
    );

    expect(screen.getByText('5 (62.5%)')).toBeTruthy();
  });
});
