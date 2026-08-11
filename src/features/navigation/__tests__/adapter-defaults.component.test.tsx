/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThemeToggle } from '../toggles/theme-toggle';
import { UserMenu } from '../UserMenu';

const mocks = vi.hoisted(() => ({
  controllerResult: { id: 'user-1' } as Record<string, unknown> | null,
  onViewProps: vi.fn(),
  report: vi.fn(),
  themeController: vi.fn(() => ({ theme: 'light' })),
  userController: vi.fn(),
}));

vi.mock('../hooks/useThemeToggleController', () => ({
  useThemeToggleController: mocks.themeController,
}));
vi.mock('../toggles/ThemeToggleView', () => ({
  ThemeToggleView: (props: Record<string, unknown>) => {
    mocks.onViewProps(props);
    return <div data-testid="theme-toggle" />;
  },
}));
vi.mock('../hooks/useUserMenuController', () => ({
  useUserMenuController: (options: Record<string, unknown>) => {
    mocks.userController(options);
    return mocks.controllerResult;
  },
}));
vi.mock('../UserMenuView', () => ({
  UserMenuView: (props: { onOpenChange: (open: boolean) => void; open: boolean }) => (
    <button type="button" onClick={() => props.onOpenChange(!props.open)}>
      menu:{String(props.open)}
    </button>
  ),
}));
vi.mock('@/features/app-tutorial/events', () => ({
  APP_TUTORIAL_AVATAR_MENU_OPENED_ACTION: 'avatar-opened',
  reportAppTutorialAction: mocks.report,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.controllerResult = { id: 'user-1' };
});

describe('navigation adapters', () => {
  it('passes the default and explicit theme-toggle sizes to the view', () => {
    const first = render(<ThemeToggle />);
    expect(mocks.onViewProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ size: 'default', theme: 'light' })
    );
    first.unmount();

    render(<ThemeToggle size={'icon' as never} className="custom" />);
    expect(mocks.onViewProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ size: 'icon', className: 'custom' })
    );
  });

  it('handles uncontrolled menu opening without an external callback', () => {
    render(<UserMenu />);
    expect(screen.getByRole('button').textContent).toBe('menu:false');

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toBe('menu:true');
    expect(mocks.report).toHaveBeenCalledWith({ type: 'action', event: 'avatar-opened' });
  });

  it('honors controlled state and external open changes', () => {
    const onOpenChange = vi.fn();
    render(<UserMenu open onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.userController).toHaveBeenCalledWith({
      user: undefined,
      navigationEnabled: true,
    });
  });

  it('renders nothing when the controller has no user-menu model', () => {
    mocks.controllerResult = null;
    const { container } = render(<UserMenu />);
    expect(container.firstChild).toBeNull();
  });
});
