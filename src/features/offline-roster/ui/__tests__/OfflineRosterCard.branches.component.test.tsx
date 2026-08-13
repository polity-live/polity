/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  controller: null as any,
  reducedMotion: false,
  dialogProps: [] as any[],
  tabsProps: [] as any[],
}));

vi.mock('../../hooks/useOfflineRosterCardController', () => ({
  useOfflineRosterCardController: () => state.controller,
}));

vi.mock('motion/react', async importOriginal => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return { ...actual, useReducedMotion: () => state.reducedMotion };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: (props: any) => {
    state.dialogProps.push(props);
    return <div>{props.children}</div>;
  },
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <footer>{children}</footer>,
  DialogHeader: ({ children }: any) => <header>{children}</header>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/features/shared/ui/ui/tabs', async importOriginal => {
  const actual = await importOriginal<typeof import('@/features/shared/ui/ui/tabs')>();
  return {
    ...actual,
    Tabs: (props: any) => {
      state.tabsProps.push(props);
      const ActualTabs = actual.Tabs;
      return <ActualTabs {...props} />;
    },
  };
});

import { OfflineRosterCard } from '../OfflineRosterCard';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'row-1',
    kind: 'offline',
    firstName: 'Ada',
    lastName: 'Lovelace',
    isActiveUser: false,
    roles: [],
    connectedUser: null,
    reasonNotSignedUp: null,
    ...overrides,
  };
}

function controller(overrides: Record<string, unknown> = {}) {
  const rows = [row()];
  return {
    manageOpen: false,
    setManageOpen: vi.fn(),
    manageTab: 'single',
    setManageTab: vi.fn(),
    editRow: null,
    setEditRow: vi.fn(),
    connectRow: null,
    setConnectRow: vi.fn(),
    singleDraft: { firstName: '', lastName: '', reasonNotSignedUp: '' },
    setSingleDraft: vi.fn(),
    editDraft: { firstName: '', lastName: '', reasonNotSignedUp: '' },
    setEditDraft: vi.fn(),
    selectedConnectedUser: null,
    setSelectedConnectedUser: vi.fn(),
    csvPreviewRows: [],
    csvFeedback: { duplicates: 0, missingNames: 0 },
    isSubmitting: false,
    manageSubmitStatus: 'idle',
    isDraggingCsv: false,
    setIsDraggingCsv: vi.fn(),
    fileInputId: 'file-input',
    fileInputRef: { current: { click: vi.fn() } },
    sortedRows: rows,
    connectItems: [],
    showRolesColumn: false,
    showConnectedUserColumn: false,
    handleCloseManageDialog: vi.fn(),
    readCsvFile: vi.fn(),
    handleCsvDrop: vi.fn(),
    handleCreateSingle: vi.fn(),
    handleImportCsv: vi.fn(),
    handleConnect: vi.fn(),
    handleSaveEdit: vi.fn(),
    handleDelete: vi.fn(),
    handleSetParticipationStatus: vi.fn(),
    handleToggleChannel: vi.fn(),
    openEditRow: vi.fn(),
    ...overrides,
  };
}

function card(overrides: Record<string, unknown> = {}) {
  return (
    <OfflineRosterCard
      title="Roster"
      description="Description"
      rows={state.controller.sortedRows}
      manageDialogTitle="Manage"
      manageDialogDescription="Manage description"
      {...(overrides as any)}
    />
  );
}

