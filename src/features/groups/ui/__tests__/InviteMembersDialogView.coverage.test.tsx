/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ choices: [] as any[], overlay: undefined as any }));
vi.mock('@/features/shared/ui/action-submission', () => ({
  ActionSubmissionOverlay: (props: any) => {
    mocks.overlay = props;
    return <div>overlay</div>;
  },
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <footer>{children}</footer>,
  DialogHeader: ({ children }: any) => <header>{children}</header>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/form', () => ({
  ChoiceField: (props: any) => {
    mocks.choices.push(props);
    return (
      <button onClick={() => props.onCheckedChange(true)}>
        {props.label}
        {props.description}
      </button>
    );
  },
}));
vi.mock('@/features/shared/ui/layout', () => ({
  Panel: ({ children }: any) => <div>{children}</div>,
  PanelContent: ({ children }: any) => <div>{children}</div>,
  PanelHeader: ({ children }: any) => <header>{children}</header>,
  PanelTitle: ({ children }: any) => <h3>{children}</h3>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/status', () => ({
  StatusBadge: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <span>{children}</span>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/create/ui/inputs/UserSearchInput', () => ({
  UserSearchInput: () => <div>users</div>,
}));
vi.mock('../RoleTag', () => ({ RoleTag: ({ roleName }: any) => <span>{roleName}</span> }));
vi.mock('../GroupConflictPanel', () => ({ GroupConflictDialog: () => <div>conflict</div> }));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

import { InviteMembersDialogView } from '../InviteMembersDialogView';
afterEach(cleanup);
const actionSubmission = (active = false) =>
  ({
    isActive: active,
    status: 'idle',
    progressSteps: [],
    error: null,
    reset: vi.fn(),
    retry: vi.fn(),
  }) as any;
const base = {
  actionSubmission: actionSubmission(),
  isOpen: true,
  onOpenChange: vi.fn(),
  selectedUsers: ['u'],
  onSelectedUsersChange: vi.fn(),
  excludeUserIds: [],
  excludeUserId: undefined,
  roles: [],
  selectedRoleIds: [],
  onSelectedRoleIdsChange: vi.fn(),
  onInvite: vi.fn(),
  isInviting: false,
  disabled: false,
  disabledReason: undefined,
  triggerLabel: 'Invite',
  dialogTitle: 'Dialog',
  dialogDescription: 'Desc',
  peopleSectionDescription: 'People',
  userSearchLabel: 'Search',
  userSearchPlaceholder: 'Find',
  roleSectionTitle: 'Roles',
  roleSectionDescription: 'Role desc',
  defaultRoleFallbackName: 'Member',
  defaultInviteLabel: 'Default',
  emptyRolesLabel: 'Empty',
  cancelLabel: 'Cancel',
  inviteLabel: 'Invite',
  submitDisabled: false,
  submitDisabledReason: undefined,
  submitConflictResponse: null,
  submitConflictLoading: false,
  defaultRoleId: null,
  toggleRoleSelection: vi.fn(),
  inviteDisabled: false,
  triggerButton: <button>trigger</button>,
};

describe('InviteMembersDialogView branches', () => {
  it('renders disabled tooltip, role fallbacks/defaults, conflicts and invokes actions', () => {
    const toggle = vi.fn(),
      close = vi.fn(),
      invite = vi.fn();
    render(
      <InviteMembersDialogView
        {...base}
        disabled
        disabledReason="Reason"
        roles={[
          { id: 'one', name: '', description: '', default_invite_role: true },
          { id: 'two', name: 'Two', description: 'Summary', default_invite_role: false },
        ]}
        selectedRoleIds={['one']}
        toggleRoleSelection={toggle}
        onOpenChange={close}
        onInvite={invite}
        submitConflictResponse={{ conflicts: [{}] }}
      />
    );
    mocks.choices.forEach(choice => choice.onCheckedChange(false));
    fireEvent.click(document.querySelector('[data-action-id="groups.invitations.dialog.cancel"]')!);
    fireEvent.click(document.querySelector('[data-action-id="groups.invitations.dialog.submit"]')!);
    expect(toggle).toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith(false);
    expect(invite).toHaveBeenCalled();
    expect(document.body.textContent).toContain('conflict');
  });

  it('covers plain trigger, loading/zero selection, empty roles, and submission overlay fallbacks', () => {
    const view = render(
      <InviteMembersDialogView {...base} selectedUsers={[]} submitConflictLoading />
    );
    expect(document.body.textContent).toContain('Empty');
    view.rerender(
      <InviteMembersDialogView {...base} selectedUsers={[]} submitConflictLoading={false} />
    );
    view.rerender(
      <InviteMembersDialogView
        {...base}
        disabled
        disabledReason={undefined}
        actionSubmission={actionSubmission(true)}
        selectedUsers={[]}
      />
    );
    expect(mocks.overlay.preview.badges).toEqual(['Roles']);
    mocks.overlay.target.onClick();
    mocks.overlay.onBack();
    mocks.overlay.onRetry();
  });
});
