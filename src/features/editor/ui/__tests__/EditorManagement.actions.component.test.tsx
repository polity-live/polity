/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InviteCollaboratorDialogView } from '../InviteCollaboratorDialogView';
import { VersionControlView } from '../VersionControlView';

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
  CommandInput: () => <input />,
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

afterEach(cleanup);

describe('editor management action contracts', () => {
  it('dispatches collaborator invitation actions through stable intents', () => {
    const user = { id: 'user-1', first_name: 'Ada', last_name: 'Lovelace', handle: 'ada' };
    const model = {
      filteredUsers: [user],
      handleInvite: vi.fn(),
      isInviting: false,
      isLoading: false,
      open: true,
      searchQuery: '',
      selectedUsers: ['user-1'],
      setOpen: vi.fn(),
      setSearchQuery: vi.fn(),
      toggleUserSelection: vi.fn(),
      users: [user],
    } as any;
    render(<InviteCollaboratorDialogView model={model} />);

    const open = document.querySelector(
      '[data-action-id="editor.collaborator-invite.open"]'
    ) as HTMLElement;
    open.focus();
    expect(document.activeElement).toBe(open);
    fireEvent.click(
      document.querySelector('[data-action-id="editor.collaborator-invite.selection.remove"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="editor.collaborator-invite.user.toggle"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="editor.collaborator-invite.cancel"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="editor.collaborator-invite.submit"]')!
    );
    expect(model.toggleUserSelection).toHaveBeenNthCalledWith(1, 'user-1');
    expect(model.toggleUserSelection).toHaveBeenNthCalledWith(2, 'user-1');
    expect(model.setOpen).toHaveBeenCalledWith(false);
    expect(model.handleInvite).toHaveBeenCalledOnce();
  });

  it('dispatches version creation, history, title, and restore actions through stable intents', () => {
    const version = {
      id: 'version-1',
      version_number: 1,
      change_summary: 'First version',
      created_at: 1,
    };
    const model = {
      editingTitle: 'Renamed version',
      editingVersionId: null,
      filteredVersions: [version],
      formatDate: () => 'today',
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
      versionCount: 1,
      versionTitle: 'Snapshot',
    } as any;
    const view = render(<VersionControlView model={model} />);

    expect(document.querySelector('[data-action-id="editor.version.create.open"]')).toBeTruthy();
    expect(document.querySelector('[data-action-id="editor.version.history.open"]')).toBeTruthy();
    fireEvent.click(document.querySelector('[data-action-id="editor.version.create.cancel"]')!);
    fireEvent.click(document.querySelector('[data-action-id="editor.version.create.submit"]')!);
    fireEvent.click(document.querySelector('[data-action-id="editor.version.title.edit"]')!);
    fireEvent.click(document.querySelector('[data-action-id="editor.version.restore"]')!);
    expect(model.setIsCreateDialogOpen).toHaveBeenCalledWith(false);
    expect(model.handleCreateVersion).toHaveBeenCalledOnce();
    expect(model.startEditingTitle).toHaveBeenCalledWith(version);
    expect(model.handleRestoreVersion).toHaveBeenCalledWith(version);

    view.rerender(<VersionControlView model={{ ...model, editingVersionId: 'version-1' }} />);
    fireEvent.click(document.querySelector('[data-action-id="editor.version.title.save"]')!);
    fireEvent.click(document.querySelector('[data-action-id="editor.version.title.cancel"]')!);
    expect(model.saveEditedTitle).toHaveBeenCalledWith('version-1');
    expect(model.setEditingVersionId).toHaveBeenCalledWith(null);
  });
});
