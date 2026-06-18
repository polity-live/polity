/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { buildWikiRosterSummary, WikiRosterSummaryCard } from '../WikiRosterSummaryCard';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
}));

describe('buildWikiRosterSummary', () => {
  it('calculates non signed-up users from total and distinct signed-up users', () => {
    const summary = buildWikiRosterSummary({
      totalCount: 10,
      items: [
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
        { userId: 'user-4' },
        { userId: 'user-5' },
        { userId: 'user-6' },
        { userId: 'user-7' },
      ],
    });

    expect(summary).toEqual({
      totalCount: 10,
      signedUpCount: 7,
      nonSignedUpCount: 3,
    });
  });

  it('counts duplicate signed-up user rows once', () => {
    const summary = buildWikiRosterSummary({
      totalCount: 4,
      items: [{ userId: 'user-1' }, { userId: 'user-1' }, { userId: 'user-2' }],
    });

    expect(summary.signedUpCount).toBe(2);
    expect(summary.nonSignedUpCount).toBe(2);
  });

  it('clamps non signed-up users to zero when total is lower than signed-up rows', () => {
    const summary = buildWikiRosterSummary({
      totalCount: 1,
      items: [{ userId: 'user-1' }, { userId: 'user-2' }],
    });

    expect(summary.signedUpCount).toBe(2);
    expect(summary.nonSignedUpCount).toBe(0);
  });
});

describe('WikiRosterSummaryCard', () => {
  it('shows only the non signed-up count', () => {
    const { container } = render(
      <WikiRosterSummaryCard
        totalCount={5}
        items={[{ userId: 'user-1' }, { userId: 'user-2' }, { userId: 'user-2' }]}
      />
    );

    expect(screen.getByText('Non signed-up users')).toBeTruthy();
    expect(screen.queryByText('Total roster')).toBeNull();
    expect(screen.queryByText('Signed-up users')).toBeNull();
    expect(container.textContent).toContain('3');
  });

  it('does not render offline roster names or reasons', () => {
    const { container } = render(
      <WikiRosterSummaryCard totalCount={3} items={[{ userId: 'user-1' }]} />
    );

    expect(container.textContent).not.toContain('Offline Guest');
    expect(container.textContent).not.toContain('No email address');
  });
});
