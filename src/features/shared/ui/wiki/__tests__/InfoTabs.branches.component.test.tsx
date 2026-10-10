// @vitest-environment jsdom

import * as React from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ language: 'en' }));

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({
    language: mocks.language,
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/shared/ui/ui/card.tsx', () => ({
  Card: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/features/shared/ui/ui/badge.tsx', () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));

vi.mock('@/features/shared/ui/rich-text', () => ({
  RichTextPreview: ({ content, emptyText }: any) => (
    <div>{content ? String(content) : emptyText}</div>
  ),
}));

vi.mock('@/features/shared/ui/form/GeoAddressMap', () => ({
  GeoAddressMap: ({ coordinates, onCoordinatesChange }: any) => (
    <button type="button" data-testid="map" onClick={() => onCoordinatesChange(coordinates)}>
      {coordinates.latitude},{coordinates.longitude}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  Activity: () => <i />,
  Calendar: () => <i />,
  Globe: () => <i />,
  Ghost: () => <i />,
  Mail: () => <i />,
  MapPin: () => <i />,
  MessageSquare: () => <i />,
  Music2: () => <i />,
}));

vi.mock('@/features/shared/ui/icons', () => ({
  FacebookIcon: () => <i />,
  InstagramIcon: () => <i />,
  LinkedinIcon: () => <i />,
  TwitterIcon: () => <i />,
  YoutubeIcon: () => <i />,
}));

import { InfoTabs } from '../InfoTabs';

describe('InfoTabs branch contracts', () => {
  beforeEach(() => {
    mocks.language = 'en';
  });
  afterEach(cleanup);

  it('renders nothing without any content', () => {
    const { container } = render(<InfoTabs />);
    expect(container.firstChild).toBeNull();
  });

  it('selects about by default and omits a location tab without location data', () => {
    render(<InfoTabs about="About text" className="tabs" />);
    expect(
      screen.getByRole('tab', { name: 'components.infoTabs.about' }).getAttribute('aria-selected')
    ).toBe('true');
    expect(screen.getByText('About text')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'components.infoTabs.labels.location' })).toBeNull();
  });

  it('renders coordinates, event dates, end time, location cards, and tags', () => {
    const start = new Date('2025-01-02T10:00:00Z').getTime();
    const end = new Date('2025-01-02T12:30:00Z').getTime();
    render(
      <InfoTabs
        contact={{ city: 'Berlin', latitude: 52.5, longitude: 13.4 }}
        eventDetails={{ endDate: end, startDate: start, tags: ['assembly', 'public'] }}
      />
    );
    expect(
      screen
        .getByRole('tab', { name: 'components.infoTabs.locationAndDate' })
        .getAttribute('aria-selected')
    ).toBe('true');
    expect(screen.getByTestId('map')).toBeTruthy();
    fireEvent.click(screen.getByTestId('map'));
    expect(screen.getByText('Berlin')).toBeTruthy();
    expect(screen.getByText('assembly')).toBeTruthy();
    expect(screen.getByText('public')).toBeTruthy();
    expect(screen.getByText(/ - /)).toBeTruthy();
    expect(screen.getByText('components.infoTabs.locationAndDate')).toBeTruthy();
  });

  it('formats a German event without an end time and uses a fallback location', () => {
    mocks.language = 'de';
    const start = new Date('2025-02-03T10:00:00Z').getTime();
    render(
      <InfoTabs contact={{ location: 'Fallback place' }} eventDetails={{ startDate: start }} />
    );
    expect(screen.getByText('Fallback place')).toBeTruthy();
    expect(screen.getByText(/Montag/)).toBeTruthy();
    expect(screen.queryByText(/ - /)).toBeNull();
  });

  it('shows the no-location state for empty event details', () => {
    render(<InfoTabs eventDetails={{}} />);
    expect(screen.getByText('components.infoTabs.noLocation')).toBeTruthy();
    expect(screen.getByText('components.infoTabs.locationAndDate')).toBeTruthy();
  });

  it('handles non-array and empty tag values without rendering badges', () => {
    const nonArray = render(<InfoTabs eventDetails={{ tags: 'tag' as any }} />);
    expect(screen.queryByText('tag')).toBeNull();
    nonArray.unmount();

    render(<InfoTabs eventDetails={{ tags: [] }} />);
    expect(screen.queryByText('tag')).toBeNull();
  });

  it('renders the optional activity tab and content without changing the default tab', () => {
    render(<InfoTabs about="About" activity={<div>Activity content</div>} />);
    expect(
      screen.getByRole('tab', { name: 'components.infoTabs.about' }).getAttribute('aria-selected')
    ).toBe('true');
    expect(screen.getByText('components.activityLog.title')).toBeTruthy();
    expect(screen.queryByText('Activity content')).toBeNull();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'components.activityLog.title' }), {
      button: 0,
    });
    expect(screen.getByText('Activity content')).toBeTruthy();
  });
  it('links panels to triggers and preserves keyboard selection while unmounting inactive content', async () => {
    const user = userEvent.setup();
    render(<InfoTabs about="About" contact={{ email: 'member@example.test' }} />);
    const about = screen.getByRole('tab', { name: 'components.infoTabs.about' });
    const contact = screen.getByRole('tab', { name: 'components.infoTabs.contact' });
    const panel = screen.getByRole('tabpanel');
    expect(panel.id).toBe(about.getAttribute('aria-controls'));
    expect(panel.getAttribute('aria-labelledby')).toBe(about.id);
    expect(panel.style.animationDuration).toBe('0s');
    expect(screen.queryByText('member@example.test')).toBeNull();
    about.focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(contact);
    expect(contact.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').id).toBe(contact.getAttribute('aria-controls'));
    expect(screen.getByText('member@example.test')).toBeTruthy();
    expect(screen.queryByText('About')).toBeNull();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByText('About')).toBeTruthy();
    expect(screen.queryByText('member@example.test')).toBeNull();
  });
  it('selects the data-driven default when content arrives after an empty render', () => {
    const view = render(<InfoTabs />);
    view.rerender(<InfoTabs about="Arrived" />);
    expect(screen.getByText('Arrived')).toBeTruthy();
    expect(
      screen.getByRole('tab', { name: 'components.infoTabs.about' }).getAttribute('aria-selected')
    ).toBe('true');
  });
});
