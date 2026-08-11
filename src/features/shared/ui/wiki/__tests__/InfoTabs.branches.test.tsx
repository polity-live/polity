// @vitest-environment jsdom

import * as React from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ language: 'en' }));

vi.mock('@/features/shared/hooks/use-translation.ts', () => ({
  useTranslation: () => ({
    language: mocks.language,
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/shared/ui/ui/tabs.tsx', () => ({
  Tabs: ({ children, defaultValue, ...props }: any) => (
    <div data-default={defaultValue} {...props}>
      {children}
    </div>
  ),
  TabsContent: ({ children, value }: any) => <section data-content={value}>{children}</section>,
  TabsTrigger: ({ children, value }: any) => <button data-value={value}>{children}</button>,
}));

vi.mock('@/features/shared/ui/navigation/ScrollableTabs', () => ({
  ScrollableTabsList: ({ children }: React.PropsWithChildren) => <nav>{children}</nav>,
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
    const { container } = render(<InfoTabs about="About text" className="tabs" />);
    expect(container.firstElementChild?.getAttribute('data-default')).toBe('about');
    expect(screen.getByText('About text')).toBeTruthy();
    expect(document.querySelector('[data-value="location"]')).toBeNull();
  });

  it('renders coordinates, event dates, end time, location cards, and tags', () => {
    const start = new Date('2025-01-02T10:00:00Z').getTime();
    const end = new Date('2025-01-02T12:30:00Z').getTime();
    const { container } = render(
      <InfoTabs
        contact={{ city: 'Berlin', latitude: 52.5, longitude: 13.4 }}
        eventDetails={{ endDate: end, startDate: start, tags: ['assembly', 'public'] }}
      />
    );
    expect(container.firstElementChild?.getAttribute('data-default')).toBe('location');
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
});
