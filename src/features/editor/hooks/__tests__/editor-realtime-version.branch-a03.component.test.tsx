// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connected: true,
  presenceCalls: [] as { channel: string; options: unknown }[],
  publish: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  subscriptions: new Map<string, (payload: Record<string, unknown>) => void>(),
  editor: null as null | {
    getApi: ReturnType<typeof vi.fn>;
  },
  addCursor: vi.fn(),
  removeCursor: vi.fn(),
  generateColor: vi.fn((id: string) => `generated-${id}`),
  createVersion: vi.fn(),
  updateVersion: vi.fn(),
  deleteVersion: vi.fn(),
  docVersions: [] as any[],
  blogVersions: [] as any[],
  docLoading: false,
  blogLoading: false,
  documentStateOptions: [] as unknown[],
  blogStateOptions: [] as unknown[],
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  mutableJson: vi.fn((value: unknown) => value),
  translate: vi.fn((key: string) => key),
}));

vi.mock('@/presence/usePresence', () => ({
  usePresence: (channel: string, options: unknown) => {
    mocks.presenceCalls.push({ channel, options });
    return {
      isConnected: mocks.connected,
      publishTopic: mocks.publish,
      subscribeTopic: mocks.subscribe,
    };
  },
}));

vi.mock('platejs/react', () => ({
  useEditorRef: () => mocks.editor,
}));

vi.mock('@platejs/selection/react', () => ({ CursorOverlayPlugin: { key: 'cursor' } }));

vi.mock('../../logic/editor-helpers', () => ({
  generateUserColor: (...args: [string]) => mocks.generateColor(...args),
}));

vi.mock('@/zero/documents/useDocumentActions', () => ({
  useDocumentActions: () => ({
    createVersion: mocks.createVersion,
    updateVersion: mocks.updateVersion,
    deleteVersion: mocks.deleteVersion,
  }),
}));

vi.mock('@/zero/documents/useDocumentState', () => ({
  useDocumentState: (options: unknown) => {
    mocks.documentStateOptions.push(options);
    return { versions: mocks.docVersions, isLoading: mocks.docLoading };
  },
}));

vi.mock('@/zero/blogs/useBlogState', () => ({
  useBlogState: (options: unknown) => {
    mocks.blogStateOptions.push(options);
    return { versions: mocks.blogVersions, isLoading: mocks.blogLoading };
  },
}));

vi.mock('@/zero/shared/helpers', () => ({
  toMutableJSONValue: (...args: [unknown]) => mocks.mutableJson(...args),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: mocks.translate }),
}));

import { useEditorVersion } from '../useEditorVersion';
import { useRealtimeSync } from '../useRealtimeSync';
import { useRemoteCursors } from '../useRemoteCursors';
import { useVersionControlModel } from '../useVersionControlModel';

const content = [{ type: 'p', children: [{ text: 'content' }] }] as any;

