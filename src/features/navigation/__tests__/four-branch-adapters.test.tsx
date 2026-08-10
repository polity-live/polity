/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AsButtonListNavigation } from '../as-button-list-navigation';
import { AsLabeledButtonListNavigation } from '../as-labeled-button-list-navigation';
import { LanguageToggle } from '../toggles/language-toggle';

const mocks = vi.hoisted(() => ({
  languageProps: vi.fn(),
  user: null as { id: string } | null,
  zeroReady: false,
}));
vi.mock('../nav-items/nav-item-list.tsx', () => ({ NavItemList: () => <div>items</div> }));
vi.mock('../nav-items/nav-user-avatar.tsx', () => ({
  NavUserAvatar: ({ isMobile }: { isMobile: boolean }) => <div>nav-avatar:{String(isMobile)}</div>,
}));
vi.mock('../toggles/state-switcher.tsx', () => ({ StateSwitcher: () => <div>switcher</div> }));
vi.mock('@/features/shared/ui/ui/separator.tsx', () => ({ Separator: () => <hr /> }));
vi.mock('../responsive-navigation-layout', () => ({
  getDesktopNavigationVisibilityClasses: () => 'desktop',
  getListNavigationContainerClasses: () => 'container',
  getListNavigationContentClasses: () => 'content',
  getMobileNavigationVisibilityClasses: () => 'mobile',
}));
vi.mock('@/providers/auth-provider.tsx', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/providers/zero-ready-context.ts', () => ({ useZeroReady: () => mocks.zeroReady }));
vi.mock('../nav-items/nav-user-avatar-connected', () => ({
  default: ({ authUser }: { authUser: { id: string } }) => <div>connected:{authUser.id}</div>,
}));
vi.mock('../hooks/useLanguageToggleController', () => ({
  useLanguageToggleController: () => ({ language: 'en' }),
}));
vi.mock('../toggles/LanguageToggleView', () => ({
  LanguageToggleView: (props: Record<string, unknown>) => {
    mocks.languageProps(props);
    return <div>language</div>;
  },
}));

afterEach(() => {
  cleanup();
  mocks.user = null;
  mocks.zeroReady = false;
  vi.clearAllMocks();
});

const base = { navigationItems: [], isMobile: false, screenType: 'desktop' as const };

describe('four-branch navigation adapters', () => {
  it('renders primary and secondary button-list navigation', () => {
    const primary = render(
      <AsButtonListNavigation {...base} navigationType="primary" navigationView="asButtonList" />
    );
    expect(screen.getAllByText('switcher')).toHaveLength(2);
    primary.unmount();
    render(
      <AsButtonListNavigation {...base} navigationType="secondary" navigationView="asButtonList" />
    );
    expect(screen.queryByText('switcher')).toBeNull();
  });

  it('renders primary and secondary labeled-button navigation', () => {
    const primary = render(
      <AsLabeledButtonListNavigation
        {...base}
        navigationType="primary"
        navigationView="asLabeledButtonList"
      />
    );
    expect(screen.getAllByText('switcher')).toHaveLength(2);
    primary.unmount();
    render(
      <AsLabeledButtonListNavigation
        {...base}
        navigationType="secondary"
        navigationView="asLabeledButtonList"
      />
    );
    expect(screen.queryByText('switcher')).toBeNull();
  });

  it('forwards language-toggle defaults and overrides', () => {
    const first = render(<LanguageToggle />);
    expect(mocks.languageProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ size: 'default', side: 'top', sideOffset: 8, variant: 'popover' })
    );
    first.unmount();
    render(
      <LanguageToggle
        size={'icon' as never}
        side="left"
        sideOffset={2}
        variant="dropdown"
        className="x"
      />
    );
    expect(mocks.languageProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ size: 'icon', side: 'left', sideOffset: 2, variant: 'dropdown' })
    );
  });
});
