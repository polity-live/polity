/* @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NavigationCommandDialogView } from '../NavigationCommandDialogView';
import type { NavigationItem } from '../types/navigation.types';

vi.mock('@/features/shared/ui/ui/command.tsx', () => ({
  CommandDialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  CommandInput: ({ placeholder }: { placeholder?: string }) => <input placeholder={placeholder} />,
  CommandList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children, heading }: { children: ReactNode; heading: string }) => (
    <section aria-label={heading}>
      <h2>{heading}</h2>
      {children}
    </section>
  ),
  CommandItem: ({
    children,
    onSelect,
    value,
  }: {
    children: ReactNode;
    onSelect?: () => void;
    value?: string;
  }) => (
    <button data-value={value} onClick={() => onSelect?.()}>
      {children}
    </button>
  ),
  CommandSeparator: () => <hr />,
  CommandShortcut: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

afterEach(cleanup);

const primaryNavItems: NavigationItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: 'Home',
    href: '/home',
  },
];

const copy = {
  placeholder: 'Type a command or search...',
  noResults: 'No results found.',
  primaryNavigation: 'Primary Navigation',
  userNavigation: 'User Navigation',
  groups: 'Groups',
  events: 'Events',
  amendments: 'Amendments',
  eventFallback: 'Event',
  amendmentFallback: 'Amendment',
};

describe('NavigationCommandDialogView', () => {
  it('renders user groups and events as command groups', () => {
    const onSelectGroupItem = vi.fn();
    const onSelectEventItem = vi.fn();
    const onSelectAmendmentItem = vi.fn();

    render(
      <NavigationCommandDialogView
        open
        onOpenChange={vi.fn()}
        copy={copy}
        primaryNavItems={primaryNavItems}
        userNavItems={[]}
        groupItems={[{ id: 'group-1', name: 'Working Circle', image_url: null }]}
        eventItems={[
          {
            key: 'event-1:participation-1',
            id: 'event-1',
            title: 'Future Assembly',
            start_date: new Date('2030-01-01T10:00:00Z').getTime(),
            groupName: 'Working Circle',
            locationName: 'Berlin',
          },
        ]}
        amendmentItems={[
          {
            id: 'amendment-1',
            title: 'Open Motion',
            code: 'A-1',
            targetGroupName: 'Policy Board',
            groupName: 'Working Circle',
            eventTitle: 'Future Assembly',
          },
        ]}
        onSelectPrimaryItem={vi.fn()}
        onSelectUserItem={vi.fn()}
        onSelectGroupItem={onSelectGroupItem}
        onSelectEventItem={onSelectEventItem}
        onSelectAmendmentItem={onSelectAmendmentItem}
      />
    );

    expect(screen.getByRole('region', { name: 'Groups' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Events' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Amendments' })).toBeTruthy();
    expect(screen.getByText('Working Circle')).toBeTruthy();
    expect(screen.getByText('Future Assembly')).toBeTruthy();
    expect(screen.getByText(/Berlin/)).toBeTruthy();
    expect(screen.getByText('Open Motion')).toBeTruthy();
    expect(screen.getByText(/Policy Board/)).toBeTruthy();

    fireEvent.click(screen.getByText('Working Circle'));
    fireEvent.click(screen.getByText('Future Assembly'));
    fireEvent.click(screen.getByText('Open Motion'));

    expect(onSelectGroupItem).toHaveBeenCalledWith({
      id: 'group-1',
      name: 'Working Circle',
      image_url: null,
    });
    expect(onSelectEventItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'event-1',
        title: 'Future Assembly',
      })
    );
    expect(onSelectAmendmentItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'amendment-1',
        title: 'Open Motion',
      })
    );
  });

  it('does not render group or event sections when the lists are empty', () => {
    render(
      <NavigationCommandDialogView
        open
        onOpenChange={vi.fn()}
        copy={copy}
        primaryNavItems={primaryNavItems}
        userNavItems={[]}
        groupItems={[]}
        eventItems={[]}
        amendmentItems={[]}
        onSelectPrimaryItem={vi.fn()}
        onSelectUserItem={vi.fn()}
        onSelectGroupItem={vi.fn()}
        onSelectEventItem={vi.fn()}
        onSelectAmendmentItem={vi.fn()}
      />
    );

    expect(screen.queryByRole('region', { name: 'Groups' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Events' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Amendments' })).toBeNull();
  });
});
