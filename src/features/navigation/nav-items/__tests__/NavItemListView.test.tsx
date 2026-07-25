/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  NavigationItem,
  NavigationView,
  ScreenType,
} from '@/features/navigation/types/navigation.types';
import { useLanguageStore } from '@/features/shared/global-state/language.store';
import {
  KeyboardPlatformProvider,
  type KeyboardPlatform,
} from '@/features/shared/keyboard/keyboard-shortcut';
import { NavItemListView } from '../NavItemListView';

vi.mock('@tanstack/react-router', () => ({
  Link: React.forwardRef<HTMLAnchorElement, any>((props, ref) => {
    const linkProps = { ...props };
    delete linkProps.children;
    delete linkProps.preload;
    delete linkProps.to;
    return (
      <a ref={ref} href={props.to} {...linkProps}>
        {props.children}
      </a>
    );
  }),
}));

beforeEach(() => {
  useLanguageStore.setState({ language: 'en' });
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const navigationItems: NavigationItem[] = [
  {
    id: 'home',
    icon: 'Home',
    label: 'Home',
    href: '/home',
    badge: 2,
  },
];

function renderButtonList(
  isMobile: boolean,
  isPrimary = true,
  items = navigationItems,
  navigationView: NavigationView = 'asButtonList',
  platform: KeyboardPlatform = 'windows',
  screenType: ScreenType = isMobile ? 'mobile' : 'desktop'
) {
  return render(
    <KeyboardPlatformProvider platform={platform}>
      <NavItemListView
        navigationItems={items}
        isMobile={isMobile}
        isPrimary={isPrimary}
        navigationView={navigationView}
        screenType={screenType}
        pathname="/home"
        hash=""
        isRouterPending={false}
        normalizedHash=""
        currentRoute="/home"
        loadingItem={null}
        setLoadingItem={vi.fn()}
        handleItemClick={vi.fn()}
      />
    </KeyboardPlatformProvider>
  );
}

describe('NavItemListView', () => {
  it.each([
    ['asButton mobile', 'asButton', true],
    ['asButton desktop', 'asButton', false],
    ['asButtonList mobile', 'asButtonList', true],
    ['asButtonList desktop', 'asButtonList', false],
    ['asLabeledButtonList mobile', 'asLabeledButtonList', true],
    ['asLabeledButtonList desktop', 'asLabeledButtonList', false],
  ] as const)('renders a compact capped badge at the icon in %s', (_label, view, isMobile) => {
    renderButtonList(
      isMobile,
      false,
      [
        {
          id: 'notifications',
          icon: 'Bell',
          label: 'Notifications',
          href: '/group/group-1/notifications',
          badge: 137,
        },
      ],
      view
    );

    const link = screen.getByRole('link', { name: 'Notifications' });
    const icon = link.querySelector('[data-slot="navigation-item-icon"]');
    const badge = link.querySelector('[data-slot="navigation-item-badge"]');

    expect(icon).not.toBeNull();
    expect(icon?.contains(badge)).toBe(true);
    expect(badge?.textContent).toBe('99+');
    expect(badge?.className).toContain('h-4');
    expect(badge?.className).toContain('min-w-4');
    expect(badge?.className).toContain('text-[10px]');
    expect(badge?.className).toContain('rounded-full');
    expect(badge?.className).toContain('translate-x-[65%]');
    expect(badge?.className).toContain('-translate-y-[55%]');
    expect(badge?.className).toContain('ring-2');
    expect(badge?.className).toContain('ring-background');
  });

  it.each([
    ['primary', true, 31, '31'],
    ['primary', true, 99, '99'],
    ['primary', true, 137, '99+'],
    ['secondary', false, 31, '31'],
    ['secondary', false, 99, '99'],
    ['secondary', false, 137, '99+'],
  ] as const)('formats the %s badge count %s as %s', (_type, isPrimary, count, expected) => {
    renderButtonList(
      false,
      isPrimary,
      [
        {
          id: 'notifications',
          icon: 'Bell',
          label: 'Notifications',
          href: '/notifications',
          badge: count,
        },
      ],
      'asButtonList'
    );

    expect(document.querySelector('[data-slot="navigation-item-badge"]')?.textContent).toBe(
      expected
    );
  });

  it.each([
    ['primary', true],
    ['secondary', false],
  ] as const)('does not render a %s badge for a zero count', (_type, isPrimary) => {
    renderButtonList(false, isPrimary, [
      {
        id: 'notifications',
        icon: 'Bell',
        label: 'Notifications',
        href: '/event/event-1/notifications',
        badge: 0,
      },
    ]);

    expect(screen.getByRole('link', { name: 'Notifications' })).not.toBeNull();
    expect(document.querySelector('[data-slot="navigation-item-badge"]')).toBeNull();
  });

  it('renders a single accessible mobile link without a native or custom tooltip', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderButtonList(true);

    const link = screen.getByRole('link', { name: 'Home' });
    expect(link.getAttribute('href')).toBe('/home');
    expect(link.getAttribute('title')).toBeNull();
    expect(link.querySelector('button')).toBeNull();

    fireEvent.mouseEnter(link);
    link.focus();
    expect(document.activeElement).toBe(link);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it.each([
    ['asButtonList', 'md:flex-col', 'md:gap-2'],
    ['asLabeledButtonList', 'md:flex-col', 'md:w-full'],
  ] as const)(
    'includes mobile-first and desktop override classes for automatic %s',
    (navigationView, listClass, itemClass) => {
      const { container } = renderButtonList(
        false,
        true,
        navigationItems,
        navigationView,
        'windows',
        'automatic'
      );

      expect(container.innerHTML).toContain(listClass);
      expect(container.innerHTML).toContain(itemClass);
    }
  );

  it('uses the shared tooltip for icon-only secondary desktop navigation', async () => {
    renderButtonList(false, false);

    const link = screen.getByRole('link', { name: 'Home' });
    expect(link.getAttribute('title')).toBeNull();
    link.focus();
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toContain('Home');
    expect(tooltip.textContent).toContain('Alt ⇧ H');
  });

  it.each(['asButton', 'asButtonList', 'asLabeledButtonList'] as const)(
    'shows Calendar and its registered shortcut in the %s desktop navigation',
    async navigationView => {
      renderButtonList(
        false,
        true,
        [{ id: 'calendar', icon: 'Calendar', label: 'Calendar', href: '/calendar' }],
        navigationView
      );

      const link = screen.getByRole('link', { name: 'Calendar' });
      expect(link.getAttribute('aria-keyshortcuts')).toBe('Alt+Shift+C');
      link.focus();
      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip.textContent).toContain('Calendar');
      expect(tooltip.textContent).toContain('Alt ⇧ C');
    }
  );

  it.each([
    ['macos', '⌥ ⇧ C'],
    ['windows', 'Alt ⇧ C'],
    ['linux', 'Alt ⇧ C'],
  ] as const)('shows the active Calendar shortcut on %s', async (platform, expected) => {
    renderButtonList(
      false,
      true,
      [{ id: 'calendar', icon: 'Calendar', label: 'Calendar', href: '/calendar' }],
      'asButtonList',
      platform
    );

    const link = screen.getByRole('link', { name: 'Calendar' });
    link.focus();
    expect((await screen.findByRole('tooltip')).textContent).toContain(expected);
  });

  it('omits the shortcut badge for unregistered icon navigation items', async () => {
    renderButtonList(false, true, [
      { id: 'unregistered', icon: 'Home', label: 'Other', href: '/other' },
    ]);

    screen.getByRole('link', { name: 'Other' }).focus();
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toBe('Other');
    expect(tooltip.querySelector('[data-slot="kbd"]')).toBeNull();
  });

  it.each(['asButton', 'asButtonList', 'asLabeledButtonList'] as const)(
    'promotes the command box in the %s primary desktop navigation without changing the link',
    async navigationView => {
      renderButtonList(
        false,
        true,
        [
          {
            id: 'search',
            icon: 'Search',
            label: 'Search',
            href: '/search',
          },
        ],
        navigationView
      );

      const link = screen.getByRole('link', { name: 'Search' });
      expect(link.getAttribute('href')).toBe('/search');
      if (navigationView === 'asButtonList') {
        expect(link.getAttribute('title')).toBeNull();
      }

      link.focus();

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip.textContent).toContain('Open Command Box');
      expect(tooltip.textContent).toContain('Ctrl K');
      expect(screen.getByRole('link', { name: 'Search' })).toBe(link);
    }
  );

  it('opens the primary desktop search tooltip on mouse hover', async () => {
    renderButtonList(false, true, [
      {
        id: 'search',
        icon: 'Search',
        label: 'Search',
        href: '/search',
      },
    ]);

    fireEvent.pointerMove(screen.getByRole('link', { name: 'Search' }), {
      pointerType: 'mouse',
    });

    expect((await screen.findByRole('tooltip')).textContent).toContain('Open Command Box');
  });

  it.each([
    ['mobile primary', true, true],
    ['desktop secondary', false, false],
  ])(
    'does not show the command-box tooltip on %s navigation',
    async (_layout, isMobile, isPrimary) => {
      renderButtonList(isMobile, isPrimary, [
        {
          id: 'search',
          icon: 'Search',
          label: 'Search',
          href: '/search',
        },
      ]);

      screen.getByRole('link', { name: 'Search' }).focus();
      expect(screen.queryByRole('tooltip')).toBeNull();
    }
  );

  it('runs custom navigation actions without following the placeholder href', () => {
    const onClick = vi.fn();
    render(
      <KeyboardPlatformProvider platform="windows">
        <NavItemListView
          navigationItems={[{ ...navigationItems[0], href: undefined, onClick }]}
          isMobile={false}
          isPrimary
          navigationView="asButtonList"
          screenType="desktop"
          pathname="/home"
          hash=""
          isRouterPending={false}
          normalizedHash=""
          currentRoute="/home"
          loadingItem={null}
          setLoadingItem={vi.fn()}
          handleItemClick={vi.fn()}
        />
      </KeyboardPlatformProvider>
    );

    fireEvent.click(screen.getByRole('link', { name: 'Home' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
