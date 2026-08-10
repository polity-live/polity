/* @vitest-environment jsdom */

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  viewProps: undefined as any,
  run: vi.fn(),
  reset: vi.fn(),
}));
vi.mock('../InviteMembersDialogView', () => ({
  InviteMembersDialogView: (props: any) => {
    mocks.viewProps = props;
    return <div>{String(props.inviteDisabled)}</div>;
  },
}));
vi.mock('@/features/shared/ui/action-submission', () => ({
  useActionSubmission: () => ({ runActionWithSubmission: mocks.run, reset: mocks.reset }),
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

import { InviteMembersDialog } from '../InviteMembersDialog';

afterEach(cleanup);
beforeEach(() => {
  mocks.run.mockReset();
  mocks.reset.mockReset();
  mocks.viewProps = undefined;
});
const base = {
  isOpen: true,
  onOpenChange: vi.fn(),
  selectedUsers: ['user'],
  onSelectedUsersChange: vi.fn(),
  roles: [{ id: 'one', name: 'One' }],
  selectedRoleIds: ['one'],
  onSelectedRoleIdsChange: vi.fn(),
  onInvite: vi.fn(),
  isInviting: false,
};

describe('InviteMembersDialog controller branches', () => {
  it('selects each default-role fallback and skips initialization when closed or selected', () => {
    const change = vi.fn();
    const view = render(
      <InviteMembersDialog
        {...base}
        selectedRoleIds={[]}
        onSelectedRoleIdsChange={change}
        roles={[{ id: 'default', name: 'Other', default_invite_role: true }]}
      />
    );
    expect(change).toHaveBeenCalledWith(['default']);
    view.rerender(
      <InviteMembersDialog
        {...base}
        selectedRoleIds={[]}
        onSelectedRoleIdsChange={change}
        roles={[{ id: 'member', name: 'Member' }]}
      />
    );
    expect(mocks.viewProps.defaultRoleId).toBe('member');
    view.rerender(
      <InviteMembersDialog
        {...base}
        selectedRoleIds={[]}
        onSelectedRoleIdsChange={change}
        roles={[{ id: 'first', name: 'Other' }]}
      />
    );
    expect(mocks.viewProps.defaultRoleId).toBe('first');
    view.rerender(
      <InviteMembersDialog
        {...base}
        selectedRoleIds={[]}
        onSelectedRoleIdsChange={change}
        roles={[]}
      />
    );
    expect(mocks.viewProps.defaultRoleId).toBeNull();
    view.rerender(
      <InviteMembersDialog
        {...base}
        isOpen={false}
        selectedRoleIds={[]}
        onSelectedRoleIdsChange={change}
      />
    );
    view.rerender(
      <InviteMembersDialog {...base} selectedRoleIds={['one']} onSelectedRoleIdsChange={change} />
    );
  });

  it('covers toggle de-duplication/removal and every disabled reason', () => {
    const view = render(<InviteMembersDialog {...base} />);
    act(() => mocks.viewProps.toggleRoleSelection('one', true));
    act(() => mocks.viewProps.toggleRoleSelection('two', true));
    act(() => mocks.viewProps.toggleRoleSelection('one', false));
    expect(base.onSelectedRoleIdsChange).toHaveBeenCalledWith(['one']);
    expect(base.onSelectedRoleIdsChange).toHaveBeenCalledWith(['one', 'two']);
    expect(base.onSelectedRoleIdsChange).toHaveBeenCalledWith([]);
    const variants = [
      { selectedUsers: [] },
      { isInviting: true },
      { selectedRoleIds: [] },
      { submitDisabled: true },
      { submitConflictLoading: true },
      {},
    ];
    for (const override of variants) {
      view.rerender(<InviteMembersDialog {...base} {...override} />);
      expect(typeof mocks.viewProps.inviteDisabled).toBe('boolean');
    }
  });

  it('closes and resets after success and absorbs submission rejection', async () => {
    const onOpenChange = vi.fn();
    const onInvite = vi.fn();
    mocks.run.mockImplementationOnce(async (action: any, options: any) => {
      await action();
      options.onSuccess();
    });
    render(<InviteMembersDialog {...base} onOpenChange={onOpenChange} onInvite={onInvite} />);
    await act(async () => mocks.viewProps.onInvite());
    expect(mocks.reset).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    mocks.run.mockRejectedValueOnce(new Error('failed'));
    await act(async () => mocks.viewProps.onInvite());
  });
});
