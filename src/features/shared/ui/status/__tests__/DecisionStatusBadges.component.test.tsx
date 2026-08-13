/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DecisionStatusBadge,
  DecisionStatusDot,
  getDecisionStatusConfig,
  type DecisionStatus,
} from '../DecisionStatusBadges';

const mocks = vi.hoisted(() => ({ dotProps: [] as any[], badgeProps: [] as any[] }));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => `translated:${key}`,
}));

vi.mock('../StatusBadges', () => ({
  StatusDotIndicator: (props: any) => {
    mocks.dotProps.push(props);
    return <div data-testid="dot" />;
  },
  StatusBadgeWithDot: ({ children, ...props }: any) => {
    mocks.badgeProps.push(props);
    return <div data-testid="badge">{children}</div>;
  },
}));

beforeEach(() => {
  mocks.dotProps.length = 0;
  mocks.badgeProps.length = 0;
});

afterEach(() => cleanup());

describe('DecisionStatusBadges', () => {
  it.each([
    ['open', 'success', false],
    ['closing_soon', 'warning', false],
    ['last_hour', 'warning', false],
    ['final_minutes', 'destructive', true],
    ['passed', 'success', false],
    ['failed', 'destructive', false],
    ['tied', 'neutral', false],
    ['elected', 'success', false],
    ['unknown', 'neutral', false],
  ] as const)('maps %s to %s tone', (status, tone, pulse) => {
    expect(getDecisionStatusConfig(status as DecisionStatus)).toMatchObject({ tone, pulse });
  });

  it('forwards config to compact and labeled badge variants', () => {
    const compact = render(<DecisionStatusBadge status="final_minutes" className="compact" />);
    expect(mocks.dotProps.at(-1)).toMatchObject({
      tone: 'destructive',
      pulse: true,
      className: 'compact',
    });
    compact.unmount();

    render(<DecisionStatusDot status="passed" className="labeled" />);
    expect(mocks.badgeProps.at(-1)).toMatchObject({
      status: 'passed',
      tone: 'success',
      dotTone: 'success',
      pulse: false,
      className: 'labeled',
    });
    expect(screen.getByTestId('badge').textContent).toContain('passed');
  });
});