function version(overrides: Record<string, unknown> = {}) {
  return {
    id: 'version-1',
    version_number: 1,
    change_summary: 'Initial draft',
    content,
    author: { first_name: 'Ada', last_name: 'Lovelace' },
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-09T12:00:00Z'));
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'version-uuid') });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  mocks.connected = true;
  mocks.presenceCalls = [];
  mocks.subscriptions.clear();
  mocks.subscribe.mockImplementation(
    (topic: string, callback: (payload: Record<string, unknown>) => void) => {
      mocks.subscriptions.set(topic, callback);
      return mocks.unsubscribe;
    }
  );
  mocks.editor = {
    getApi: vi.fn(() => ({
      cursorOverlay: {
        addCursor: mocks.addCursor,
        removeCursor: mocks.removeCursor,
      },
    })),
  };
  mocks.docVersions = [];
  mocks.blogVersions = [];
  mocks.docLoading = false;
  mocks.blogLoading = false;
  mocks.documentStateOptions = [];
  mocks.blogStateOptions = [];
  mocks.createVersion.mockResolvedValue(undefined);
  mocks.updateVersion.mockResolvedValue(undefined);
  mocks.deleteVersion.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useRemoteCursors branch campaign A03', () => {
  it('subscribes, ignores stale senders, replaces cursors, expires them, and cleans up', () => {
    const active = vi.fn();
    const { rerender, unmount } = renderHook(options => useRemoteCursors(options), {
      initialProps: {
        entityId: 'document-1',
        userId: 'local-user' as string | undefined,
        userName: '' as string | undefined,
        userColor: '' as string | undefined,
        enabled: true,
        onActiveCursorsChange: active as ((ids: Set<string>) => void) | undefined,
      },
    });

    expect(mocks.presenceCalls.at(-1)).toEqual({
      channel: 'editor:document-1',
      options: { enabled: true },
    });
    const receive = mocks.subscriptions.get('cursor')!;
    act(() => {
      receive({});
      receive({ senderId: 'local-user', selection: content });
      receive({
        senderId: 'remote-user',
        selection: { anchor: {}, focus: {} },
        userColor: '',
      });
    });
    expect(mocks.generateColor).toHaveBeenCalledWith('remote-user');
    expect(mocks.addCursor).toHaveBeenCalledWith(
      'remote-user',
      expect.objectContaining({
        data: expect.objectContaining({
          style: { backgroundColor: 'generated-remote-user' },
          selectionStyle: { backgroundColor: 'generated-remote-user33' },
        }),
      })
    );
    expect(active).toHaveBeenLastCalledWith(new Set(['remote-user']));

    act(() => {
      receive({ senderId: 'remote-user', selection: null, userColor: '#123456' });
    });
    expect(mocks.removeCursor).toHaveBeenCalledWith('remote-user');
    expect(active).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(10_000));
    expect(active).toHaveBeenLastCalledWith(new Set());

    rerender({
      entityId: 'document-1',
      userId: 'local-user',
      userName: 'Local',
      userColor: '#abcdef',
      enabled: true,
      onActiveCursorsChange: undefined,
    });
    const receiveAgain = mocks.subscriptions.get('cursor')!;
    act(() => receiveAgain({ senderId: 'other-user', selection: content }));
    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalled();
    expect(mocks.removeCursor).toHaveBeenCalledWith('other-user');
  });

  it('covers disabled subscription guards and disconnected/missing-user broadcasts', () => {
    mocks.editor = null;
    const { result, rerender, unmount } = renderHook(options => useRemoteCursors(options), {
      initialProps: {
        entityId: '',
        userId: undefined as string | undefined,
        userName: undefined as string | undefined,
        userColor: undefined as string | undefined,
        enabled: false,
        onActiveCursorsChange: undefined,
      },
    });
    expect(mocks.presenceCalls.at(-1)).toEqual({ channel: '', options: { enabled: false } });
    act(() => result.current.broadcastCursor(null));
    expect(mocks.publish).not.toHaveBeenCalled();

    mocks.connected = false;
    rerender({
      entityId: 'entity',
      userId: 'user',
      userName: undefined,
      userColor: undefined,
      enabled: true,
      onActiveCursorsChange: undefined,
    });
    act(() => result.current.broadcastCursor(content));
    expect(mocks.publish).not.toHaveBeenCalled();
    unmount();
  });

  it('broadcasts the leading and trailing selection with defaults and clears pending work', () => {
    const { result, rerender, unmount } = renderHook(options => useRemoteCursors(options), {
      initialProps: {
        entityId: 'entity',
        userId: 'user' as string | undefined,
        userName: undefined as string | undefined,
        userColor: undefined as string | undefined,
        enabled: true,
        onActiveCursorsChange: undefined,
      },
    });
    act(() => result.current.broadcastCursor(content));
    expect(mocks.publish).toHaveBeenLastCalledWith(
      'cursor',
      expect.objectContaining({
        senderId: 'user',
        userName: 'Anonymous',
        userColor: 'generated-user',
      })
    );

    rerender({
      entityId: 'entity',
      userId: 'user',
      userName: 'Named',
      userColor: '#112233',
      enabled: true,
      onActiveCursorsChange: undefined,
    });
    act(() => {
      result.current.broadcastCursor(null);
      result.current.broadcastCursor(content);
      vi.advanceTimersByTime(100);
    });
    expect(mocks.publish).toHaveBeenLastCalledWith(
      'cursor',
      expect.objectContaining({ userName: 'Named', userColor: '#112233', selection: content })
    );
    act(() => result.current.broadcastCursor(null));
    unmount();
  });
});

