/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useOfflineRosterCardController } from '../useOfflineRosterCardController';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'offline-1',
    kind: 'offline',
    firstName: 'Ada',
    lastName: 'Lovelace',
    isActiveUser: false,
    roles: [],
    connectedUser: null,
    reasonNotSignedUp: null,
    ...overrides,
  } as never;
}

describe('useOfflineRosterCardController', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'correlation') });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sorts rows and derives candidate labels and optional columns', () => {
    const rows = [
      row({ id: 'inactive-z', firstName: 'Zed', lastName: 'Same' }),
      row({ id: 'active', firstName: 'Beta', lastName: 'Zulu', isActiveUser: true }),
      row({ id: 'inactive-a', firstName: 'Ada', lastName: 'Same', canManageRoles: true }),
      row({ id: 'rights', firstName: 'Rights', lastName: 'Alpha', canViewRights: true }),
      row({ id: 'connected', connectedUser: { id: 'connected-user' } }),
    ];
    const candidates = [
      { id: 'name', first_name: 'Grace', last_name: 'Hopper', handle: 'grace' },
      { id: 'handle', first_name: '', last_name: '', handle: 'handle-only' },
      { id: 'email', first_name: null, last_name: null, handle: null, email: 'mail@example.com' },
      { id: 'fallback', first_name: null, last_name: null, handle: null, email: null },
    ];
    const { result } = renderHook(() =>
      useOfflineRosterCardController({ rows, connectedUserCandidates: candidates as never })
    );

    expect(result.current.sortedRows.map(item => item.id)).toEqual([
      'active',
      'rights',
      'connected',
      'inactive-a',
      'inactive-z',
    ]);
    expect(result.current.connectItems.map(item => item.label)).toEqual([
      'Grace Hopper',
      'handle-only',
      'mail@example.com',
      'User',
    ]);
    expect(result.current.showRolesColumn).toBe(true);
    expect(result.current.showConnectedUserColumn).toBe(true);
  });

  it('resets dialog and CSV state and handles drops with and without a file', async () => {
    const { result } = renderHook(() => useOfflineRosterCardController({ rows: [row()] }));
    const input = document.createElement('input');
    input.value = 'C:\\fakepath\\roster.csv';
    Object.defineProperty(result.current.fileInputRef, 'current', {
      configurable: true,
      value: input,
    });
    act(() => {
      result.current.handleCloseManageDialog(true);
      result.current.setManageTab('csv');
      result.current.setSingleDraft({
        firstName: 'Temp',
        lastName: 'User',
        reasonNotSignedUp: 'Reason',
      });
    });
    await act(async () =>
      result.current.readCsvFile({
        text: vi.fn().mockResolvedValue('Ada,Lovelace,\nGrace,Hopper,Offline'),
      } as never)
    );
    expect(result.current.csvFeedback.duplicates).toBe(1);
    expect(result.current.csvPreviewRows).toHaveLength(1);

    const preventDefault = vi.fn();
    await act(async () =>
      result.current.handleCsvDrop({ preventDefault, dataTransfer: { files: [] } } as never)
    );
    expect(preventDefault).toHaveBeenCalled();
    await act(async () =>
      result.current.handleCsvDrop({
        preventDefault,
        dataTransfer: {
          files: [{ text: vi.fn().mockResolvedValue('Linus,Torvalds,Offline') }],
        },
      } as never)
    );
    expect(result.current.csvPreviewRows[0]).toMatchObject({ firstName: 'Linus' });

    act(() => result.current.handleCloseManageDialog(false));
    expect(result.current.manageTab).toBe('single');
    expect(result.current.singleDraft.firstName).toBe('');
    expect(result.current.csvPreviewRows).toEqual([]);
    expect(input.value).toBe('');
  });

  it('guards every mutation when handlers or required state are missing', async () => {
    const { result } = renderHook(() => useOfflineRosterCardController({ rows: [row()] }));
    await act(async () => {
      await result.current.handleCreateSingle();
      await result.current.handleImportCsv();
      await result.current.handleConnect();
      await result.current.handleSaveEdit();
      await result.current.handleDelete(row());
      await result.current.handleSetParticipationStatus(row(), 'confirmed');
      await result.current.handleToggleChannel(row(), 'online');
    });

    act(() => {
      result.current.openEditRow(row({ reasonNotSignedUp: null }));
      result.current.setSingleDraft({ firstName: '', lastName: 'User', reasonNotSignedUp: '' });
    });
    expect(result.current.editDraft.reasonNotSignedUp).toBe('');
    await act(async () => result.current.handleCreateSingle());
    act(() =>
      result.current.setSingleDraft({ firstName: 'Temp', lastName: '', reasonNotSignedUp: '' })
    );
    await act(async () => result.current.handleCreateSingle());
  });

  it('creates and imports rows through success and failure states', async () => {
    vi.useFakeTimers();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const onImport = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useOfflineRosterCardController({ rows: [], onCreate, onImport })
    );
    act(() =>
      result.current.setSingleDraft({
        firstName: ' Ada ',
        lastName: ' Lovelace ',
        reasonNotSignedUp: ' Offline ',
      })
    );
    let createPromise!: Promise<void>;
    act(() => {
      createPromise = result.current.handleCreateSingle();
    });
    expect(result.current.manageSubmitStatus).toBe('submitting-single');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(650);
      await createPromise;
    });
    expect(onCreate).toHaveBeenCalledWith(
      { firstName: 'Ada', lastName: 'Lovelace', reasonNotSignedUp: 'Offline' },
      'offline-roster-single-add:correlation'
    );

    await act(async () =>
      result.current.readCsvFile({
        text: vi.fn().mockResolvedValue('Grace,Hopper,Offline'),
      } as never)
    );
    let importPromise!: Promise<void>;
    act(() => {
      importPromise = result.current.handleImportCsv();
    });
    expect(result.current.manageSubmitStatus).toBe('submitting-csv');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(650);
      await importPromise;
    });
    expect(onImport).toHaveBeenCalledWith(
      [{ firstName: 'Grace', lastName: 'Hopper', reasonNotSignedUp: 'Offline' }],
      'offline-roster-csv-import:correlation'
    );

    onCreate.mockRejectedValueOnce(new Error('create failed'));
    act(() =>
      result.current.setSingleDraft({
        firstName: 'Fail',
        lastName: 'Create',
        reasonNotSignedUp: '',
      })
    );
    await expect(result.current.handleCreateSingle()).rejects.toThrow('create failed');
    expect(result.current.manageSubmitStatus).toBe('idle');

    await act(async () =>
      result.current.readCsvFile({
        text: vi.fn().mockResolvedValue('Fail,Import,Offline'),
      } as never)
    );
    onImport.mockRejectedValueOnce(new Error('import failed'));
    await expect(result.current.handleImportCsv()).rejects.toThrow('import failed');
    expect(result.current.isSubmitting).toBe(false);
  });

  it('connects and edits while restoring submitting state after callback failures', async () => {
    const onConnect = vi.fn().mockRejectedValueOnce(new Error('connect failed'));
    const onEdit = vi.fn().mockRejectedValueOnce(new Error('edit failed'));
    const onDelete = vi.fn();
    const onSetParticipationStatus = vi.fn();
    const onToggleChannel = vi.fn();
    const rosterRow = row({ reasonNotSignedUp: 'Reason' });
    const { result } = renderHook(() =>
      useOfflineRosterCardController({
        rows: [rosterRow],
        onConnect,
        onEdit,
        onDelete,
        onSetParticipationStatus,
        onToggleChannel,
      })
    );
    act(() => {
      result.current.setConnectRow(rosterRow);
      result.current.setSelectedConnectedUser({ id: 'user-1', label: 'User' } as never);
    });
    await expect(result.current.handleConnect()).rejects.toThrow('connect failed');
    expect(result.current.isSubmitting).toBe(false);

    act(() => result.current.openEditRow(rosterRow));
    await expect(result.current.handleSaveEdit()).rejects.toThrow('edit failed');
    expect(result.current.isSubmitting).toBe(false);

    await act(async () => {
      await result.current.handleDelete(rosterRow);
      await result.current.handleSetParticipationStatus(rosterRow, 'confirmed');
      await result.current.handleSetParticipationStatus(rosterRow, 'listed');
      await result.current.handleToggleChannel(rosterRow, 'offline');
    });
    expect(onDelete).toHaveBeenCalledWith(rosterRow, 'offline-roster-delete:correlation');
    expect(onSetParticipationStatus).toHaveBeenCalledTimes(2);
    expect(onToggleChannel).toHaveBeenCalledWith(
      rosterRow,
      'offline',
      'offline-roster-toggle-channel:correlation'
    );
  });
});
