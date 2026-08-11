/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GroupMembershipButton } from '../GroupMembershipButton';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

describe('GroupMembershipButton actions', () => {
  it('dispatches every membership state and preserves disabled loading state', () => {
    const onRequestJoin = vi.fn();
    const onLeave = vi.fn();
    const onAcceptInvitation = vi.fn();
    const base = { status: null, onRequestJoin, onLeave, onAcceptInvitation, isLoading: false };
    const cases = [
      {
        state: { isMember: false, hasRequested: false, isInvited: true },
        id: 'groups.membership.accept.invitation',
        callback: onAcceptInvitation,
      },
      {
        state: { isMember: false, hasRequested: true, isInvited: false },
        id: 'groups.membership.cancel.request',
        callback: onLeave,
      },
      {
        state: { isMember: true, hasRequested: false, isInvited: false },
        id: 'groups.membership.leave.group',
        callback: onLeave,
      },
      {
        state: { isMember: false, hasRequested: false, isInvited: false },
        id: 'groups.membership.request.join',
        callback: onRequestJoin,
      },
    ];

    for (const testCase of cases) {
      const view = render(<GroupMembershipButton {...base} {...testCase.state} />);
      const action = view.container.querySelector<HTMLButtonElement>(
        `[data-action-id="${testCase.id}"]`
      )!;
      action.focus();
      expect(document.activeElement).toBe(action);
      fireEvent.click(action);
      expect(testCase.callback).toHaveBeenCalled();
      view.rerender(<GroupMembershipButton {...base} {...testCase.state} isLoading />);
      expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
      view.unmount();
    }
  });
});