describe('useRealtimeSync branch campaign A03', () => {
  it('applies only valid remote content through the latest callback and unsubscribes', () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender, unmount } = renderHook(options => useRealtimeSync(options), {
      initialProps: {
        entityId: 'document',
        userId: 'local' as string | undefined,
        content,
        onRemoteContent: first,
        enabled: true,
      },
    });
    rerender({
      entityId: 'document',
      userId: 'local',
      content,
      onRemoteContent: latest,
      enabled: true,
    });
    const receive = mocks.subscriptions.get('content')!;
    act(() => {
      receive({ senderId: 'local', content });
      receive({ senderId: 'remote' });
      receive({ senderId: 'remote', content: {} });
      receive({ senderId: 'remote', content: [] });
      receive({ senderId: 'remote', content });
    });
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith(content);
    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalled();
  });

  it('covers disabled subscription and disconnected or missing-user broadcast guards', () => {
    mocks.connected = false;
    const { result, rerender, unmount } = renderHook(options => useRealtimeSync(options), {
      initialProps: {
        entityId: '',
        userId: undefined as string | undefined,
        content,
        onRemoteContent: vi.fn(),
        enabled: false,
      },
    });
    expect(mocks.presenceCalls.at(-1)).toEqual({ channel: '', options: { enabled: false } });
    act(() => result.current.broadcastContent(content));
    mocks.connected = true;
    rerender({
      entityId: 'document',
      userId: undefined,
      content,
      onRemoteContent: vi.fn(),
      enabled: true,
    });
    act(() => result.current.broadcastContent(content));
    expect(mocks.publish).not.toHaveBeenCalled();
    unmount();
  });

  it('publishes leading/trailing content and cancels replaced and unmounted timers', () => {
    const { result, unmount } = renderHook(() =>
      useRealtimeSync({
        entityId: 'document',
        userId: 'local',
        content,
        onRemoteContent: vi.fn(),
      })
    );
    act(() => result.current.broadcastContent(content));
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    const next = [{ type: 'p', children: [{ text: 'next' }] }] as any;
    act(() => {
      result.current.broadcastContent(next);
      result.current.broadcastContent(content);
      vi.advanceTimersByTime(200);
    });
    expect(mocks.publish).toHaveBeenLastCalledWith('content', {
      senderId: 'local',
      content,
    });
    act(() => result.current.broadcastContent(next));
    unmount();
  });
});

