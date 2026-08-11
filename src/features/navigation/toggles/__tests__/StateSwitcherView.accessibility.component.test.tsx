/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/navigation/toggles/language-toggle.tsx', () => ({
  LanguageToggle: () => <button>Language</button>,
}));
vi.mock('@/features/navigation/toggles/state-toggle.tsx', () => ({
  StateToggle: () => <button>State</button>,
}));
vi.mock('@/features/navigation/toggles/theme-toggle.tsx', () => ({
  ThemeToggle: () => <button>Theme</button>,
}));
vi.mock('@/features/shared/ui/ui/dropdown-menu.tsx', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children, side }: { children: React.ReactNode; side?: string }) => (
    <div data-side={side}>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: () => 'More options',
}));

import { StateSwitcherView } from '../StateSwitcherView';

const defaults = {
  navigationView: 'asButtonList' as const,
  isPrimary: true,
  isExpanded: false,
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
};

afterEach(cleanup);

describe('StateSwitcherView accessibility', () => {
  it.each([
    ['mobile', true],
    ['desktop', false],
  ])('labels the icon-only overflow trigger on %s', (_case, isMobile) => {
    render(<StateSwitcherView {...defaults} isMobile={isMobile} />);

    expect(screen.getByRole('button', { name: 'More options' })).toBeTruthy();
  });

  it('renders labeled desktop controls without an overflow trigger', () => {
    render(
      <StateSwitcherView {...defaults} navigationView="asLabeledButtonList" isMobile={false} />
    );
    expect(screen.getByText('State')).toBeTruthy();
    expect(screen.getByText('Language')).toBeTruthy();
    expect(screen.getByText('Theme')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'More options' })).toBeNull();
  });

  it('places primary and secondary desktop menus on opposite sides', () => {
    const primary = render(<StateSwitcherView {...defaults} isMobile={false} isPrimary />);
    expect(primary.container.querySelector('[data-side]')?.getAttribute('data-side')).toBe('right');
    primary.unmount();

    const secondary = render(
      <StateSwitcherView {...defaults} isMobile={false} isPrimary={false} />
    );
    expect(secondary.container.querySelector('[data-side]')?.getAttribute('data-side')).toBe(
      'left'
    );
  });

  it('renders the compact as-button control cluster', () => {
    render(<StateSwitcherView {...defaults} navigationView="asButton" isMobile={false} />);
    expect(screen.getByText('State')).toBeTruthy();
    expect(screen.getByText('Language')).toBeTruthy();
    expect(screen.getByText('Theme')).toBeTruthy();
  });

  it('supports labeled navigation in the mobile overflow menu', () => {
    render(<StateSwitcherView {...defaults} navigationView="asLabeledButtonList" isMobile />);
    expect(screen.getByRole('button', { name: 'More options' })).toBeTruthy();
    expect(document.querySelector('[data-side]')?.getAttribute('data-side')).toBe('top');
  });

  it('renders nothing for a defensive unknown navigation view', () => {
    const { container } = render(
      <StateSwitcherView {...defaults} navigationView={'unknown' as never} isMobile={false} />
    );
    expect(container.firstChild).toBeNull();
  });
});
