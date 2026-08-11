/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AsButtonNavigationView } from '../AsButtonNavigationView';
import { NavigationDemoView } from '../NavigationDemoView';
import { NavUserAvatar2View } from '../nav-items/NavUserAvatar2View';
import { NavUserAvatarView } from '../nav-items/NavUserAvatarView';
import { LanguageToggleView } from '../toggles/LanguageToggleView';
import { StateSwitcherView } from '../toggles/StateSwitcherView';
import { StateToggle } from '../toggles/state-toggle';
import { ThemeToggleView } from '../toggles/ThemeToggleView';

vi.mock('@/features/shared/ui/navigation', () => ({
  FloatingNavigationButton: ({ 'data-action-id': actionId, onToggleExpanded, side }: any) => (
    <button type="button" data-action-id={actionId} data-side={side} onClick={onToggleExpanded}>
      Open
    </button>
  ),
  NavigationCloseButton: ({ 'data-action-id': actionId, onClose, side }: any) => (
    <button type="button" data-action-id={actionId} data-side={side} onClick={onClose}>
      Close
    </button>
  ),
  NavigationIconToggleButton: ({ 'data-action-id': actionId, onClick, title }: any) => (
    <button type="button" data-action-id={actionId} onClick={onClick} aria-label={title}>
      {title}
    </button>
  ),
}));
vi.mock('../nav-items/nav-item-list.tsx', () => ({ NavItemList: () => null }));
vi.mock('../nav-items/nav-user-avatar.tsx', () => ({ NavUserAvatar: () => null }));
vi.mock('../toggles/state-switcher.tsx', () => ({ StateSwitcher: () => null }));
vi.mock('../UserMenu.tsx', () => ({ UserMenu: () => <button type="button">User menu</button> }));
vi.mock('../toggles/theme-toggle.tsx', () => ({ ThemeToggle: () => null }));
vi.mock('../toggles/language-toggle.tsx', () => ({ LanguageToggle: () => null }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/popover.tsx', () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/ui/dropdown-menu.tsx', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, ...props }: any) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuPortal: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuSub: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSubContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSubTrigger: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

afterEach(cleanup);

