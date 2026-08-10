// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  peers: [] as any[],
  wsPublish: vi.fn(),
  presenceCalls: [] as any[],
  theme: vi.fn(() => '#neutral'),
  generateColor: vi.fn((id: string) => `generated-${id}`),
  users: undefined as any,
  usersLoading: false,
  createEntry: vi.fn(),
  addCollaborator: vi.fn(),
  updateEditingMode: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  editor: null as any,
  broadcastCursor: vi.fn(),
  remoteOptions: undefined as any,
}));

vi.mock('@/features/shared/theme', () => ({
  featureThemeValue: mocks.theme,
}));
vi.mock('@/presence/usePresence', () => ({
  usePresence: (channel: string, options: unknown) => {
    mocks.presenceCalls.push({ channel, options });
    return { peers: mocks.peers, publishPresence: mocks.wsPublish };
  },
}));
vi.mock('../../logic/editor-helpers', () => ({
  generateUserColor: (...args: [string]) => mocks.generateColor(...args),
}));
vi.mock('@/zero/blogs/useBlogActions', () => ({
  useBlogActions: () => ({ createEntry: mocks.createEntry }),
}));
vi.mock('@/zero/documents/useDocumentActions', () => ({
  useDocumentActions: () => ({ addCollaborator: mocks.addCollaborator }),
}));
vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({ allUsers: mocks.users, isLoading: mocks.usersLoading }),
}));
vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({ updateEditingMode: mocks.updateEditingMode }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));
vi.mock('platejs/react', () => ({ useEditorRef: () => mocks.editor }));
vi.mock('../useRemoteCursors', () => ({
  useRemoteCursors: (options: unknown) => {
    mocks.remoteOptions = options;
    return { broadcastCursor: mocks.broadcastCursor };
  },
}));

import { useEditingModeSelectorController } from '../useEditingModeSelectorController';
import { useEditorPresence } from '../useEditorPresence';
import { useInviteCollaboratorModel } from '../useInviteCollaboratorModel';
import { useRemoteCursorsSyncController } from '../useRemoteCursorsSyncController';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'uuid') });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  mocks.peers = [];
  mocks.presenceCalls = [];
  mocks.users = undefined;
  mocks.usersLoading = false;
  mocks.editor = null;
  mocks.createEntry.mockResolvedValue(undefined);
  mocks.addCollaborator.mockResolvedValue(undefined);
  mocks.updateEditingMode.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('editing mode and remote cursor controller branches A03', () => {
  it('skips the current editing mode and persists a changed mode', async () => {
    const { result } = renderHook(() =>
      useEditingModeSelectorController({
        processBranchId: 'branch',
        currentMode: 'suggesting' as any,
      })
    );
    await act(() => result.current.handleModeChange('suggesting' as any));
    expect(mocks.updateEditingMode).not.toHaveBeenCalled();
    await act(() => result.current.handleModeChange('editing' as any));
    expect(mocks.updateEditingMode).toHaveBeenCalledWith('branch', 'editing');
  });

  it('covers all interval guards, refreshes the callback ref, emits selection, and cleans up', () => {
    const hook = renderHook(options => useRemoteCursorsSyncController(options), {
      initialProps: {
        entityId: 'entity',
        userId: undefined as string | undefined,
        userName: undefined as string | undefined,
        userColor: undefined as string | undefined,
        enabled: false,
        onActiveCursorsChange: undefined as undefined | ((userIds: Set<string>) => void),
      },
    });
    expect(mocks.remoteOptions).toEqual(expect.objectContaining({ enabled: false }));
    hook.rerender({
      entityId: 'entity',
      userId: 'user',
      userName: undefined,
      userColor: undefined,
      enabled: true,
      onActiveCursorsChange: undefined,
    });
    mocks.editor = { selection: { anchor: {}, focus: {} } };
    hook.rerender({
      entityId: 'entity',
      userId: undefined,
      userName: undefined,
      userColor: undefined,
      enabled: true,
      onActiveCursorsChange: undefined,
    });
    hook.rerender({
      entityId: 'entity',
      userId: 'user',
      userName: 'Name',
      userColor: '#fff',
      enabled: true,
      onActiveCursorsChange: vi.fn(),
    });
    const latestBroadcast = vi.fn();
    mocks.broadcastCursor = latestBroadcast;
    hook.rerender({
      entityId: 'entity',
      userId: 'user',
      userName: 'Name',
      userColor: '#fff',
      enabled: true,
      onActiveCursorsChange: undefined,
    });
    act(() => vi.advanceTimersByTime(150));
    expect(latestBroadcast).toHaveBeenCalledWith(mocks.editor.selection);
    hook.unmount();
  });
});