describe('OfflineRosterCard branch states', () => {
  beforeEach(() => {
    state.reducedMotion = false;
    state.dialogProps = [];
    state.tabsProps = [];
    state.controller = controller();
  });

  afterEach(() => cleanup());

  it('renders connected-user, provenance, role, status, and action variants', () => {
    const rows = [
      row({
        id: 'name',
        isActiveUser: true,
        connectedUser: {
          id: 'name',
          first_name: 'Grace',
          last_name: 'Hopper',
          avatar: 'avatar',
        },
        roles: [{ id: 'role', name: '' }],
        reasonNotSignedUp: 'Reason',
        attendanceStatus: 'confirmed',
        participationChannel: 'online',
        canToggleChannel: true,
        canViewRights: true,
        canManageRoles: true,
        canConfirmParticipation: true,
        canWithdrawParticipation: true,
        canConnect: true,
        canEdit: true,
        canDelete: true,
        partGroup: { id: 'part', name: '' },
        baseGroup: null,
      }),
      row({
        id: 'handle',
        connectedUser: { id: 'handle', first_name: '', last_name: '', handle: 'handle-only' },
        attendanceStatus: 'listed',
        participationChannel: 'offline',
        partGroup: { id: '', name: 'Fallback part' },
        baseGroup: { id: 'base', name: 'Base' },
      }),
      row({
        id: 'email',
        connectedUser: {
          id: 'email',
          first_name: null,
          last_name: null,
          email: 'mail@example.com',
        },
      }),
      row({
        id: 'fallback',
        connectedUser: { id: 'fallback', first_name: null, last_name: null },
        attendanceStatus: 'listed',
        participationChannel: null,
      }),
    ];
    state.controller = controller({
      sortedRows: rows,
      showRolesColumn: true,
      showConnectedUserColumn: true,
    });
    const { rerender } = render(card({ showProvenanceColumns: true }));
    expect(screen.getByText('Grace Hopper')).toBeTruthy();
    expect(screen.getByText('handle-only')).toBeTruthy();
    expect(screen.getByText('mail@example.com')).toBeTruthy();
    expect(screen.getByText('User')).toBeTruthy();
    expect(screen.getByText('Fallback part')).toBeTruthy();
    expect(screen.getByText('Base')).toBeTruthy();
    expect(screen.getByText('Participation confirmed')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Set Offline' })).toBeTruthy();

    rerender(card({ tableVariant: 'membership', showProvenanceColumns: true }));
    expect(screen.getAllByText('Role').length).toBeGreaterThan(0);
  });

  it('executes idle dialog, CSV feedback, drag, file, and dialog-close callbacks', () => {
    state.controller = controller({
      manageOpen: true,
      manageTab: 'csv',
      csvPreviewRows: [{ firstName: 'Ada', lastName: 'Lovelace', reasonNotSignedUp: '' }],
      csvFeedback: { duplicates: 2, missingNames: 3 },
    });
    const { rerender } = render(card({ showManageButton: true, manageButtonLabel: 'Manage' }));
    const dropZone = screen.getByText('Upload CSV').closest('div')!;
    fireEvent.dragEnter(dropZone);
    fireEvent.dragOver(dropZone);
    fireEvent.dragLeave(dropZone);
    fireEvent.drop(dropZone, { dataTransfer: { files: [] } });
    expect(state.controller.setIsDraggingCsv).toHaveBeenCalledWith(true);
    expect(state.controller.setIsDraggingCsv).toHaveBeenCalledWith(false);
    expect(state.controller.handleCsvDrop).toHaveBeenCalled();
    expect(screen.getByText(/2/)).toBeTruthy();
    expect(screen.getByText(/3/)).toBeTruthy();
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);

    fireEvent.click(document.querySelector('[data-action-id="offline-roster.manage.csv.choose"]')!);
    const fileInput = document.querySelector('input[type="file"]')!;
    const file = { text: vi.fn() };
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(state.controller.readCsvFile).toHaveBeenCalledWith(file);

    fireEvent.click(document.querySelector('[data-action-id="offline-roster.manage.submit"]')!);
    expect(state.controller.handleImportCsv).toHaveBeenCalled();

    fireEvent.mouseDown(
      document.querySelector('[data-action-id="offline-roster.manage.tab.single"]')!,
      {
        button: 0,
        ctrlKey: false,
      }
    );
    expect(state.controller.setManageTab).toHaveBeenCalledWith('single');

    const dialogs = state.dialogProps.slice(-3);
    dialogs[0].onOpenChange(true);
    dialogs[0].onOpenChange(false);
    expect(state.controller.handleCloseManageDialog).toHaveBeenCalledWith(true);
    expect(state.controller.handleCloseManageDialog).toHaveBeenCalledWith(false);

    state.controller = controller({
      manageOpen: true,
      manageTab: 'csv',
      isDraggingCsv: true,
      csvFeedback: { duplicates: 0, missingNames: 1 },
    });
    rerender(card());
    state.controller = controller({
      manageOpen: true,
      manageTab: 'csv',
      csvFeedback: { duplicates: 1, missingNames: 0 },
    });
    rerender(card());
  });

  it('renders reduced-motion CSV submission and blocks active drag and tab changes', () => {
    state.reducedMotion = true;
    state.controller = controller({
      manageOpen: true,
      manageTab: 'csv',
      manageSubmitStatus: 'submitting-csv',
      isSubmitting: true,
      csvPreviewRows: [{ firstName: 'Ada', lastName: 'Lovelace', reasonNotSignedUp: 'Reason' }],
    });
    const { rerender } = render(card());
    expect(screen.getByRole('status')).toBeTruthy();
    const dropZone = screen.getByText('Upload CSV').closest('div')!;
    fireEvent.dragEnter(dropZone);
    fireEvent.drop(dropZone, { dataTransfer: { files: [] } });
    expect(state.controller.setIsDraggingCsv).not.toHaveBeenCalledWith(true);
    expect(state.controller.handleCsvDrop).not.toHaveBeenCalled();
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [{ text: vi.fn() }] },
    });
    expect(state.controller.readCsvFile).not.toHaveBeenCalled();
    const activeDialogs = state.dialogProps.slice(-3);
    activeDialogs[0].onOpenChange(false);
    expect(state.controller.handleCloseManageDialog).not.toHaveBeenCalled();
    state.tabsProps.at(-1).onValueChange('single');
    expect(state.controller.setManageTab).not.toHaveBeenCalled();

    state.controller = controller({
      manageOpen: true,
      manageTab: 'csv',
      manageSubmitStatus: 'success-csv',
      csvPreviewRows: [{ firstName: 'Ada', lastName: 'Lovelace', reasonNotSignedUp: 'Reason' }],
    });
    rerender(card());
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getAllByText('Complete')).toHaveLength(3);
  });

  it('executes controlled connection and edit dialog callbacks and all draft setters', () => {
    state.controller = controller({
      connectRow: row(),
      editRow: row(),
      selectedConnectedUser: null,
      connectItems: [],
      editDraft: { firstName: 'Ada', lastName: 'Lovelace', reasonNotSignedUp: 'Reason' },
    });
    state.controller.setEditDraft.mockImplementation((updater: any) =>
      updater(state.controller.editDraft)
    );
    render(card());
    fireEvent.change(document.querySelector('#offline-edit-first-name')!, {
      target: { value: 'New first' },
    });
    fireEvent.change(document.querySelector('#offline-edit-last-name')!, {
      target: { value: 'New last' },
    });
    fireEvent.change(document.querySelector('#offline-edit-reason')!, {
      target: { value: 'New reason' },
    });
    expect(state.controller.setEditDraft).toHaveBeenCalledTimes(3);
    const dialogs = state.dialogProps.slice(-3);
    dialogs[1].onOpenChange(true);
    dialogs[1].onOpenChange(false);
    dialogs[2].onOpenChange(true);
    dialogs[2].onOpenChange(false);
    fireEvent.click(document.querySelector('[data-action-id="offline-roster.connection.cancel"]')!);
    expect(state.controller.setConnectRow).toHaveBeenCalledWith(null);
    expect(state.controller.setSelectedConnectedUser).toHaveBeenCalledWith(null);
    fireEvent.click(document.querySelector('[data-action-id="offline-roster.edit.cancel"]')!);
    expect(state.controller.setEditRow).toHaveBeenCalledWith(null);
  });
});
