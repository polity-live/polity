// @vitest-environment jsdom

import * as React from 'react';

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  props: undefined as any,
  translate: vi.fn((key: string, values: { count: number }) => `${key}:${values.count}`),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: mocks.translate }));

vi.mock('@/features/shared/ui/layout/StatsBar', () => ({
  StatsBar: (props: unknown) => {
    mocks.props = props;
    return <div data-testid="stats-bar" />;
  },
}));

import { SubscriberStatsBar } from '../SubscriberStatsBar';

describe('SubscriberStatsBar', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('renders only an unformatted subscriber count with default animation props', () => {
    render(<SubscriberStatsBar subscriberCount={999} />);

    expect(mocks.props).toMatchObject({
      animationRef: undefined,
      animationText: '',
      items: [
        {
          label: 'components.labels.subscribers:999',
          unit: '',
          value: 999,
        },
      ],
      showAnimation: false,
    });
  });

  it('keeps provided small optional counts unformatted', () => {
    render(
      <SubscriberStatsBar
        subscriberCount={7}
        memberCount={1}
        collaboratorCount={2}
        participantCount={3}
        amendmentCollaborationsCount={4}
      />
    );

    expect(mocks.props.items).toEqual([
      { label: 'components.labels.members:1', unit: '', value: 1 },
      { label: 'components.labels.collaborators:2', unit: '', value: 2 },
      { label: 'components.labels.participants:3', unit: '', value: 3 },
      { label: 'components.labels.amendmentCollaborations:4', unit: '', value: 4 },
      { label: 'components.labels.subscribers:7', unit: '', value: 7 },
    ]);
  });

  it('formats thousands and millions for every count and forwards animation props', () => {
    const animationRef = React.createRef<HTMLDivElement>();
    render(
      <SubscriberStatsBar
        subscriberCount={2_500_000}
        memberCount={1_250}
        collaboratorCount={2_100_000}
        participantCount={3_400}
        amendmentCollaborationsCount={4_500_000}
        showAnimation
        animationText="Growing"
        animationRef={animationRef}
      />
    );

    expect(mocks.props.items).toEqual([
      { label: 'components.labels.members:1250', unit: 'k', value: 1.3 },
      { label: 'components.labels.collaborators:2100000', unit: 'M', value: 2.1 },
      { label: 'components.labels.participants:3400', unit: 'k', value: 3.4 },
      { label: 'components.labels.amendmentCollaborations:4500000', unit: 'M', value: 4.5 },
      { label: 'components.labels.subscribers:2500000', unit: 'M', value: 2.5 },
    ]);
    expect(mocks.props.showAnimation).toBe(true);
    expect(mocks.props.animationText).toBe('Growing');
    expect(mocks.props.animationRef).toBe(animationRef);
  });
});
