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
  it('dispatches menu, search, documentation, and logout actions through stable intents', () => {
    const onOpenChange = vi.fn();
    const onLogoutDialogOpenChange = vi.fn();
    const onClearGroupSearch = vi.fn();
    const onClearEventSearch = vi.fn();
    const onClearAmendmentSearch = vi.fn();
    const onLogout = vi.fn();
    render(
      <UserMenuView
        {...buildMinimalProps(onOpenChange)}
        groups={[{ id: 'group-1', name: 'Group', image_url: null }]}
        events={[{ key: 'event-1', id: 'event-1', title: 'Event', start_date: Date.now() }]}
        amendments={[{ id: 'amendment-1', title: 'Amendment' }]}
        showGroupSearch
        showEventSearch
        showAmendmentSearch
        groupSearchQuery="g"
        eventSearchQuery="e"
        amendmentSearchQuery="a"
        logoutDialogOpen
        onLogoutDialogOpenChange={onLogoutDialogOpenChange}
        onClearGroupSearch={onClearGroupSearch}
        onClearEventSearch={onClearEventSearch}
        onClearAmendmentSearch={onClearAmendmentSearch}
        onLogout={onLogout}
      />
    );

    expect(document.querySelector('[data-action-id="navigation.user-menu.open"]')).toBeTruthy();
    expect(
      document.querySelector('[data-action-id="navigation.user-menu.profile.open"]')
    ).toBeTruthy();
    expect(
      document.querySelector('[data-action-id="navigation.user-menu.settings.open"]')
    ).toBeTruthy();
    fireEvent.click(
      document.querySelector('[data-action-id="navigation.user-menu.events.toggle"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="navigation.user-menu.amendments.toggle"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="navigation.user-menu.groups-search.clear"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="navigation.user-menu.events-search.clear"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="navigation.user-menu.amendments-search.clear"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="navigation.user-menu.docs-dialog.open"]')!
    );
    expect(
      document.querySelector('[data-action-id="navigation.user-menu.documentation.open"]')
    ).toBeTruthy();
    fireEvent.click(
      document.querySelector('[data-action-id="navigation.user-menu.logout-dialog.open"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="navigation.user-menu.logout.confirm"]')!
    );

    expect(onClearGroupSearch).toHaveBeenCalledOnce();
    expect(onClearEventSearch).toHaveBeenCalledOnce();
    expect(onClearAmendmentSearch).toHaveBeenCalledOnce();
    expect(onLogoutDialogOpenChange).toHaveBeenCalledWith(true);
    expect(onLogout).toHaveBeenCalledOnce();
  });

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

  it('covers mobile, search, entity fallback, and optional menu callback states', () => {
    const onGroupSearchChange = vi.fn();
    const onEventSearchChange = vi.fn();
    const onAmendmentSearchChange = vi.fn();
    render(
      <UserMenuView
        {...buildMinimalProps(vi.fn())}
        isMobile
        onOpenChange={undefined}
        displayAvatar="avatar.png"
        groups={[{ id: 'group-fallback', name: null, image_url: 'group.png' } as any]}
        events={[
          {
            id: 'event-fallback',
            key: 'event-fallback:key',
            start_date: 0,
            title: null,
          } as any,
        ]}
        amendments={[{ id: 'amendment-fallback', title: null } as any]}
        showGroupSearch
        showEventSearch
        showAmendmentSearch
        onGroupSearchChange={onGroupSearchChange}
        onEventSearchChange={onEventSearchChange}
        onAmendmentSearchChange={onAmendmentSearchChange}
      />
    );

    expect(screen.getByText('G')).toBeTruthy();
    const groupInput = screen.getByPlaceholderText('Search groups...');
    fireEvent.change(groupInput, { target: { value: 'group' } });
    fireEvent.keyDown(groupInput, { key: 'x' });
    fireEvent.pointerDown(groupInput);
    expect(onGroupSearchChange).toHaveBeenCalledWith('group');

    fireEvent.click(screen.getByRole('button', { name: 'Events' }));
    const eventInput = screen.getByPlaceholderText('Search events...');
    fireEvent.change(eventInput, { target: { value: 'event' } });
    fireEvent.keyDown(eventInput, { key: 'x' });
    fireEvent.pointerDown(eventInput);
    expect(onEventSearchChange).toHaveBeenCalledWith('event');
    expect(screen.getByText('Event')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Amendments' }));
    const amendmentInput = screen.getByPlaceholderText('Search amendments...');
    fireEvent.change(amendmentInput, { target: { value: 'amendment' } });
    fireEvent.keyDown(amendmentInput, { key: 'x' });
    fireEvent.pointerDown(amendmentInput);
    expect(onAmendmentSearchChange).toHaveBeenCalledWith('amendment');
    expect(screen.getByText('Amendment')).toBeTruthy();

    for (const label of [
      'Tutorial',
      'AI assistant',
      'Documentation',
      'Feedback, Feature Requests & Bugs',
    ]) {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Documentation & Feedback' }));
      fireEvent.click(screen.getByRole('link', { name: label }));
    }
  });

  it('shows the navigation loading state independently of empty entity sections', () => {
    render(<UserMenuView {...buildMinimalProps(vi.fn())} navigationEntitiesLoading />);
    const loading = screen.getByTestId('user-menu-navigation-loading');
    expect(loading.textContent).toBe('Loading...');
    expect(loading.getAttribute('aria-live')).toBe('polite');
    expect(loading.getAttribute('role')).toBe('menuitem');
    expect(loading.getAttribute('aria-disabled')).toBe('true');
    expect(loading.closest('[aria-hidden="true"]')).toBeNull();
    expect(screen.getByRole('menu').querySelector('[role="status"]')).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Loading...' })).toBe(loading);
    expect(screen.queryByTestId('user-menu-navigation-sections')).toBeNull();
  });

  it('renders each entity section independently with search disabled', () => {
    const base = buildMinimalProps(vi.fn());
    const view = render(
      <UserMenuView
        {...base}
        events={[{ id: 'event-only', key: 'event-only:key', start_date: 0, title: 'Event only' }]}
      />
    );
    expect(screen.queryByTestId('user-menu-groups-accordion')).toBeNull();
    expect(screen.queryByTestId('user-menu-amendments-accordion')).toBeNull();

    view.rerender(
      <UserMenuView {...base} amendments={[{ id: 'amendment-only', title: 'Amendment only' }]} />
    );
    expect(screen.queryByTestId('user-menu-events-accordion')).toBeNull();

    view.rerender(
      <UserMenuView
        {...base}
        groups={[{ id: 'group-only', name: 'Group only', image_url: null }]}
      />
    );
    expect(screen.queryByTestId('user-menu-events-accordion')).toBeNull();
    expect(screen.queryByTestId('user-menu-amendments-accordion')).toBeNull();
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
