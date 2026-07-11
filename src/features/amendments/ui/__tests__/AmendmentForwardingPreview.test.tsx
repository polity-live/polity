/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AmendmentForwardingPreview } from '../AmendmentForwardingPreview';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params }: { children: ReactNode; to: string; params: { id: string } }) => (
    <a href={to.replace('$id', params.id)}>{children}</a>
  ),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'features.amendments.process.forwardingPreviewTitle':
          'On approval, this amendment forwards to the next event',
        'features.amendments.process.forwardingPreviewDescription':
          'A separate follow-up vote takes place there as soon as this step is approved.',
        'features.amendments.process.forwardingCompletedTitle':
          'This amendment was successfully forwarded to the next event',
        'features.amendments.process.forwardingCompletedDescription':
          'A separate follow-up vote is now available there.',
        'features.amendments.process.forwardingRejectedTitle':
          'This amendment was not forwarded to the next event',
        'features.amendments.process.forwardingRejectedDescription':
          'No follow-up vote was created because this step was rejected.',
        'features.amendments.process.forwardingTieTitle':
          'This amendment was not forwarded to the next event',
        'features.amendments.process.forwardingTieDescription':
          'No follow-up vote was created because this vote ended in a tie.',
      })[key] ?? key,
  }),
}));

afterEach(cleanup);

describe('AmendmentForwardingPreview', () => {
  const destination = {
    nextEventId: 'event-next',
    nextEventTitle: 'EH1',
    nextGroupName: 'H1',
    nextEventStartDate: new Date('2026-07-14T20:26:00Z').getTime(),
  };

  it('shows the pending destination with an informational background', () => {
    const { container } = render(<AmendmentForwardingPreview {...destination} />);

    expect(screen.getByText('On approval, this amendment forwards to the next event')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'EH1 · H1' }).getAttribute('href')).toBe(
      '/event/event-next/agenda'
    );
    expect(container.firstElementChild?.className).toContain('var(--badge-info-bg)');
  });

  it('shows a green completed state only when explicitly forwarded', () => {
    const { container } = render(
      <AmendmentForwardingPreview {...destination} status="forwarded" />
    );

    expect(
      screen.getByText('This amendment was successfully forwarded to the next event')
    ).toBeTruthy();
    expect(container.firstElementChild?.className).toContain('var(--badge-success-bg)');
  });

  it.each([
    ['rejected', 'this step was rejected', 'var(--badge-danger-bg)'],
    ['tie', 'this vote ended in a tie', 'var(--badge-warning-bg)'],
  ] as const)('shows the non-forwarded %s state', (status, description, color) => {
    const { container } = render(<AmendmentForwardingPreview {...destination} status={status} />);

    expect(screen.getByText(description, { exact: false })).toBeTruthy();
    expect(container.firstElementChild?.className).toContain(color);
  });
});
