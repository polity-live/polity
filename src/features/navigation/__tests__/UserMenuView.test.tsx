/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UserMenuView } from '../UserMenuView';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params, to, ...props }: any) => {
    const href = typeof to === 'string' ? to.replace('$id', params?.id ?? '') : '#';
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

afterEach(cleanup);

describe('UserMenuView', () => {
  it('renders role-based groups and events in separate scrollable sections', () => {
    render(
      <UserMenuView
        open
        onOpenChange={vi.fn()}
        displayName="Ada Lovelace"
        displayEmail="ada@example.com"
        userInitials="AL"
        profileHref="/user/user-1"
        settingsHref="/user/user-1/settings"
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
        showGroupSearch={false}
        showEventSearch
        groupSearchQuery=""
        eventSearchQuery=""
        groupSearchInputRef={createRef<HTMLInputElement>()}
        eventSearchInputRef={createRef<HTMLInputElement>()}
        labels={{
          profile: 'Profile',
          settings: 'Settings',
          groups: 'Groups',
          events: 'Events',
          eventFallback: 'Event',
          searchGroupsPlaceholder: 'Search groups...',
          searchEventsPlaceholder: 'Search events...',
          clear: 'Clear',
          logout: 'Log out',
          logoutConfirm: 'Really log out?',
          cancel: 'Cancel',
        }}
        logoutDialogOpen={false}
        onLogoutDialogOpenChange={vi.fn()}
        onGroupSearchChange={vi.fn()}
        onEventSearchChange={vi.fn()}
        onClearGroupSearch={vi.fn()}
        onClearEventSearch={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    expect(screen.getByText('Groups')).toBeTruthy();
    expect(screen.getByText('Events')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search events...')).toBeTruthy();
    const hrefs = screen.getAllByRole('menuitem').map(item => item.getAttribute('href'));

    expect(hrefs).toEqual(expect.arrayContaining(['/group/group-1', '/event/event-1']));

    const groupsList = screen.getByTestId('user-menu-groups-list');
    const eventsList = screen.getByTestId('user-menu-events-list');

    expect(groupsList.className).toContain('overflow-y-auto');
    expect(groupsList.className).toContain('min-h-0');
    expect(eventsList.className).toContain('overflow-y-auto');
    expect(eventsList.className).toContain('min-h-0');
  });
});
