/* @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NavigationCommandDialogView } from '../NavigationCommandDialogView';
import type { NavigationItem } from '../types/navigation.types';
import {
  KeyboardPlatformProvider,
  type KeyboardPlatform,
} from '@/features/shared/keyboard/keyboard-shortcut';

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
    'aria-keyshortcuts': ariaKeyShortcuts,
  }: {
    children: ReactNode;
    onSelect?: () => void;
    value?: string;
    'aria-keyshortcuts'?: string;
  }) => (
    <button data-value={value} aria-keyshortcuts={ariaKeyShortcuts} onClick={() => onSelect?.()}>
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
  loading: 'Loading...',
};

describe('NavigationCommandDialogView', () => {
  it('does not create command-list content while closed', () => {
    render(
      <NavigationCommandDialogView
        open={false}
        onOpenChange={vi.fn()}
        copy={copy}
        primaryNavItems={primaryNavItems}
        userNavItems={[]}
        groupItems={[{ id: 'group-1', name: 'Working Circle', image_url: null }]}
        eventItems={[]}
        amendmentItems={[]}
        navigationEntitiesLoading={false}
        onSelectPrimaryItem={vi.fn()}
        onSelectUserItem={vi.fn()}
        onSelectGroupItem={vi.fn()}
        onSelectEventItem={vi.fn()}
        onSelectAmendmentItem={vi.fn()}
      />
    );

    expect(screen.queryByText('Working Circle')).toBeNull();
    expect(screen.queryByPlaceholderText(copy.placeholder)).toBeNull();
  });

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
        navigationEntitiesLoading={false}
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
        navigationEntitiesLoading={false}
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

  it.each([
    ['macos', '⌥ ⇧ H', 'Alt+Shift+H'],
    ['windows', 'Alt ⇧ H', 'Alt+Shift+H'],
    ['linux', 'Alt ⇧ H', 'Alt+Shift+H'],
  ] as const)(
    'uses the resolved navigation shortcut in UI and ARIA on %s',
    (platform: KeyboardPlatform, display, aria) => {
      render(
        <KeyboardPlatformProvider platform={platform}>
          <NavigationCommandDialogView
            open
            onOpenChange={vi.fn()}
            copy={copy}
            primaryNavItems={primaryNavItems}
            userNavItems={[]}
            groupItems={[]}
            eventItems={[]}
            amendmentItems={[]}
            navigationEntitiesLoading={false}
            onSelectPrimaryItem={vi.fn()}
            onSelectUserItem={vi.fn()}
            onSelectGroupItem={vi.fn()}
            onSelectEventItem={vi.fn()}
            onSelectAmendmentItem={vi.fn()}
          />
        </KeyboardPlatformProvider>
      );

      const item = screen.getByRole('button', { name: `Home ${display}` });
      expect(item.getAttribute('aria-keyshortcuts')).toBe(aria);
      expect(screen.getByText(display)).toBeTruthy();
    }
  );
});
