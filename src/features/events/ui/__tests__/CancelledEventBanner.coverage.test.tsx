/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ language: 'en' }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: mocks.language } }),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params }: { children: ReactNode; params: { id: string } }) => (
    <a href={`/event/${params.id}`}>{children}</a>
  ),
}));

import { CancelledEventBanner } from '../CancelledEventBanner';

afterEach(cleanup);

describe('CancelledEventBanner coverage', () => {
  it('renders sparse English and complete German cancellation metadata', () => {
    const { rerender } = render(<CancelledEventBanner />);
    expect(screen.getByText('features.events.detail.status.cancelled')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();

    mocks.language = 'de';
    rerender(
      <CancelledEventBanner
        cancellationReason="Venue unavailable"
        cancelledAt={Date.now() - 60_000}
        cancelledByName="Ada"
        reassignmentEventId="event-2"
        reassignmentEventTitle="Replacement"
      />
    );
    expect(screen.getByText('Venue unavailable')).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Replacement/ }).getAttribute('href')).toBe(
      '/event/event-2'
    );

    rerender(<CancelledEventBanner reassignmentEventId="event-2" />);
    expect(screen.queryByRole('link')).toBeNull();
    rerender(<CancelledEventBanner reassignmentEventTitle="Replacement" />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
