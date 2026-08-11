/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('@/features/charts/ui/ChartRenderer', () => ({
  ChartRenderer: ({ valueFormatter }: any) => (
    <div>
      {valueFormatter(5, { x: 'Known' })}|{valueFormatter(7, { x: 'Missing' })}
    </div>
  ),
}));
import { MembershipCompositionPanelView } from '../MembershipCompositionPanelView';

afterEach(cleanup);
const labels = {
  title: 'Title',
  description: 'Desc',
  modePercent: '%',
  modeAbsolute: '#',
  membersTitle: 'Members',
  membersDescription: 'Desc',
  membersEmpty: 'Empty',
  leadershipTitle: 'Leaders',
  leadershipDescription: 'Desc',
  leadershipEmpty: 'Empty',
  loading: 'Loading',
  total: (count: number) => `Total ${count}`,
  leadershipFootnote: 'Footnote',
};
const row = {
  key: 'known',
  label: 'Known',
  memberCount: 2,
  leadershipAssignmentCount: 2,
  memberPercentage: 25,
  leadershipPercentage: 25,
  value: 2,
  percentage: 25,
  fill: 'red',
};

it('formats known and missing chart points in both modes and shows leadership detail', () => {
  const view = render(
    <MembershipCompositionPanelView
      isLoading={false}
      displayMode="percent"
      memberRows={[row]}
      leadershipRows={[row]}
      labels={labels}
      onDisplayModeChange={vi.fn()}
    />
  );
  expect(view.container.textContent).toContain('0.0%');
  expect(view.container.textContent).toContain('Footnote');
  view.rerender(
    <MembershipCompositionPanelView
      isLoading={false}
      displayMode="absolute"
      memberRows={[row]}
      leadershipRows={[row]}
      labels={labels}
      onDisplayModeChange={vi.fn()}
    />
  );
  expect(view.container.textContent).toContain('7');
});
