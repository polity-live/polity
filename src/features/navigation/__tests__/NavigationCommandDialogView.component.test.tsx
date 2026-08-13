/* @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  preloadContext: undefined as
    { beginIntent: ReturnType<typeof vi.fn>; cancelIntent: ReturnType<typeof vi.fn> } | undefined,
}));

vi.mock('@/zero/preloads', () => ({
  usePreloadCoordinator: () => mocks.preloadContext,
}));

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
    ...props
  }: {
    children: ReactNode;
    onSelect?: () => void;
    value?: string;
    'aria-keyshortcuts'?: string;
    'data-action-id'?: string;
  }) => (
    <button
      data-value={value}
      aria-keyshortcuts={ariaKeyShortcuts}
      onClick={() => onSelect?.()}
      {...props}
    >
      {children}
    </button>
  ),
  CommandSeparator: () => <hr />,
  CommandShortcut: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

afterEach(cleanup);

beforeEach(() => {
  mocks.preloadContext = {
    beginIntent: vi.fn(),
    cancelIntent: vi.fn(),
  };
});

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
    expect(
      document.querySelector('[data-action-id="navigation.command.item.select"]')
    ).toBeTruthy();
    expect(
      document.querySelector('[data-action-id="navigation.command.group.select"]')
    ).toBeTruthy();
    expect(
      document.querySelector('[data-action-id="navigation.command.event.select"]')
    ).toBeTruthy();
    expect(
      document.querySelector('[data-action-id="navigation.command.amendment.select"]')
    ).toBeTruthy();

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

  it('covers every entity fallback, preload event, badge, user section, and loading state', () => {
    const onSelectPrimaryItem = vi.fn();
    const onSelectUserItem = vi.fn();
    const onSelectGroupItem = vi.fn();
    const onSelectEventItem = vi.fn();
    const onSelectAmendmentItem = vi.fn();
    const items: NavigationItem[] = [
      {
        badge: 3,
        href: '/fallback',
        icon: 'Home',
        id: 'home',
        label: 'Home',
        preloadTarget: { href: '/preloaded' },
      },
      { icon: 'Home', id: 'unknown-item', label: 'Unknown' },
    ];

    render(
      <NavigationCommandDialogView
        open
        onOpenChange={vi.fn()}
        copy={copy}
        primaryNavItems={items}
        userNavItems={[{ icon: 'Home', id: 'profile', label: 'Profile', href: '/profile' }]}
        groupItems={[
          { id: 'named-group', name: 'Circle', image_url: 'circle.png' },
          { id: 'anonymous-group', name: null, image_url: null } as any,
        ]}
        eventItems={[
          {
            id: 'fallback-event',
            key: 'fallback-event:key',
            locationName: null,
            groupName: null,
            start_date: 0,
            title: null,
          } as any,
        ]}
        amendmentItems={[
          {
            code: null,
            eventTitle: null,
            groupName: null,
            id: 'fallback-amendment',
            targetGroupName: null,
            title: null,
          } as any,
        ]}
        navigationEntitiesLoading
        onSelectPrimaryItem={onSelectPrimaryItem}
        onSelectUserItem={onSelectUserItem}
        onSelectGroupItem={onSelectGroupItem}
        onSelectEventItem={onSelectEventItem}
        onSelectAmendmentItem={onSelectAmendmentItem}
      />
    );

    expect(screen.getByRole('status').textContent).toBe('Loading...');
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'User Navigation' })).toBeTruthy();
    expect(screen.getByText('Event')).toBeTruthy();
    expect(screen.getByText('Amendment')).toBeTruthy();

    const primaryItems = document.querySelectorAll(
      '[data-action-id="navigation.command.item.select"]'
    );
    fireEvent.click(primaryItems[0]);
    fireEvent.click(screen.getByText('Profile'));
    expect(onSelectPrimaryItem).toHaveBeenCalledWith(items[0]);
    expect(onSelectUserItem).toHaveBeenCalled();

    for (const element of document.querySelectorAll<HTMLElement>('[data-action-id]')) {
      fireEvent.mouseEnter(element);
      fireEvent.mouseLeave(element);
      fireEvent.focus(element);
      fireEvent.blur(element);
      fireEvent.touchStart(element);
    }
    expect(mocks.preloadContext?.beginIntent).toHaveBeenCalledWith('/preloaded');
    expect(mocks.preloadContext?.cancelIntent).toHaveBeenCalledWith('/preloaded');
    expect(mocks.preloadContext?.beginIntent).toHaveBeenCalledWith('/group/named-group');
    expect(mocks.preloadContext?.beginIntent).toHaveBeenCalledWith('/event/fallback-event');
    expect(mocks.preloadContext?.beginIntent).toHaveBeenCalledWith('/amendment/fallback-amendment');
  });

  it('keeps preload handlers safe without a coordinator', () => {
    mocks.preloadContext = undefined;
    render(
      <NavigationCommandDialogView
        open
        onOpenChange={vi.fn()}
        copy={copy}
        primaryNavItems={primaryNavItems}
        userNavItems={[]}
        groupItems={[{ id: 'group-1', name: 'Circle', image_url: null }]}
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
    for (const element of document.querySelectorAll<HTMLElement>('[data-action-id]')) {
      fireEvent.mouseEnter(element);
      fireEvent.mouseLeave(element);
      fireEvent.focus(element);
      fireEvent.blur(element);
      fireEvent.touchStart(element);
    }
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
