/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
          groups: 'Groups',
          events: 'Events',
          amendments: 'Amendments',
          eventFallback: 'Event',
          amendmentFallback: 'Amendment',
          searchGroupsPlaceholder: 'Search groups...',
          searchEventsPlaceholder: 'Search events...',
          searchAmendmentsPlaceholder: 'Search amendments...',
          clear: 'Clear',
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
    expect(groupsList.className).toContain('min-h-0');
    expect(eventsList.className).toContain('overflow-y-auto');
    expect(eventsList.className).toContain('min-h-0');
    expect(amendmentsList.className).toContain('overflow-y-auto');
    expect(amendmentsList.className).toContain('min-h-0');
  });
});
