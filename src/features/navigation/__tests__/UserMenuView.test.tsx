/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UserMenuView } from '../UserMenuView';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params, preload, search, to, ...props }: any) => {
    const path = typeof to === 'string' ? to.replace('$id', params?.id ?? '') : '#';
    const query = search ? `?${new URLSearchParams(search).toString()}` : '';
    const href = `${path}${query}`;
    void preload;
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

afterEach(cleanup);

describe('UserMenuView', () => {
  it('renders role-based groups, events, and amendments in accordion sections', () => {
    render(
      <UserMenuView
        open
        onOpenChange={vi.fn()}
        displayName="Ada Lovelace"
        displayEmail="ada@example.com"
        userInitials="AL"
        profileHref="/user/user-1"
        settingsHref="/user/user-1/settings"
        navigationEntitiesLoading={false}
        groups={[{ id: 'group-1', name: 'Working Circle', image_url: null }]}
        events={[
          {
            key: 'event-1:participation-1',
            id: 'event-1',
            title: 'Future Assembly',
            start_date: new Date('2026-06-20T10:00:00Z').getTime(),
            groupName: 'Working Circle',
            locationName: 'Berlin',
          },
        ]}
        amendments={[
          {
            id: 'amendment-1',
            title: 'Open Motion',
            code: 'A-1',
            groupName: 'Working Circle',
            targetGroupName: 'Policy Board',
            eventTitle: 'Future Assembly',
          },
        ]}
        showGroupSearch={false}
        showEventSearch
        showAmendmentSearch
        groupSearchQuery=""
        eventSearchQuery=""
        amendmentSearchQuery=""
        groupSearchInputRef={createRef<HTMLInputElement>()}
        eventSearchInputRef={createRef<HTMLInputElement>()}
        amendmentSearchInputRef={createRef<HTMLInputElement>()}
        labels={{
          profile: 'Profile',
          settings: 'Settings',
          docs: 'Documentation & Feedback',
          docsDialogDescription: 'Choose an option.',
          tutorial: 'Tutorial',
          aiAssistant: 'AI assistant',
          documentation: 'Documentation',
          feedback: 'Feedback, Feature Requests & Bugs',
          groups: 'Groups',
          events: 'Events',
          amendments: 'Amendments',
          eventFallback: 'Event',
          amendmentFallback: 'Amendment',
          searchGroupsPlaceholder: 'Search groups...',
          searchEventsPlaceholder: 'Search events...',
          searchAmendmentsPlaceholder: 'Search amendments...',
          clear: 'Clear',
          loading: 'Loading...',
          logout: 'Log out',
          logoutConfirm: 'Really log out?',
          cancel: 'Cancel',
        }}
        logoutDialogOpen={false}
        onLogoutDialogOpenChange={vi.fn()}
        onGroupSearchChange={vi.fn()}
        onEventSearchChange={vi.fn()}
        onAmendmentSearchChange={vi.fn()}
        onClearGroupSearch={vi.fn()}
        onClearEventSearch={vi.fn()}
        onClearAmendmentSearch={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    const groupsTrigger = screen.getByRole('button', { name: 'Groups' });
    const eventsTrigger = screen.getByRole('button', { name: 'Events' });
    const amendmentsTrigger = screen.getByRole('button', { name: 'Amendments' });
    const sections = screen.getByTestId('user-menu-navigation-sections');

    expect(screen.getByTestId('user-menu-groups-accordion')).toBeTruthy();
    expect(screen.getByTestId('user-menu-events-accordion')).toBeTruthy();
    expect(screen.getByTestId('user-menu-amendments-accordion')).toBeTruthy();
    expect(sections.className).toContain('overflow-x-hidden');
    expect(groupsTrigger.getAttribute('data-state')).toBe('open');
    expect(eventsTrigger.getAttribute('data-state')).toBe('closed');
    expect(amendmentsTrigger.getAttribute('data-state')).toBe('closed');
    expect(screen.getByText('Working Circle')).toBeTruthy();

    fireEvent.click(eventsTrigger);
    fireEvent.click(amendmentsTrigger);

    expect(screen.getByPlaceholderText('Search events...')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search amendments...')).toBeTruthy();
    expect(screen.getByText('Open Motion')).toBeTruthy();
    expect(screen.getByText(/Policy Board/)).toBeTruthy();
    const hrefs = screen.getAllByRole('menuitem').map(item => item.getAttribute('href'));

    expect(hrefs).toEqual(
      expect.arrayContaining(['/group/group-1', '/event/event-1', '/amendment/amendment-1'])
    );

    const groupsList = screen.getByTestId('user-menu-groups-list');
    const eventsList = screen.getByTestId('user-menu-events-list');
    const amendmentsList = screen.getByTestId('user-menu-amendments-list');

    expect(groupsList.className).toContain('overflow-y-auto');
    expect(groupsList.className).toContain('overflow-x-hidden');
    expect(groupsList.className).toContain('min-h-0');
    expect(eventsList.className).toContain('overflow-y-auto');
    expect(eventsList.className).toContain('overflow-x-hidden');
    expect(eventsList.className).toContain('min-h-0');
    expect(amendmentsList.className).toContain('overflow-y-auto');
    expect(amendmentsList.className).toContain('overflow-x-hidden');
    expect(amendmentsList.className).toContain('min-h-0');
  });

  it('opens the documentation and feedback dialog with all card destinations', () => {
    const onOpenChange = vi.fn();
    render(<UserMenuView {...buildMinimalProps(onOpenChange)} />);

    fireEvent.click(
      screen.getByRole('menuitem', {
        name: 'Documentation & Feedback',
      })
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(
      screen.getByRole('heading', {
        name: 'Documentation & Feedback',
      })
    ).toBeTruthy();
    expect(screen.getByText('Choose an option.')).toBeTruthy();
    expect(
      within(screen.getByRole('dialog'))
        .getAllByRole('link')
        .map(link => link.textContent)
    ).toEqual(['Tutorial', 'AI assistant', 'Documentation', 'Feedback, Feature Requests & Bugs']);
    expect(screen.getByRole('link', { name: 'Tutorial' }).getAttribute('href')).toBe(
      '/onboarding?restart=false'
    );
    expect(screen.getByRole('link', { name: 'AI assistant' }).getAttribute('href')).toBe(
      '/messages?new=ai'
    );
    expect(screen.getByRole('link', { name: 'Documentation' }).getAttribute('href')).toBe('/docs');

    const feedback = screen.getByRole('link', {
      name: 'Feedback, Feature Requests & Bugs',
    });
    expect(feedback.getAttribute('href')).toBe('https://github.com/polity-live/polity/issues');
    expect(feedback.getAttribute('target')).toBe('_blank');
    expect(feedback.getAttribute('rel')).toBe('noopener noreferrer');
  });
});

function buildMinimalProps(onOpenChange: (open: boolean) => void) {
  return {
    open: true,
    onOpenChange,
    displayName: 'Ada Lovelace',
    displayEmail: 'ada@example.com',
    userInitials: 'AL',
    profileHref: '/user/user-1',
    settingsHref: '/user/user-1/settings',
    navigationEntitiesLoading: false,
    groups: [],
    events: [],
    amendments: [],
    showGroupSearch: false,
    showEventSearch: false,
    showAmendmentSearch: false,
    groupSearchQuery: '',
    eventSearchQuery: '',
    amendmentSearchQuery: '',
    groupSearchInputRef: createRef<HTMLInputElement>(),
    eventSearchInputRef: createRef<HTMLInputElement>(),
    amendmentSearchInputRef: createRef<HTMLInputElement>(),
    labels: {
      profile: 'Profile',
      settings: 'Settings',
      docs: 'Documentation & Feedback',
      docsDialogDescription: 'Choose an option.',
      tutorial: 'Tutorial',
      aiAssistant: 'AI assistant',
      documentation: 'Documentation',
      feedback: 'Feedback, Feature Requests & Bugs',
      groups: 'Groups',
      events: 'Events',
      amendments: 'Amendments',
      eventFallback: 'Event',
      amendmentFallback: 'Amendment',
      searchGroupsPlaceholder: 'Search groups...',
      searchEventsPlaceholder: 'Search events...',
      searchAmendmentsPlaceholder: 'Search amendments...',
      clear: 'Clear',
      loading: 'Loading...',
      logout: 'Log out',
      logoutConfirm: 'Really log out?',
      cancel: 'Cancel',
    },
    logoutDialogOpen: false,
    onLogoutDialogOpenChange: vi.fn(),
    onGroupSearchChange: vi.fn(),
    onEventSearchChange: vi.fn(),
    onAmendmentSearchChange: vi.fn(),
    onClearGroupSearch: vi.fn(),
    onClearEventSearch: vi.fn(),
    onClearAmendmentSearch: vi.fn(),
    onLogout: vi.fn(),
  };
}
