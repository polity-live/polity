/* @vitest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: () => 'Unknown user',
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/command', () => ({
  Command: ({ children }: any) => <div>{children}</div>,
  CommandEmpty: ({ children }: any) => <div>{children}</div>,
  CommandGroup: ({ children }: any) => <div>{children}</div>,
  CommandInput: ({ onValueChange, value, ...props }: any) => (
    <input value={value} onChange={event => onValueChange(event.target.value)} {...props} />
  ),
  CommandItem: ({ children, onSelect, ...props }: any) => (
    <button type="button" onClick={onSelect} {...props}>
      {children}
    </button>
  ),
  CommandList: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AvatarFallback: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  AvatarImage: (props: any) => <img {...props} />,
}));
vi.mock('@/features/shared/ui/status/StatusBadges', () => ({
  BadgeControl: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/features/shared/ui/feedback', () => ({
  SectionSkeleton: (props: any) => <div data-testid="skeleton" data-rows={props.rows} />,
}));

import { InviteCollaboratorDialogView } from '../InviteCollaboratorDialogView';
import { VersionControlView } from '../VersionControlView';

afterEach(cleanup);

function inviteModel(overrides: Record<string, unknown> = {}) {
  return {
    filteredUsers: [],
    handleInvite: vi.fn(),
    isInviting: false,
    isLoading: false,
    open: true,
    searchQuery: '',
    selectedUsers: [],
    setOpen: vi.fn(),
    setSearchQuery: vi.fn(),
    toggleUserSelection: vi.fn(),
    users: [],
    ...overrides,
  } as any;
}

function versionModel(overrides: Record<string, unknown> = {}) {
  return {
    editingTitle: '',
    editingVersionId: null,
    filteredVersions: [],
    formatDate: vi.fn(() => 'today'),
    handleCreateVersion: vi.fn(),
    handleRestoreVersion: vi.fn(),
    isCreateDialogOpen: true,
    isCreating: false,
    isHistoryDialogOpen: true,
    isLoading: false,
    saveEditedTitle: vi.fn(),
    searchQuery: '',
    setEditingTitle: vi.fn(),
    setEditingVersionId: vi.fn(),
    setIsCreateDialogOpen: vi.fn(),
    setIsHistoryDialogOpen: vi.fn(),
    setSearchQuery: vi.fn(),
    setVersionTitle: vi.fn(),
    startEditingTitle: vi.fn(),
    versionCount: 0,
    versionTitle: '',
    ...overrides,
  } as any;
}

describe('InviteCollaboratorDialogView remaining branches', () => {
  it('renders loading and disabled/inviting states', () => {
    const { rerender } = render(
      <InviteCollaboratorDialogView model={inviteModel({ isLoading: true })} />
    );
    expect(screen.getByTestId('skeleton')).toBeTruthy();
    expect(
      (
        document.querySelector(
          '[data-action-id="editor.collaborator-invite.submit"]'
        ) as HTMLButtonElement
      ).disabled
    ).toBe(true);

    rerender(
      <InviteCollaboratorDialogView
        model={inviteModel({ isInviting: true, selectedUsers: ['missing'], users: [] })}
      />
    );
    expect(
      (
        document.querySelector(
          '[data-action-id="editor.collaborator-invite.submit"]'
        ) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it('renders image, initials, selection, handle, and unknown-name fallbacks', () => {
    const imageUser = {
      id: 'image',
      first_name: 'Ada',
      last_name: 'Lovelace',
      avatar: 'ada.png',
      handle: 'ada',
    };
    const handleUser = { id: 'handle', first_name: null, last_name: null, handle: 'handle' };
    const unknownUser = { id: 'unknown', first_name: null, last_name: null, handle: null };
    const unknownAvatar = {
      id: 'unknown-avatar',
      first_name: null,
      last_name: null,
      handle: null,
      avatar: 'unknown.png',
    };
    const model = inviteModel({
      filteredUsers: [imageUser, handleUser, unknownUser, unknownAvatar],
      selectedUsers: ['image', 'handle', 'unknown'],
      users: [imageUser, handleUser, unknownUser],
    });
    render(<InviteCollaboratorDialogView model={model} />);

    expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
    expect(screen.getByText('@handle')).toBeTruthy();
    expect(screen.getAllByText('Unknown user').length).toBeGreaterThan(0);
    expect(screen.getAllByText('?').length).toBeGreaterThan(0);
    const choices = document.querySelectorAll(
      '[data-action-id="editor.collaborator-invite.user.toggle"]'
    );
    fireEvent.click(choices[1]!);
    fireEvent.click(choices[2]!);
    const search = document.querySelector('input')!;
    fireEvent.change(search, { target: { value: 'Ada' } });
    expect(model.setSearchQuery).toHaveBeenCalledWith('Ada');
  });
});

describe('VersionControlView remaining branches', () => {
  it('renders creation spinner, loading, and both empty messages', () => {
    const { rerender } = render(
      <VersionControlView model={versionModel({ isCreating: true, isLoading: true })} />
    );
    expect(screen.getByTestId('skeleton')).toBeTruthy();

    rerender(<VersionControlView model={versionModel()} />);
    expect(screen.getByText('features.editor.versionControl.noVersions')).toBeTruthy();
    rerender(<VersionControlView model={versionModel({ searchQuery: 'missing' })} />);
    expect(screen.getByText('features.editor.versionControl.noMatchingVersions')).toBeTruthy();
  });

  it('renders version and author fallbacks and dispatches all inputs', () => {
    const versions = [
      { id: 'v1', version_number: null, change_summary: null, created_at: 1, author: null },
      {
        id: 'v2',
        version_number: 2,
        change_summary: 'Named',
        created_at: 2,
        author: { first_name: '', last_name: '', email: 'fallback@example.test' },
      },
      {
        id: 'v3',
        version_number: 3,
        change_summary: 'Author',
        created_at: 3,
        author: { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.test' },
      },
    ];
    const model = versionModel({ filteredVersions: versions, versionCount: 3 });
    const { rerender } = render(<VersionControlView model={model} />);
    expect(screen.getByText('v0')).toBeTruthy();
    expect(screen.getByText('fallback@example.test')).toBeTruthy();
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    const inputs = document.querySelectorAll('input');
    fireEvent.change(inputs[0]!, { target: { value: 'Snapshot' } });
    fireEvent.change(inputs[1]!, { target: { value: 'search' } });
    expect(model.setVersionTitle).toHaveBeenCalledWith('Snapshot');
    expect(model.setSearchQuery).toHaveBeenCalledWith('search');

    const editing = versionModel({
      editingTitle: 'Editing',
      editingVersionId: 'v1',
      filteredVersions: [versions[0]],
      versionCount: 1,
    });
    rerender(<VersionControlView model={editing} />);
    const editingInput = Array.from(document.querySelectorAll('input')).find(
      input => input.value === 'Editing'
    )!;
    fireEvent.change(editingInput, { target: { value: 'Changed' } });
    expect(editing.setEditingTitle).toHaveBeenCalledWith('Changed');
  });
});
