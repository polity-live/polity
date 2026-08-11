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
  screenType: ScreenType = isMobile ? 'mobile' : 'desktop',
  loadingItem: string | null = null,
  handleItemClick = vi.fn()
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
        loadingItem={loadingItem}
        setLoadingItem={vi.fn()}
        handleItemClick={handleItemClick}
      />
    </KeyboardPlatformProvider>
  );
}

describe('NavItemListView', () => {
  it('maps every navigation layout to one stable semantic link action', () => {
    renderButtonList(false, true, navigationItems, 'asButton');
    let link = screen.getByRole('link', { name: 'Home' });
    expect(link.getAttribute('data-action-id')).toBe('navigation.item.overlay.compact.open');
    expect(link.querySelector('button')).toBeNull();
    cleanup();

    renderButtonList(
      false,
      true,
      Array.from({ length: 5 }, (_, index) => ({
        id: `item-${index}`,
        icon: 'Home',
        label: `Item ${index}`,
        href: `/item-${index}`,
      })),
      'asButton'
    );
    link = screen.getByRole('link', { name: 'Item 0' });
    expect(link.getAttribute('data-action-id')).toBe('navigation.item.overlay.grid.open');
    cleanup();

    renderButtonList(false, true, navigationItems, 'asButtonList');
    link = screen.getByRole('link', { name: 'Home' });
    expect(link.getAttribute('data-action-id')).toBe('navigation.item.icon.open');
    cleanup();

    renderButtonList(false, true, navigationItems, 'asLabeledButtonList');
    link = screen.getByRole('link', { name: 'Home' });
    expect(link.getAttribute('data-action-id')).toBe('navigation.item.labeled.open');
  });

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

  it.each(['asButtonList', 'asLabeledButtonList'] as const)(
    'marks the mobile primary %s scroller for the tutorial',
    navigationView => {
      const { container } = renderButtonList(
        true,
        true,
        navigationItems,
        navigationView,
        'windows',
        'mobile'
      );

      expect(
        container.querySelector('[data-tutorial-horizontal-scroller="primary-navigation"]')
      ).not.toBeNull();
    }
  );

  it.each([
    ['desktop primary', false, true, 'desktop'],
    ['mobile secondary', true, false, 'mobile'],
  ] as const)(
    'does not mark the %s navigation as the tutorial horizontal scroller',
    (_label, isMobile, isPrimary, screenType) => {
      const { container } = renderButtonList(
        isMobile,
        isPrimary,
        navigationItems,
        'asButtonList',
        'windows',
        screenType
      );

      expect(container.querySelector('[data-tutorial-horizontal-scroller]')).toBeNull();
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

  it('handles compact and grid overlay fallbacks, custom actions, and loading guards', () => {
    const compactAction = vi.fn();
    const handleCompact = vi.fn(item => item.onClick?.());
    const compact: NavigationItem[] = [
      { id: 'compact', icon: 'Home', label: 'Compact', onClick: compactAction },
    ];
    const view = renderButtonList(
      false,
      true,
      compact,
      'asButton',
      'windows',
      'desktop',
      null,
      handleCompact
    );
    const compactLink = screen.getByRole('link', { name: 'Compact' });
    expect(compactLink.getAttribute('href')).toBe('#');
    fireEvent.click(compactLink);
    expect(handleCompact).toHaveBeenCalledWith(compact[0]);
    expect(compactAction).toHaveBeenCalledOnce();

    view.rerender(
      <KeyboardPlatformProvider platform="windows">
        <NavItemListView
          navigationItems={compact}
          isMobile={false}
          isPrimary
          navigationView="asButton"
          screenType="desktop"
          pathname="/home"
          hash=""
          isRouterPending={false}
          normalizedHash=""
          currentRoute="/home"
          loadingItem="compact"
          setLoadingItem={vi.fn()}
          handleItemClick={handleCompact}
        />
      </KeyboardPlatformProvider>
    );
    fireEvent.click(screen.getByRole('link', { name: 'Compact' }));
    expect(handleCompact).toHaveBeenCalledTimes(1);

    view.unmount();
    const gridAction = vi.fn();
    const handleGrid = vi.fn(item => item.onClick?.());
    const grid: NavigationItem[] = Array.from({ length: 5 }, (_, index) => ({
      id: `grid-${index}`,
      icon: 'Home',
      label: `Grid ${index}`,
      href: index === 0 ? undefined : index === 1 ? '/home' : `/grid-${index}`,
      onClick: index === 0 ? gridAction : undefined,
    }));
    const gridView = renderButtonList(
      false,
      true,
      grid,
      'asButton',
      'windows',
      'desktop',
      null,
      handleGrid
    );
    const gridLink = screen.getByRole('link', { name: 'Grid 0' });
    expect(gridLink.getAttribute('href')).toBe('#');
    fireEvent.click(gridLink);
    expect(handleGrid).toHaveBeenCalledWith(grid[0]);
    expect(gridAction).toHaveBeenCalledOnce();

    gridView.rerender(
      <KeyboardPlatformProvider platform="windows">
        <NavItemListView
          navigationItems={grid}
          isMobile={false}
          isPrimary
          navigationView="asButton"
          screenType="desktop"
          pathname="/home"
          hash=""
          isRouterPending={false}
          normalizedHash=""
          currentRoute="/home"
          loadingItem="grid-0"
          setLoadingItem={vi.fn()}
          handleItemClick={handleGrid}
        />
      </KeyboardPlatformProvider>
    );
    fireEvent.click(screen.getByRole('link', { name: 'Grid 0' }));
    expect(handleGrid).toHaveBeenCalledTimes(1);

    gridView.unmount();
    renderButtonList(false, true, compact, 'asLabeledButtonList');
    expect(screen.getByRole('link', { name: 'Compact' }).getAttribute('href')).toBe('#');
  });

  it('covers navigation click fallthroughs and unsupported layouts', () => {
    const plain: NavigationItem[] = [{ id: 'plain', icon: 'Home', label: 'Plain', href: '/plain' }];

    let view = renderButtonList(false, true, plain, 'asButton');
    fireEvent.click(screen.getByRole('link', { name: 'Plain' }));
    view.unmount();

    const grid: NavigationItem[] = Array.from({ length: 5 }, (_, index) => ({
      id: `plain-${index}`,
      icon: 'Home',
      label: `Plain ${index}`,
      href: `/plain-${index}`,
    }));
    view = renderButtonList(false, true, grid, 'asButton');
    fireEvent.click(screen.getByRole('link', { name: 'Plain 0' }));
    view.unmount();

    view = renderButtonList(false, true, plain, 'asButtonList');
    fireEvent.click(screen.getByRole('link', { name: 'Plain' }));
    view.unmount();

    view = renderButtonList(false, true, plain, 'asLabeledButtonList');
    fireEvent.click(screen.getByRole('link', { name: 'Plain' }));
    view.unmount();

    const onClick = vi.fn();
    view = renderButtonList(false, true, [{ ...plain[0], onClick }], 'asLabeledButtonList');
    fireEvent.click(screen.getByRole('link', { name: 'Plain' }));
    expect(onClick).toHaveBeenCalledOnce();
    view.unmount();

    const unsupported = renderButtonList(false, true, plain, 'full' as NavigationView);
    expect(unsupported.container.firstChild).toBeNull();
  });
});
