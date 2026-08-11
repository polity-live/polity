/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  APP_TUTORIAL_ACTION_EVENT,
  APP_TUTORIAL_AVATAR_MENU_OPENED_ACTION,
} from '@/features/app-tutorial/events';
import { UserMenu } from '../UserMenu';

vi.mock('../hooks/useUserMenuController', () => ({
  useUserMenuController: () => ({}),
}));

vi.mock('../UserMenuView', () => ({
  UserMenuView: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <button type="button" onClick={() => onOpenChange(!open)}>
      Toggle avatar menu
    </button>
  ),
}));

afterEach(cleanup);

describe('UserMenu', () => {
  it('reports tutorial progress only after the menu opens', () => {
    const tutorialAction = vi.fn();
    window.addEventListener(APP_TUTORIAL_ACTION_EVENT, tutorialAction);

    render(<UserMenu />);
    const trigger = screen.getByRole('button', { name: 'Toggle avatar menu' });

    fireEvent.click(trigger);
    expect(tutorialAction).toHaveBeenCalledOnce();
    expect(tutorialAction.mock.calls[0]?.[0]).toMatchObject({
      detail: {
        type: 'action',
        event: APP_TUTORIAL_AVATAR_MENU_OPENED_ACTION,
      },
    });

    fireEvent.click(trigger);
    expect(tutorialAction).toHaveBeenCalledOnce();
    window.removeEventListener(APP_TUTORIAL_ACTION_EVENT, tutorialAction);
  });
});