describe('useEditorPresence branches A03', () => {
  it('uses neutral/default presence without a user and disables publishing', () => {
    const { result } = renderHook(() => useEditorPresence({ entityId: 'entity', enabled: false }));
    expect(result.current.userColor).toBe('#neutral');
    expect(result.current.publishPresence).toBeNull();
    expect(mocks.presenceCalls.at(-1)).toEqual({
      channel: 'editor:entity',
      options: { enabled: false, initialData: undefined },
    });
  });

  it('maps every peer name/color source, excludes self, and publishes data with default enabled', () => {
    const colors = new Map([
      ['self', '#self'],
      ['mapped', '#mapped'],
    ]);
    mocks.peers = [
      { userId: 'self', name: 'Self', color: '#ignored' },
      { userId: 'mapped', name: 'Mapped', avatar: 'avatar', color: '#peer' },
      { userId: 'peer', name: '', color: '#peer-color' },
      { userId: 'generated', name: null, color: '' },
    ];
    const { result, rerender } = renderHook(options => useEditorPresence(options), {
      initialProps: {
        entityId: 'entity',
        userId: 'self' as string | undefined,
        userName: '' as string | undefined,
        userAvatar: undefined as string | undefined,
        userColorByUserId: colors as Map<string, string> | undefined,
        enabled: undefined as boolean | undefined,
      },
    });
    expect(result.current.userColor).toBe('#self');
    expect(result.current.onlinePeers.map(peer => peer.color)).toEqual([
      '#mapped',
      '#peer-color',
      'generated-generated',
    ]);
    expect(result.current.onlinePeers.map(peer => peer.name)).toEqual([
      'Mapped',
      'Anonymous',
      'Anonymous',
    ]);
    act(() => result.current.publishPresence?.({ name: 'Updated' }));
    expect(mocks.wsPublish).toHaveBeenCalledWith({ name: 'Updated' });

    rerender({
      entityId: 'entity',
      userId: 'new-user',
      userName: 'Named',
      userAvatar: 'avatar',
      userColorByUserId: undefined,
      enabled: true,
    });
    expect(result.current.userColor).toBe('generated-new-user');
    expect(mocks.presenceCalls.at(-1).options).toEqual(
      expect.objectContaining({
        initialData: expect.objectContaining({ name: 'Named', avatar: 'avatar' }),
      })
    );
  });
});

describe('useInviteCollaboratorModel branches A03', () => {
  const users = [
    null,
    { id: '', first_name: 'Missing id' },
    { id: 'self', first_name: 'Self' },
    { id: 'existing', first_name: 'Existing' },
    { id: 'first', first_name: 'Ada' },
    { id: 'last', last_name: 'Lovelace' },
    { id: 'handle', handle: 'civic-handle' },
    { id: 'email', email: 'person@example.com' },
    { id: 'none', first_name: 'No match' },
  ];

  it('covers absent users, default collaborators, loading, and every search/exclusion field', () => {
    mocks.usersLoading = true;
    const absent = renderHook(() =>
      useInviteCollaboratorModel({
        entityType: 'document' as any,
        entityId: 'doc',
        currentUserId: 'self',
      })
    );
    expect(absent.result.current.filteredUsers).toBeUndefined();
    expect(absent.result.current.isLoading).toBe(true);
    absent.unmount();

    mocks.users = users;
    const { result } = renderHook(() =>
      useInviteCollaboratorModel({
        entityType: 'document' as any,
        entityId: 'doc',
        currentUserId: 'self',
        existingCollaboratorIds: ['existing'],
      })
    );
    expect(result.current.filteredUsers?.map((user: any) => user.id)).toEqual([
      'first',
      'last',
      'handle',
      'email',
      'none',
    ]);
    for (const query of ['ada', 'lovelace', 'civic', 'example', 'missing']) {
      act(() => result.current.setSearchQuery(query));
    }
    expect(result.current.filteredUsers).toEqual([]);
    act(() => result.current.setOpen(true));
    expect(result.current.open).toBe(true);
  });

  it('toggles users, skips empty invitations, and creates singular/plural blog invitations', async () => {
    mocks.users = users;
    const { result } = renderHook(() =>
      useInviteCollaboratorModel({
        entityType: 'blog' as any,
        entityId: 'blog',
        currentUserId: 'self',
      })
    );
    await act(() => result.current.handleInvite());
    expect(mocks.createEntry).not.toHaveBeenCalled();
    act(() => result.current.toggleUserSelection('first'));
    await act(() => result.current.handleInvite());
    expect(mocks.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({ blog_id: 'blog', user_id: 'first', status: 'invited' })
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith('features.editor.inviteDialog.invitedOne');

    act(() => {
      result.current.toggleUserSelection('first');
      result.current.toggleUserSelection('last');
    });
    act(() => result.current.toggleUserSelection('first'));
    act(() => result.current.toggleUserSelection('first'));
    await act(() => result.current.handleInvite());
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining('features.editor.inviteDialog.invitedMultiple')
    );
    expect(result.current.selectedUsers).toEqual([]);
  });

  it('creates document collaborators and reports failures while restoring submitting state', async () => {
    mocks.users = users;
    const { result } = renderHook(() =>
      useInviteCollaboratorModel({
        entityType: 'document' as any,
        entityId: 'doc',
        currentUserId: 'self',
      })
    );
    act(() => result.current.toggleUserSelection('first'));
    await act(() => result.current.handleInvite());
    expect(mocks.addCollaborator).toHaveBeenCalledWith(
      expect.objectContaining({ document_id: 'doc', user_id: 'first', status: 'collaborator' })
    );

    act(() => result.current.toggleUserSelection('last'));
    mocks.addCollaborator.mockRejectedValueOnce(new Error('failed'));
    await act(() => result.current.handleInvite());
    expect(mocks.toastError).toHaveBeenCalledWith('features.editor.inviteDialog.inviteFailed');
    expect(result.current.isInviting).toBe(false);
  });
});