describe('navigation foundation view action contracts', () => {
  it('opens and closes the overlay through separate stable actions', () => {
    const onCollapse = vi.fn();
    const onToggleExpanded = vi.fn();
    const { rerender } = render(
      <AsButtonNavigationView
        {...({
          isExpanded: false,
          navigationItems: [],
          navigationView: 'asButton',
          navigationType: 'primary',
          isMobile: false,
          screenType: 'desktop',
          onExpand: vi.fn(),
          onCollapse,
          onToggleExpanded,
        } as any)}
      />
    );
    fireEvent.click(document.querySelector('[data-action-id="navigation.overlay.open"]')!);
    expect(onToggleExpanded).toHaveBeenCalledOnce();

    rerender(
      <AsButtonNavigationView
        {...({
          isExpanded: true,
          navigationItems: [],
          navigationView: 'asButton',
          navigationType: 'primary',
          isMobile: false,
          screenType: 'desktop',
          onExpand: vi.fn(),
          onCollapse,
          onToggleExpanded,
        } as any)}
      />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="navigation.overlay.backdrop.close"]')!
    );
    fireEvent.click(document.querySelector('[data-action-id="navigation.overlay.close"]')!);
    expect(onCollapse).toHaveBeenCalledTimes(2);

    rerender(
      <AsButtonNavigationView
        {...({
          isExpanded: false,
          navigationItems: [],
          navigationView: 'asButton',
          navigationType: 'secondary',
          isMobile: false,
          screenType: 'desktop',
          onExpand: vi.fn(),
          onCollapse,
          onToggleExpanded,
        } as any)}
      />
    );
    expect(
      document
        .querySelector('[data-action-id="navigation.overlay.open"]')
        ?.getAttribute('data-side')
    ).toBe('right');

    rerender(
      <AsButtonNavigationView
        {...({
          isExpanded: true,
          navigationItems: [],
          navigationView: 'asButton',
          navigationType: 'secondary',
          isMobile: false,
          screenType: 'desktop',
          onExpand: vi.fn(),
          onCollapse,
          onToggleExpanded,
        } as any)}
      />
    );
    expect(
      document
        .querySelector('[data-action-id="navigation.overlay.close"]')
        ?.getAttribute('data-side')
    ).toBe('left');
  });

  it('switches every demo screen and priority through stable actions', () => {
    const handleScreenTypeChange = vi.fn();
    const handlePriorityChange = vi.fn();
    render(
      <NavigationDemoView
        {...({
          t: (key: string) => key,
          screenType: 'automatic',
          actualScreen: 'desktop',
          priority: 'combined',
          handleScreenTypeChange,
          handlePriorityChange,
        } as any)}
      />
    );
    for (const screen of ['mobile', 'desktop', 'automatic']) {
      fireEvent.click(
        document.querySelector(`[data-action-id="navigation.demo.screen.${screen}"]`)!
      );
    }
    for (const priority of ['primary', 'secondary', 'combined']) {
      fireEvent.click(
        document.querySelector(`[data-action-id="navigation.demo.priority.${priority}"]`)!
      );
    }
    expect(handleScreenTypeChange).toHaveBeenCalledTimes(3);
    expect(handlePriorityChange).toHaveBeenCalledTimes(3);
  });

  it('opens each avatar layout through a semantic focusable control', () => {
    const onAsButtonClick = vi.fn();
    const { rerender } = render(
      <NavUserAvatarView
        {...({
          navigationView: 'asButton',
          isMobile: false,
          displayName: 'Ada',
          userInitials: 'AL',
          user: { id: 'user-1' },
          onAsButtonClick,
          onDropdownOpenChange: vi.fn(),
          onNameClick: vi.fn(),
        } as any)}
      />
    );
    const overlay = document.querySelector(
      '[data-action-id="navigation.avatar.overlay.open"]'
    ) as HTMLElement;
    overlay.focus();
    expect(document.activeElement).toBe(overlay);
    fireEvent.click(overlay);
    expect(onAsButtonClick).toHaveBeenCalledOnce();

    const onNameClick = vi.fn();
    rerender(
      <NavUserAvatarView
        {...({
          navigationView: 'asLabeledButtonList',
          isMobile: false,
          displayName: 'Ada',
          userInitials: 'AL',
          user: { id: 'user-1' },
          onAsButtonClick,
          onDropdownOpenChange: vi.fn(),
          onNameClick,
        } as any)}
      />
    );
    fireEvent.click(document.querySelector('[data-action-id="navigation.avatar.name.open"]')!);
    expect(onNameClick).toHaveBeenCalledOnce();

    const layouts = [
      ['asButton', false, 'overlay'],
      ['asButtonList', false, 'list'],
      ['asLabeledButtonList', true, 'mobile-labeled'],
      ['asLabeledButtonList', false, 'desktop-labeled'],
    ] as const;
    for (const [navigationView, isMobile, id] of layouts) {
      rerender(
        <NavUserAvatar2View
          {...({
            navigationView,
            isMobile,
            avatarUrl: '',
            hoveredItem: null,
            popoverId: 'avatar',
            userName: 'Ada',
            onClick: vi.fn(),
            onHoverStart: vi.fn(),
            onHoverEnd: vi.fn(),
          } as any)}
        />
      );
      expect(
        document.querySelector(`[data-action-id="navigation.avatar2.${id}.open"]`)
      ).toBeTruthy();
    }
  });

  it('changes language, theme, navigation view, and switcher surfaces through stable actions', () => {
    const onLanguageChange = vi.fn();
    const { rerender } = render(
      <LanguageToggleView
        {...({
          size: 'default',
          side: 'bottom',
          sideOffset: 0,
          variant: 'dropdown',
          isLanguagePopoverOpen: true,
          language: 'en',
          labels: {
            english: 'English',
            german: 'German',
            moreLanguages: 'More',
            title: 'Language',
          },
          onLanguageChange,
          onPopoverMouseLeave: vi.fn(),
          onPopoverOpenChange: vi.fn(),
          onPopoverTriggerMouseEnter: vi.fn(),
        } as any)}
      />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="navigation.language.dropdown.english"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="navigation.language.dropdown.german"]')!
    );
    rerender(
      <LanguageToggleView
        {...({
          size: 'default',
          side: 'bottom',
          sideOffset: 0,
          variant: 'popover',
          isLanguagePopoverOpen: true,
          language: 'en',
          labels: {
            english: 'English',
            german: 'German',
            moreLanguages: 'More',
            title: 'Language',
          },
          onLanguageChange,
          onPopoverMouseLeave: vi.fn(),
          onPopoverOpenChange: vi.fn(),
          onPopoverTriggerMouseEnter: vi.fn(),
        } as any)}
      />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="navigation.language.popover.english"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="navigation.language.popover.german"]')!
    );
    expect(onLanguageChange).toHaveBeenCalledTimes(4);

    const onLight = vi.fn();
    const onDark = vi.fn();
    const onSystem = vi.fn();
    rerender(
      <ThemeToggleView
        currentTheme="system"
        labels={{ light: 'Light', dark: 'Dark', system: 'System' }}
        onLight={onLight}
        onDark={onDark}
        onSystem={onSystem}
      />
    );
    for (const id of ['light', 'dark', 'system']) {
      fireEvent.click(document.querySelector(`[data-action-id="navigation.theme.${id}.select"]`)!);
    }
    expect(onLight).toHaveBeenCalledOnce();
    expect(onDark).toHaveBeenCalledOnce();
    expect(onSystem).toHaveBeenCalledOnce();

    const onStateChange = vi.fn();
    rerender(<StateToggle currentState="asButton" onStateChange={onStateChange} />);
    for (const id of ['as-button', 'as-button-list', 'labeled-button-list']) {
      fireEvent.click(document.querySelector(`[data-action-id="navigation.view.${id}.select"]`)!);
    }
    expect(onStateChange).toHaveBeenCalledTimes(3);

    rerender(
      <StateSwitcherView
        {...({
          navigationView: 'asButtonList',
          isMobile: true,
          isPrimary: true,
          isExpanded: false,
          isDropdownOpen: true,
          setIsExpanded: vi.fn(),
          setIsDropdownOpen: vi.fn(),
          setNavigationView: vi.fn(),
          onMobileTriggerMouseEnter: vi.fn(),
          onMobileMenuMouseEnter: vi.fn(),
          onMobileMenuMouseLeave: vi.fn(),
          onDesktopTriggerMouseEnter: vi.fn(),
          onDesktopMenuMouseEnter: vi.fn(),
          onDesktopMenuMouseLeave: vi.fn(),
          onMobileStateChange: vi.fn(),
          onDesktopStateChange: vi.fn(),
        } as any)}
      />
    );
    expect(
      document.querySelector('[data-action-id="navigation.state-switcher.mobile.open"]')
    ).toBeTruthy();
    rerender(
      <StateSwitcherView
        {...({
          navigationView: 'asButtonList',
          isMobile: false,
          isPrimary: true,
          isExpanded: true,
          isDropdownOpen: false,
          setIsExpanded: vi.fn(),
          setIsDropdownOpen: vi.fn(),
          setNavigationView: vi.fn(),
          onMobileTriggerMouseEnter: vi.fn(),
          onMobileMenuMouseEnter: vi.fn(),
          onMobileMenuMouseLeave: vi.fn(),
          onDesktopTriggerMouseEnter: vi.fn(),
          onDesktopMenuMouseEnter: vi.fn(),
          onDesktopMenuMouseLeave: vi.fn(),
          onMobileStateChange: vi.fn(),
          onDesktopStateChange: vi.fn(),
        } as any)}
      />
    );
    expect(
      document.querySelector('[data-action-id="navigation.state-switcher.desktop.open"]')
    ).toBeTruthy();
  });
});