describe('useEditorVersion branch campaign A03', () => {
  it('selects document/blog state, sorts nullable numbers, and computes latest versions', () => {
    mocks.docVersions = [
      version({ id: 'two', version_number: 2 }),
      version({ id: 'none', version_number: null }),
      version({ id: 'one', version_number: 1 }),
    ];
    mocks.docLoading = true;
    const { result, rerender } = renderHook(options => useEditorVersion(options), {
      initialProps: {
        entityType: 'document' as any,
        entityId: 'doc',
        userId: 'user' as string | undefined,
      },
    });
    expect(result.current.sortedVersions.map(item => item.id)).toEqual(['two', 'one', 'none']);
    expect(result.current.latestVersionNumber).toBe(2);
    expect(result.current.isLoading).toBe(true);
    mocks.blogVersions = [];
    mocks.blogLoading = false;
    rerender({ entityType: 'blog' as any, entityId: 'blog', userId: 'user' });
    expect(result.current.latestVersionNumber).toBe(0);
    expect(result.current.versions).toEqual([]);
    expect(mocks.documentStateOptions.at(-1)).toEqual({
      documentId: undefined,
      includeVersions: false,
    });
    expect(mocks.blogStateOptions.at(-1)).toEqual({ blogId: 'blog', includeVersions: true });
  });

  it('validates and creates document and blog versions, including failures', async () => {
    mocks.docVersions = [version({ version_number: null })];
    const { result, rerender } = renderHook(options => useEditorVersion(options), {
      initialProps: {
        entityType: 'document' as any,
        entityId: 'doc',
        userId: undefined as string | undefined,
      },
    });
    await act(() => result.current.createVersion('Title', content));
    expect(mocks.toastError).toHaveBeenCalledWith('features.editor.versionControl.notLoggedIn');
    rerender({ entityType: 'document' as any, entityId: 'doc', userId: 'user' });
    await act(() => result.current.createVersion('   ', content));
    expect(mocks.toastError).toHaveBeenCalledWith('features.editor.versionControl.enterTitle');
    await act(() => result.current.createVersion(' Title ', content, 'automatic' as any));
    expect(mocks.createVersion).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'version-uuid',
        change_summary: 'Title',
        document_id: 'doc',
        blog_id: null,
      })
    );

    rerender({ entityType: 'blog' as any, entityId: 'blog', userId: 'user' });
    mocks.createVersion.mockRejectedValueOnce(new Error('create failed'));
    await act(() => result.current.createVersion('Blog title', content));
    expect(mocks.createVersion).toHaveBeenLastCalledWith(
      expect.objectContaining({ document_id: '', blog_id: 'blog' })
    );
    expect(mocks.toastError).toHaveBeenCalledWith('features.editor.versionControl.createFailed');
    expect(result.current.isCreating).toBe(false);
  });

  it('restores JSON/object values and handles restore, update, and delete failures', async () => {
    const { result } = renderHook(() =>
      useEditorVersion({ entityType: 'document' as any, entityId: 'doc', userId: 'user' })
    );
    const restore = vi.fn();
    await act(() =>
      result.current.restoreVersion(version({ content: JSON.stringify(content) }), restore)
    );
    await act(() => result.current.restoreVersion(version({ content }), restore));
    expect(restore).toHaveBeenCalledTimes(2);
    await act(() => result.current.restoreVersion(version({ content: '{invalid' }), restore));
    expect(mocks.toastError).toHaveBeenCalledWith('features.editor.versionControl.restoreFailed');

    await act(() => result.current.updateVersionTitle('id', '   '));
    await act(() => result.current.updateVersionTitle('id', ' New title '));
    expect(mocks.updateVersion).toHaveBeenCalledWith({ id: 'id', change_summary: 'New title' });
    mocks.updateVersion.mockRejectedValueOnce(new Error('update failed'));
    await act(() => result.current.updateVersionTitle('id', 'Fail'));
    expect(mocks.toastError).toHaveBeenCalledWith('features.editor.versionControl.updateFailed');

    await act(() => result.current.deleteVersion('id'));
    mocks.deleteVersion.mockRejectedValueOnce(new Error('delete failed'));
    await act(() => result.current.deleteVersion('id'));
    expect(mocks.toastError).toHaveBeenCalledWith('features.editor.versionControl.deleteFailed');
  });
});

