'use client';

import type { DragEvent } from 'react';
import { useId, useMemo, useRef, useState } from 'react';

import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';

import { normalizeDraftKey, parseOfflineRosterCsv } from '../logic/offlineRosterCsv';
import type {
  DraftRosterEntry,
  OfflineRosterCandidateUser,
  OfflineRosterCardProps,
  OfflineRosterConnectedUser,
  OfflineRosterRow,
} from '../types';

type OfflineRosterManageSubmitStatus =
  | 'idle'
  | 'submitting-single'
  | 'submitting-csv'
  | 'success-single'
  | 'success-csv';

const MANAGE_SUBMIT_SUCCESS_DELAY_MS = 650;

function buildCorrelationId(flow: string) {
  return `${flow}:${crypto.randomUUID()}`;
}

function logRosterClient(flow: string, stage: string, payload: Record<string, unknown> = {}) {
  console.info('[offline-roster]', {
    flow,
    stage,
    ...payload,
  });
}

function getUserDisplayName(user?: OfflineRosterConnectedUser | null) {
  if (!user) {
    return '';
  }

  return (
    `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.handle || user.email || 'User'
  );
}

interface UseOfflineRosterCardControllerOptions {
  rows: OfflineRosterRow[];
  connectedUserCandidates?: OfflineRosterCandidateUser[];
  onCreate?: OfflineRosterCardProps['onCreate'];
  onImport?: OfflineRosterCardProps['onImport'];
  onConnect?: OfflineRosterCardProps['onConnect'];
  onEdit?: OfflineRosterCardProps['onEdit'];
  onDelete?: OfflineRosterCardProps['onDelete'];
  onSetParticipationStatus?: OfflineRosterCardProps['onSetParticipationStatus'];
  onToggleChannel?: OfflineRosterCardProps['onToggleChannel'];
}

export function useOfflineRosterCardController({
  rows,
  connectedUserCandidates = [],
  onCreate,
  onImport,
  onConnect,
  onEdit,
  onDelete,
  onSetParticipationStatus,
  onToggleChannel,
}: UseOfflineRosterCardControllerOptions) {
  const [manageOpen, setManageOpen] = useState(false);
  const [manageTab, setManageTab] = useState<'single' | 'csv'>('single');
  const [editRow, setEditRow] = useState<OfflineRosterRow | null>(null);
  const [connectRow, setConnectRow] = useState<OfflineRosterRow | null>(null);
  const [singleDraft, setSingleDraft] = useState<DraftRosterEntry>({
    firstName: '',
    lastName: '',
    reasonNotSignedUp: '',
  });
  const [editDraft, setEditDraft] = useState<DraftRosterEntry>({
    firstName: '',
    lastName: '',
    reasonNotSignedUp: '',
  });
  const [selectedConnectedUser, setSelectedConnectedUser] = useState<TypeaheadItem | null>(null);
  const [csvPreviewRows, setCsvPreviewRows] = useState<DraftRosterEntry[]>([]);
  const [csvFeedback, setCsvFeedback] = useState({ duplicates: 0, missingNames: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manageSubmitStatus, setManageSubmitStatus] =
    useState<OfflineRosterManageSubmitStatus>('idle');
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((left, right) => {
        if (left.isActiveUser !== right.isActiveUser) {
          return left.isActiveUser ? -1 : 1;
        }

        const lastNameCompare = left.lastName.localeCompare(right.lastName, undefined, {
          sensitivity: 'base',
        });
        if (lastNameCompare !== 0) {
          return lastNameCompare;
        }

        return left.firstName.localeCompare(right.firstName, undefined, {
          sensitivity: 'base',
        });
      }),
    [rows]
  );

  const existingOfflineKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of rows) {
      if (row.kind !== 'offline') {
        continue;
      }

      keys.add(
        normalizeDraftKey({
          firstName: row.firstName,
          lastName: row.lastName,
          reasonNotSignedUp: row.reasonNotSignedUp || '',
        })
      );
    }
    return keys;
  }, [rows]);

  const connectItems = useMemo(
    () =>
      toTypeaheadItems(
        connectedUserCandidates,
        'user',
        user => getUserDisplayName(user),
        user => (user.handle ? `@${user.handle}` : user.email),
        user => user.avatar,
        user => `/user/${user.id}`
      ),
    [connectedUserCandidates]
  );

  const showRolesColumn = useMemo(
    () =>
      rows.some(
        row => (row.roles && row.roles.length > 0) || row.canViewRights || row.canManageRoles
      ),
    [rows]
  );

  const showConnectedUserColumn = useMemo(
    () => rows.some(row => Boolean(row.connectedUser)),
    [rows]
  );

  const handleCloseManageDialog = (open: boolean) => {
    setManageOpen(open);
    if (!open) {
      setManageTab('single');
      setSingleDraft({ firstName: '', lastName: '', reasonNotSignedUp: '' });
      setCsvPreviewRows([]);
      setCsvFeedback({ duplicates: 0, missingNames: 0 });
      setManageSubmitStatus('idle');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const readCsvFile = async (file: File) => {
    const content = await file.text();
    const parsed = parseOfflineRosterCsv(content, existingOfflineKeys);
    setCsvPreviewRows(parsed.rows);
    setCsvFeedback({
      duplicates: parsed.skippedDuplicates,
      missingNames: parsed.skippedMissingNames,
    });
  };

  const handleCsvDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingCsv(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    await readCsvFile(file);
  };

  const handleCreateSingle = async () => {
    if (!onCreate || !singleDraft.firstName.trim() || !singleDraft.lastName.trim()) {
      return;
    }

    const correlationId = buildCorrelationId('offline-roster-single-add');
    logRosterClient('offline-roster-single-add', 'submit-started', {
      correlationId,
      firstName: singleDraft.firstName,
      lastName: singleDraft.lastName,
    });
    setIsSubmitting(true);
    setManageSubmitStatus('submitting-single');
    try {
      await onCreate(
        {
          firstName: singleDraft.firstName.trim(),
          lastName: singleDraft.lastName.trim(),
          reasonNotSignedUp: singleDraft.reasonNotSignedUp.trim(),
        },
        correlationId
      );
      logRosterClient('offline-roster-single-add', 'submit-confirmed', { correlationId });
      setManageSubmitStatus('success-single');
      await new Promise(resolve => globalThis.setTimeout(resolve, MANAGE_SUBMIT_SUCCESS_DELAY_MS));
      handleCloseManageDialog(false);
    } catch (error) {
      setManageSubmitStatus('idle');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportCsv = async () => {
    if (!onImport || csvPreviewRows.length === 0) {
      return;
    }

    const correlationId = buildCorrelationId('offline-roster-csv-import');
    logRosterClient('offline-roster-csv-import', 'submit-started', {
      correlationId,
      rowCount: csvPreviewRows.length,
    });
    setIsSubmitting(true);
    setManageSubmitStatus('submitting-csv');
    try {
      await onImport(csvPreviewRows, correlationId);
      logRosterClient('offline-roster-csv-import', 'submit-confirmed', {
        correlationId,
        rowCount: csvPreviewRows.length,
      });
      setManageSubmitStatus('success-csv');
      await new Promise(resolve => globalThis.setTimeout(resolve, MANAGE_SUBMIT_SUCCESS_DELAY_MS));
      handleCloseManageDialog(false);
    } catch (error) {
      setManageSubmitStatus('idle');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConnect = async () => {
    if (!connectRow || !selectedConnectedUser || !onConnect) {
      return;
    }

    const correlationId = buildCorrelationId('offline-roster-connect');
    logRosterClient('offline-roster-connect', 'submit-started', {
      correlationId,
      rowId: connectRow.id,
      connectedUserId: selectedConnectedUser.id,
    });
    setIsSubmitting(true);
    try {
      await onConnect(connectRow, selectedConnectedUser.id, correlationId);
      logRosterClient('offline-roster-connect', 'submit-confirmed', { correlationId });
      setConnectRow(null);
      setSelectedConnectedUser(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editRow || !onEdit || !editDraft.firstName.trim() || !editDraft.lastName.trim()) {
      return;
    }

    const correlationId = buildCorrelationId('offline-roster-edit');
    logRosterClient('offline-roster-edit', 'submit-started', {
      correlationId,
      rowId: editRow.id,
    });
    setIsSubmitting(true);
    try {
      await onEdit(
        editRow,
        {
          firstName: editDraft.firstName.trim(),
          lastName: editDraft.lastName.trim(),
          reasonNotSignedUp: editDraft.reasonNotSignedUp.trim(),
        },
        correlationId
      );
      logRosterClient('offline-roster-edit', 'submit-confirmed', { correlationId });
      setEditRow(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (row: OfflineRosterRow) => {
    if (!onDelete) {
      return;
    }

    const correlationId = buildCorrelationId('offline-roster-delete');
    logRosterClient('offline-roster-delete', 'submit-started', {
      correlationId,
      rowId: row.id,
    });
    await onDelete(row, correlationId);
    logRosterClient('offline-roster-delete', 'submit-confirmed', {
      correlationId,
      rowId: row.id,
    });
  };

  const handleSetParticipationStatus = async (
    row: OfflineRosterRow,
    nextStatus: 'listed' | 'confirmed'
  ) => {
    if (!onSetParticipationStatus) {
      return;
    }

    const flow =
      nextStatus === 'confirmed'
        ? 'offline-roster-confirm-participation'
        : 'offline-roster-withdraw-participation-confirmation';
    const correlationId = buildCorrelationId(flow);
    logRosterClient(flow, 'submit-started', {
      correlationId,
      rowId: row.id,
      nextStatus,
    });
    await onSetParticipationStatus(row, nextStatus, correlationId);
    logRosterClient(flow, 'submit-confirmed', {
      correlationId,
      rowId: row.id,
      nextStatus,
    });
  };

  const handleToggleChannel = async (row: OfflineRosterRow, nextChannel: 'online' | 'offline') => {
    if (!onToggleChannel) {
      return;
    }

    const correlationId = buildCorrelationId('offline-roster-toggle-channel');
    logRosterClient('offline-roster-toggle-channel', 'submit-started', {
      correlationId,
      rowId: row.id,
      nextChannel,
    });
    await onToggleChannel(row, nextChannel, correlationId);
    logRosterClient('offline-roster-toggle-channel', 'submit-confirmed', {
      correlationId,
      rowId: row.id,
      nextChannel,
    });
  };

  const openEditRow = (row: OfflineRosterRow) => {
    setEditRow(row);
    setEditDraft({
      firstName: row.firstName,
      lastName: row.lastName,
      reasonNotSignedUp: row.reasonNotSignedUp || '',
    });
  };

  return {
    manageOpen,
    setManageOpen,
    manageTab,
    setManageTab,
    editRow,
    setEditRow,
    connectRow,
    setConnectRow,
    singleDraft,
    setSingleDraft,
    editDraft,
    setEditDraft,
    selectedConnectedUser,
    setSelectedConnectedUser,
    csvPreviewRows,
    csvFeedback,
    isSubmitting,
    manageSubmitStatus,
    isDraggingCsv,
    setIsDraggingCsv,
    fileInputId,
    fileInputRef,
    sortedRows,
    connectItems,
    showRolesColumn,
    showConnectedUserColumn,
    handleCloseManageDialog,
    readCsvFile,
    handleCsvDrop,
    handleCreateSingle,
    handleImportCsv,
    handleConnect,
    handleSaveEdit,
    handleDelete,
    handleSetParticipationStatus,
    handleToggleChannel,
    openEditRow,
  };
}

export type OfflineRosterCardController = ReturnType<typeof useOfflineRosterCardController>;
