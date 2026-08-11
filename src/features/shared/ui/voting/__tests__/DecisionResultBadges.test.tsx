/* @vitest-environment jsdom */

import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DecisionResultBadge,
  DecisionResultCompact,
  getDecisionResultConfig,
  type DecisionResultType,
} from '../DecisionResultBadges';

const mocks = vi.hoisted(() => ({
  badgeProps: [] as Record<string, unknown>[],
  compactProps: [] as Record<string, unknown>[],
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => `translated:${key}` }),
}));

vi.mock('../VotingControls', () => ({
  VotingResultBadge: (props: Record<string, unknown>) => {
    mocks.badgeProps.push(props);
    return <div data-testid="badge" />;
  },
  VotingResultCompact: (props: Record<string, unknown>) => {
    mocks.compactProps.push(props);
    return <div data-testid="compact" />;
  },
}));

beforeEach(() => {
  mocks.badgeProps.length = 0;
  mocks.compactProps.length = 0;
});

describe('DecisionResultBadges', () => {
  it('maps every result, including defensive unknown input, to a config', () => {
    expect(getDecisionResultConfig('passed')).toMatchObject({ tone: 'success' });
    expect(getDecisionResultConfig('failed')).toMatchObject({ tone: 'destructive' });
    expect(getDecisionResultConfig('tied')).toMatchObject({ tone: 'neutral' });
    expect(getDecisionResultConfig('elected')).toMatchObject({ tone: 'success' });
    expect(getDecisionResultConfig('unknown' as DecisionResultType)).toMatchObject({
      labelKey: 'features.timeline.terminal.results.unspecified',
      tone: 'neutral',
    });
  });

  it('forwards elected winner details and honors an explicit icon preference', () => {
    const elected = render(
      <DecisionResultBadge result="elected" winnerName="Ada" percentage={61} className="result" />
    );
    expect(mocks.badgeProps.at(-1)).toMatchObject({
      status: 'elected',
      winnerName: 'Ada',
      percentage: 61,
      showIcon: true,
      className: 'result',
    });
    elected.unmount();

    render(<DecisionResultBadge result="passed" winnerName="Ignored" showIcon={false} />);
    expect(mocks.badgeProps.at(-1)).toMatchObject({
      status: 'passed',
      winnerName: undefined,
      showIcon: false,
    });
  });

  it.each([
    ['passed', undefined, 'success'],
    ['elected', undefined, 'success'],
    ['failed', undefined, 'destructive'],
    ['tied', undefined, 'destructive'],
    ['unknown', undefined, 'neutral'],
  ] as const)('maps compact %s results to %s tone', (result, winnerName, tone) => {
    render(
      <DecisionResultCompact
        result={result as DecisionResultType}
        winnerName={winnerName}
        className="compact"
      />
    );
    expect(mocks.compactProps.at(-1)).toMatchObject({ tone, className: 'compact' });
  });

  it('uses the elected winner name as the compact label', () => {
    render(<DecisionResultCompact result="elected" winnerName="Grace" />);
    expect(mocks.compactProps.at(-1)).toMatchObject({ label: 'Grace', tone: 'success' });
  });
});
