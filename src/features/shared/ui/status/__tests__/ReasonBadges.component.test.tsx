/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getReasonConfig, ReasonBadge, type ReasonCategory } from '../ReasonBadges';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => `translated:${key}` }),
}));

afterEach(() => cleanup());

describe('ReasonBadges', () => {
  it('maps all supported and defensive reason categories', () => {
    expect(getReasonConfig('trending').labelKey).toContain('trending');
    expect(getReasonConfig('popular_topic')).toMatchObject({
      labelKey: 'features.timeline.explore.reasons.popularTopic',
      contextPrefix: 'in ',
    });
    expect(getReasonConfig('similar_groups').labelKey).toContain('similarGroups');
    expect(getReasonConfig('your_content').labelKey).toContain('yourContent');
    expect(getReasonConfig('unknown' as ReasonCategory).labelKey).toContain('default');
  });

  it('adds supported context to popular-topic reasons', () => {
    render(<ReasonBadge category="popular_topic" context="Climate" className="reason" />);
    expect(
      screen.getByText('translated:features.timeline.explore.reasons.popularTopic in Climate')
    ).toBeTruthy();
    expect(screen.getByText(/popularTopic/).parentElement?.className).toContain('reason');
  });

  it('omits context when it is missing or unsupported by the category', () => {
    const missing = render(<ReasonBadge category="popular_topic" />);
    expect(
      screen.getByText('translated:features.timeline.explore.reasons.popularTopic')
    ).toBeTruthy();
    missing.unmount();

    render(<ReasonBadge category="trending" context="Ignored" />);
    expect(screen.getByText('translated:features.timeline.explore.reasons.trending')).toBeTruthy();
    expect(screen.queryByText(/Ignored/)).toBeNull();
  });
});
