/* @vitest-environment jsdom */

import React from 'react';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  command: vi.fn(() => ({ open: true, setOpen: vi.fn(), marker: 'command' })),
  dynamic: vi.fn(() => ({ isMobileDevice: true })),
  avatar: vi.fn(() => ({ marker: 'avatar' })),
  demo: vi.fn(() => ({ marker: 'demo' })),
  switcher: vi.fn(() => ({ marker: 'switcher' })),
  childProps: [] as { name: string; props: Record<string, unknown> }[],
}));

function view(name: string) {
  return (props: Record<string, unknown>) => {
    mocks.childProps.push({ name, props });
    return <div data-testid={name} />;
  };
}

vi.mock('@/features/navigation/hooks/useNavigationCommandDialogController', () => ({
  useNavigationCommandDialogController: mocks.command,
}));
vi.mock('@/features/navigation/hooks/useDynamicNavigationController', () => ({
  useDynamicNavigationController: mocks.dynamic,
}));
vi.mock('@/features/navigation/hooks/useNavUserAvatarController', () => ({
  useNavUserAvatarController: mocks.avatar,
}));
vi.mock('../useNavigationDemoController', () => ({
  useNavigationDemoController: mocks.demo,
}));
vi.mock('@/features/navigation/hooks/useStateSwitcherController', () => ({
  useStateSwitcherController: mocks.switcher,
}));
vi.mock('../NavigationCommandDialogView', () => ({
  NavigationCommandDialogView: view('command'),
}));
vi.mock('../DynamicNavigationView', () => ({ DynamicNavigationView: view('dynamic') }));
vi.mock('../nav-items/NavUserAvatarView', () => ({ NavUserAvatarView: view('avatar') }));
vi.mock('../NavigationDemoView', () => ({ NavigationDemoView: view('demo') }));
vi.mock('../toggles/StateSwitcherView', () => ({ StateSwitcherView: view('switcher') }));
vi.mock('../toggles/state-toggle', () => ({ StateToggle: view('state-toggle') }));

import { NavigationCommandDialog } from '../command-dialog';
import { DynamicNavigation } from '../dynamic-navigation';
import { useAsButtonNavigationController } from '../hooks/useAsButtonNavigationController';
import { useNavigationViewStateToggleController } from '../hooks/useNavigationViewStateToggleController';
import {
  createLandingSecondaryNavItems,
  createNavItemsUnauthenticated,
} from '../nav-items/nav-items-unauthenticated';
import ConnectedNavUserAvatar from '../nav-items/nav-user-avatar-connected';
import { NavigationDemo } from '../NavigationDemo';
import { useNavigationStore } from '../state/navigation.store';
import { NavigationViewStateToggle } from '../toggles/NavigationViewStateToggle';
import { NavigationViewStateToggleView } from '../toggles/NavigationViewStateToggleView';
import { StateSwitcher } from '../toggles/state-switcher';

afterEach(cleanup);

describe('A02 navigation LSF surfaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.childProps.length = 0;
    useNavigationStore.setState({ navigationType: 'combined', navigationView: 'asButtonList' });
  });

  it('executes every unauthenticated navigation callback', () => {
    const navigate = vi.fn();
    const translate = (key: string) => `t:${key}`;

    const primary = createNavItemsUnauthenticated(navigate, translate);
    const landing = createLandingSecondaryNavItems(navigate, translate);
    for (const item of [...primary, ...landing]) item.onClick?.();

    expect(navigate).toHaveBeenCalledTimes(9);
    expect(primary[0].label).toContain('navigation.primary.home');
  });

  it('drives navigation state and hook callbacks', () => {
    const state = renderHook(() => useAsButtonNavigationController());
    expect(state.result.current.isExpanded).toBe(false);
    act(() => state.result.current.onExpand());
    expect(state.result.current.isExpanded).toBe(true);
    act(() => state.result.current.onCollapse());
    expect(state.result.current.isExpanded).toBe(false);
    act(() => state.result.current.onToggleExpanded());
    expect(state.result.current.isExpanded).toBe(true);

    act(() => useNavigationStore.getState().setNavigationType('secondary'));
    act(() => useNavigationStore.getState().setNavigationView('asLabeledButtonList'));
    expect(useNavigationStore.getState()).toMatchObject({
      navigationType: 'secondary',
      navigationView: 'asLabeledButtonList',
    });

    const toggle = renderHook(() => useNavigationViewStateToggleController());
    act(() => toggle.result.current.setNavigationView('asButtonList'));
    expect(toggle.result.current.navigationView).toBe('asButtonList');
  });

  it('renders every controller-backed navigation facade', () => {
    const items = [{ id: 'home', label: 'Home', href: '/' }] as never;
    render(
      <>
        <NavigationCommandDialog primaryNavItems={items} secondaryNavItems={null} />
        <DynamicNavigation
          navigationView="asButtonList"
          navigationType="combined"
          screenType="desktop"
          navigationItems={items}
        />
        <ConnectedNavUserAvatar
          navigationView="asButtonList"
          isMobile={false}
          authUser={{ id: 'user', email: 'user@example.test' }}
        />
        <NavigationDemo />
        <NavigationViewStateToggle />
        <NavigationViewStateToggleView navigationView="asButtonList" setNavigationView={vi.fn()} />
        <StateSwitcher isMobile={false} navigationType="combined" />
      </>
    );

    for (const name of ['command', 'dynamic', 'avatar', 'demo', 'state-toggle', 'switcher']) {
      expect(screen.getAllByTestId(name).length).toBeGreaterThan(0);
    }
    expect(mocks.command).toHaveBeenCalledOnce();
    expect(mocks.dynamic).toHaveBeenCalledWith('desktop');
    expect(mocks.avatar).toHaveBeenCalledOnce();
    expect(mocks.demo).toHaveBeenCalledOnce();
    expect(mocks.switcher).toHaveBeenCalledOnce();
  });
});