describe('useVersionControlModel branch campaign A03', () => {
  it('deduplicates, sorts, filters every searchable field, and formats dates', () => {
    mocks.docVersions = [
      version({
        id: 'author',
        version_number: null,
        change_summary: '',
        author: { first_name: 'Grace', last_name: null },
      }),
      version({ id: 'summary', version_number: 3, change_summary: 'Budget draft' }),
      version({ id: 'summary', version_number: 3, change_summary: 'duplicate' }),
      version({ id: 'number', version_number: 22, change_summary: null, author: null }),
    ];
    mocks.docLoading = true;
    const onRestore = vi.fn();
    const { result } = renderHook(() =>
      useVersionControlModel({
        entityType: 'document' as any,
        entityId: 'doc',
        currentContent: content,
        currentUserId: 'user',
        onRestoreVersion: onRestore,
      })
    );
    expect(result.current.versionCount).toBe(3);
    expect(result.current.filteredVersions).toHaveLength(3);
    expect(result.current.isLoading).toBe(true);
    act(() => result.current.setSearchQuery('budget'));
    expect(result.current.filteredVersions.map(item => item.id)).toEqual(['summary']);
    act(() => result.current.setSearchQuery('22'));
    expect(result.current.filteredVersions.map(item => item.id)).toEqual(['number']);
    act(() => result.current.setSearchQuery('grace'));
    expect(result.current.filteredVersions.map(item => item.id)).toEqual(['author']);
    act(() => result.current.setSearchQuery('missing'));
    expect(result.current.filteredVersions).toEqual([]);
    expect(result.current.formatDate(0)).toBe(new Date(0).toLocaleString());
  });

  it('creates first document version, validates a title, and handles callbacks and failure', async () => {
    const created = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useVersionControlModel({
        entityType: 'document' as any,
        entityId: 'doc',
        currentContent: content,
        currentUserId: 'user',
        onRestoreVersion: vi.fn(),
        onVersionCreated: created,
      })
    );
    await act(() => result.current.handleCreateVersion());
    expect(mocks.toastError).toHaveBeenCalledWith('features.editor.versionControl.enterTitle');
    act(() => {
      result.current.setVersionTitle('First');
      result.current.setIsCreateDialogOpen(true);
    });
    await act(() => result.current.handleCreateVersion());
    expect(mocks.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({ version_number: 1, document_id: 'doc', blog_id: null })
    );
    expect(created).toHaveBeenCalledWith({
      changeSummary: 'First',
      versionId: 'version-uuid',
      versionNumber: 1,
    });
    expect(result.current.versionTitle).toBe('');
    expect(result.current.isCreateDialogOpen).toBe(false);

    act(() => result.current.setVersionTitle('Failure'));
    mocks.createVersion.mockRejectedValueOnce(new Error('failure'));
    await act(() => result.current.handleCreateVersion());
    expect(mocks.toastError).toHaveBeenCalledWith('features.editor.versionControl.createFailed');
    expect(result.current.isCreating).toBe(false);
  });

  it('creates the next blog version with nullable numbers and no callback', async () => {
    mocks.blogVersions = [
      version({ id: 'four', version_number: 4 }),
      version({ id: 'none', version_number: null }),
    ];
    const { result } = renderHook(() =>
      useVersionControlModel({
        entityType: 'blog' as any,
        entityId: 'blog',
        currentContent: content,
        currentUserId: 'user',
        onRestoreVersion: vi.fn(),
      })
    );
    act(() => result.current.setVersionTitle('Blog version'));
    await act(() => result.current.handleCreateVersion());
    expect(mocks.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({ version_number: 5, document_id: '', blog_id: 'blog' })
    );
    expect(mocks.blogStateOptions.at(-1)).toEqual({ blogId: 'blog', includeVersions: true });
  });

  it('restores and edits titles across success, validation, nullable, and error states', async () => {
    const restore = vi.fn();
    const { result } = renderHook(() =>
      useVersionControlModel({
        entityType: 'document' as any,
        entityId: 'doc',
        currentContent: content,
        currentUserId: 'user',
        onRestoreVersion: restore,
      })
    );
    act(() => result.current.setIsHistoryDialogOpen(true));
    await act(() => result.current.handleRestoreVersion(version({ version_number: null })));
    expect(restore).toHaveBeenCalledWith(content);
    expect(result.current.isHistoryDialogOpen).toBe(false);
    restore.mockImplementationOnce(() => {
      throw new Error('restore failed');
    });
    await act(() => result.current.handleRestoreVersion(version()));
    expect(mocks.toastError).toHaveBeenCalledWith('features.editor.versionControl.restoreFailed');

    act(() => result.current.startEditingTitle(version({ change_summary: null })));
    expect(result.current.editingTitle).toBe('');
    await act(() => result.current.saveEditedTitle('version-1'));
    expect(mocks.toastError).toHaveBeenCalledWith('features.editor.versionControl.enterTitle');
    act(() => result.current.setEditingTitle('Changed'));
    await act(() => result.current.saveEditedTitle('version-1'));
    expect(mocks.updateVersion).toHaveBeenCalledWith({
      id: 'version-1',
      change_summary: 'Changed',
    });
    expect(result.current.editingVersionId).toBeNull();

    act(() => result.current.setEditingTitle('Failure'));
    mocks.updateVersion.mockRejectedValueOnce(new Error('failure'));
    await act(() => result.current.saveEditedTitle('version-1'));
    expect(mocks.toastError).toHaveBeenCalledWith(
      'features.editor.versionControl.titleUpdateFailed'
    );
    act(() => result.current.setEditingVersionId('manual'));
    expect(result.current.editingVersionId).toBe('manual');
  });
});
