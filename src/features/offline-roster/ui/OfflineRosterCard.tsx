'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { ScrollArea } from '@/features/shared/ui/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { cn } from '@/features/shared/utils/utils';
import { UserTableCell } from '@/features/shared/ui/ui/user-table-cell';
import { RoleTag } from '@/features/groups/ui/RoleTag';
import type { ParticipationUserLike } from '@/features/shared/types/participation';
import { DataTable, type ColumnDef } from '@/features/shared/ui/data-table';
import { FormFieldShell, TextField } from '@/features/shared/ui/form';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { EntityBadge, StatusBadge } from '@/features/shared/ui/status';
import {
  ArrowUpDown,
  Check,
  CircleCheck,
  CircleX,
  Eye,
  Link2,
  Pencil,
  Trash2,
  Upload,
  UserRoundPlus,
  Users,
} from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export interface OfflineRosterConnectedUser {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  handle?: string | null;
  avatar?: string | null;
  email?: string | null;
}

export interface OfflineRosterGroupReference {
  id: string;
  name?: string | null;
}

export interface OfflineRosterRow {
  id: string;
  kind: 'active' | 'offline';
  effectiveMembershipId?: string | null;
  user?: ParticipationUserLike | null;
  firstName: string;
  lastName: string;
  isActiveUser: boolean;
  reasonNotSignedUp?: string | null;
  connectedUser?: OfflineRosterConnectedUser | null;
  roles?: readonly { id: string; name?: string | null }[] | null;
  partGroup?: OfflineRosterGroupReference | null;
  baseGroup?: OfflineRosterGroupReference | null;
  readOnlyIdentity?: boolean;
  canConnect?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canViewRights?: boolean;
  canManageRoles?: boolean;
  canConfirmParticipation?: boolean;
  canWithdrawParticipation?: boolean;
  canToggleChannel?: boolean;
  attendanceStatus?: 'listed' | 'confirmed' | null;
  participationChannel?: 'online' | 'offline' | null;
}

export type OfflineRosterCandidateUser = OfflineRosterConnectedUser;

interface DraftRosterEntry {
  firstName: string;
  lastName: string;
  reasonNotSignedUp: string;
}

interface ParsedCsvResult {
  rows: DraftRosterEntry[];
  skippedDuplicates: number;
  skippedMissingNames: number;
}

interface OfflineRosterCardProps {
  title: string;
  description: string;
  rows: OfflineRosterRow[];
  connectedUserCandidates?: OfflineRosterCandidateUser[];
  showManageButton?: boolean;
  showProvenanceColumns?: boolean;
  manageButtonLabel?: string;
  tableVariant?: 'default' | 'membership';
  fallbackRoleLabel?: string;
  manageDialogTitle: string;
  manageDialogDescription: string;
  emptyStateLabel?: string;
  onCreate?: (entry: DraftRosterEntry, correlationId: string) => Promise<unknown>;
  onImport?: (entries: DraftRosterEntry[], correlationId: string) => Promise<unknown>;
  onConnect?: (row: OfflineRosterRow, userId: string, correlationId: string) => Promise<unknown>;
  onEdit?: (
    row: OfflineRosterRow,
    entry: DraftRosterEntry,
    correlationId: string
  ) => Promise<unknown>;
  onDelete?: (row: OfflineRosterRow, correlationId: string) => Promise<unknown>;
  onOpenRightsDialog?: (row: OfflineRosterRow) => void;
  onOpenChangeRoleDialog?: (row: OfflineRosterRow) => void;
  onSetParticipationStatus?: (
    row: OfflineRosterRow,
    nextStatus: 'listed' | 'confirmed',
    correlationId: string
  ) => Promise<unknown>;
  onToggleChannel?: (
    row: OfflineRosterRow,
    nextChannel: 'online' | 'offline',
    correlationId: string
  ) => Promise<unknown>;
}

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

function getInitials(firstName?: string | null, lastName?: string | null) {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.trim().toUpperCase() || 'U';
}

function normalizeDraftKey(entry: DraftRosterEntry) {
  return `${entry.firstName.trim().toLowerCase()}|${entry.lastName.trim().toLowerCase()}|${entry.reasonNotSignedUp.trim().toLowerCase()}`;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values.map(value => value.replace(/^"|"$/g, '').trim());
}

function parseOfflineRosterCsv(content: string, existingKeys: Set<string>): ParsedCsvResult {
  const lines = content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], skippedDuplicates: 0, skippedMissingNames: 0 };
  }

  const firstLineColumns = parseCsvLine(lines[0]).map(column => column.toLowerCase());
  const hasHeader =
    firstLineColumns.includes('firstname') ||
    firstLineColumns.includes('first_name') ||
    firstLineColumns.includes('lastname') ||
    firstLineColumns.includes('last_name');

  const rows = hasHeader ? lines.slice(1) : lines;
  const seenKeys = new Set(existingKeys);
  const parsedRows: DraftRosterEntry[] = [];
  let skippedDuplicates = 0;
  let skippedMissingNames = 0;

  for (const line of rows) {
    const [rawFirstName = '', rawLastName = '', rawReason = ''] = parseCsvLine(line);
    const entry: DraftRosterEntry = {
      firstName: rawFirstName.trim(),
      lastName: rawLastName.trim(),
      reasonNotSignedUp: rawReason.trim(),
    };

    if (!entry.firstName || !entry.lastName) {
      skippedMissingNames += 1;
      continue;
    }

    const key = normalizeDraftKey(entry);
    if (seenKeys.has(key)) {
      skippedDuplicates += 1;
      continue;
    }

    seenKeys.add(key);
    parsedRows.push(entry);
  }

  return {
    rows: parsedRows,
    skippedDuplicates,
    skippedMissingNames,
  };
}

function ConnectedUserChip({ user }: { user: OfflineRosterConnectedUser }) {
  const displayName = getUserDisplayName(user);

  return (
    <EntityBadge asChild tone="info" className="h-auto gap-2 px-2 py-1 hover:opacity-90">
      <Link to="/user/$id" params={{ id: user.id }}>
        <Avatar className="h-5 w-5">
          <AvatarImage src={user.avatar ?? undefined} alt={displayName} />
          <AvatarFallback className="text-[10px]">
            {getInitials(user.first_name, user.last_name)}
          </AvatarFallback>
        </Avatar>
        <span>{displayName}</span>
      </Link>
    </EntityBadge>
  );
}

function ProvenanceTag({
  group,
  fallbackLabel,
}: {
  group?: OfflineRosterGroupReference | null;
  fallbackLabel?: string;
}) {
  if (!group?.id) {
    return <span className="text-muted-foreground">{fallbackLabel || '-'}</span>;
  }

  return (
    <EntityBadge asChild tone="accent" className="hover:opacity-90">
      <Link to="/group/$id" params={{ id: group.id }}>
        {group.name || fallbackLabel || translateText('generated.inline.0094_group_171a0606')}
      </Link>
    </EntityBadge>
  );
}

export function OfflineRosterCard({
  title,
  description,
  rows,
  connectedUserCandidates = [],
  showManageButton = false,
  showProvenanceColumns = false,
  manageButtonLabel = translateText('generated.inline.0132_manage_non_signed_up_users_a17fc54c'),
  tableVariant = 'default',
  fallbackRoleLabel = '-',
  manageDialogTitle,
  manageDialogDescription,
  emptyStateLabel = translateText(
    'generated.inline.0133_no_offline_or_hybrid_users_have_been_added_ye_b4634e1a'
  ),
  onCreate,
  onImport,
  onConnect,
  onEdit,
  onDelete,
  onOpenRightsDialog,
  onOpenChangeRoleDialog,
  onSetParticipationStatus,
  onToggleChannel,
}: OfflineRosterCardProps) {
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
  const [csvFeedback, setCsvFeedback] = useState<{ duplicates: number; missingNames: number }>({
    duplicates: 0,
    missingNames: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleCsvDrop = async (event: React.DragEvent<HTMLDivElement>) => {
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
      handleCloseManageDialog(false);
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
    try {
      await onImport(csvPreviewRows, correlationId);
      logRosterClient('offline-roster-csv-import', 'submit-confirmed', {
        correlationId,
        rowCount: csvPreviewRows.length,
      });
      handleCloseManageDialog(false);
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

  const renderReasonCell = (row: OfflineRosterRow) => (
    <div className="space-y-2">
      <span>{row.reasonNotSignedUp || '-'}</span>
      {row.attendanceStatus ? (
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={row.attendanceStatus}>
            {row.attendanceStatus === 'confirmed'
              ? translateText('generated.inline.0120_participation_confirmed_e2ee357b')
              : translateText('generated.inline.0121_participation_listed_84952d30')}
          </StatusBadge>
          {row.participationChannel ? (
            <StatusBadge status={row.participationChannel} tone="outline">
              {row.participationChannel === 'offline'
                ? translateText('generated.inline.0122_offline_channel_8775eb7b')
                : translateText('generated.inline.0123_online_channel_368ecb25')}
            </StatusBadge>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const renderRowActions = (row: OfflineRosterRow) => {
    const nextChannel = row.participationChannel === 'offline' ? 'online' : 'offline';

    return (
      <div className="flex flex-wrap justify-end gap-2">
        {row.canViewRights ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => onOpenRightsDialog?.(row)}>
            <Eye className="mr-2 h-4 w-4" />
            {translateText('generated.inline.0133_rights_db94ff6b')}
          </Button>
        ) : null}
        {row.canManageRoles ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onOpenChangeRoleDialog?.(row)}
          >
            <ArrowUpDown className="mr-2 h-4 w-4" />
            {translateText('generated.inline.0947_manage_roles_5f9b8531')}
          </Button>
        ) : null}
        {row.canConfirmParticipation ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void handleSetParticipationStatus(row, 'confirmed')}
          >
            <Check className="mr-2 h-4 w-4" />
            {translateText('generated.inline.0948_confirm_04a21221')}
          </Button>
        ) : null}
        {row.canWithdrawParticipation ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void handleSetParticipationStatus(row, 'listed')}
          >
            {translateText('generated.inline.0949_withdraw_confirmation_ed1f407d')}
          </Button>
        ) : null}
        {row.canToggleChannel ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void handleToggleChannel(row, nextChannel)}
          >
            {nextChannel === 'offline'
              ? translateText('generated.inline.0124_set_offline_8b45cb62')
              : translateText('generated.inline.0125_set_online_5ac7fe77')}
          </Button>
        ) : null}
        {row.canConnect ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setConnectRow(row)}>
            <Link2 className="mr-2 h-4 w-4" />
            {translateText('generated.inline.0950_connect_b65463cb')}
          </Button>
        ) : null}
        {row.canEdit ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => {
              setEditRow(row);
              setEditDraft({
                firstName: row.firstName,
                lastName: row.lastName,
                reasonNotSignedUp: row.reasonNotSignedUp || '',
              });
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ) : null}
        {row.canDelete ? (
          <Button type="button" size="icon" variant="ghost" onClick={() => void handleDelete(row)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    );
  };

  const renderConnectedUserCell = (row: OfflineRosterRow) =>
    row.connectedUser ? (
      <ConnectedUserChip user={row.connectedUser} />
    ) : (
      <span className="text-muted-foreground">-</span>
    );

  const renderRolesCell = (row: OfflineRosterRow, showFallbackTag: boolean) => (
    <div className="flex flex-wrap gap-2">
      {row.roles && row.roles.length > 0 ? (
        row.roles.map(role => (
          <RoleTag key={`${row.id}-${role.id}`} roleId={role.id} roleName={role.name || 'Role'} />
        ))
      ) : showFallbackTag ? (
        <RoleTag fallbackKey={`offline-roster-${row.id}`}>{fallbackRoleLabel}</RoleTag>
      ) : (
        <span className="text-muted-foreground">-</span>
      )}
    </div>
  );

  const membershipColumns: ColumnDef<OfflineRosterRow>[] = [
    {
      id: 'user',
      header: translateText('generated.inline.0090_user_9f8a2389'),
      cell: ({ row }) => (
        <UserTableCell
          user={row.original.user}
          displayName={[row.original.firstName, row.original.lastName].filter(Boolean).join(' ')}
        />
      ),
    },
    ...(showRolesColumn
      ? [
          {
            id: 'roles',
            header: translateText('generated.inline.0091_role_c3f104d1'),
            cell: ({ row }) => renderRolesCell(row.original, true),
          } satisfies ColumnDef<OfflineRosterRow>,
        ]
      : []),
    ...(showConnectedUserColumn
      ? [
          {
            id: 'connected-user',
            header: translateText('generated.inline.0951_connected_active_user_0aaf89ce'),
            cell: ({ row }) => renderConnectedUserCell(row.original),
          } satisfies ColumnDef<OfflineRosterRow>,
        ]
      : []),
    {
      id: 'reason',
      header: translateText('generated.inline.0952_reason_why_not_signed_up_3bd4bff9'),
      cell: ({ row }) => renderReasonCell(row.original),
    },
    ...(showProvenanceColumns
      ? [
          {
            id: 'part-group',
            header: translateText('generated.inline.0953_part_group_b6252576'),
            cell: ({ row }) => (
              <ProvenanceTag
                group={row.original.partGroup}
                fallbackLabel={row.original.partGroup?.name ?? undefined}
              />
            ),
          } satisfies ColumnDef<OfflineRosterRow>,
          {
            id: 'base-group',
            header: translateText('generated.inline.0954_base_group_6c9d0b40'),
            cell: ({ row }) => (
              <ProvenanceTag
                group={row.original.baseGroup}
                fallbackLabel={row.original.baseGroup?.name ?? undefined}
              />
            ),
          } satisfies ColumnDef<OfflineRosterRow>,
        ]
      : []),
    {
      id: 'actions',
      header: translateText('generated.inline.0093_actions_c3cd636a'),
      meta: {
        headerClassName: 'text-right',
        cellClassName: 'text-right',
      },
      cell: ({ row }) => renderRowActions(row.original),
    },
  ];

  const defaultColumns: ColumnDef<OfflineRosterRow>[] = [
    {
      id: 'active-user',
      header: translateText('generated.inline.0955_active_user_7bce0daf'),
      cell: ({ row }) =>
        row.original.isActiveUser ? (
          <StatusBadge status="active" tone="success">
            <CircleCheck className="mr-1 h-4 w-4" />
            {translateText('generated.inline.0958_yes_5397e058')}
          </StatusBadge>
        ) : (
          <StatusBadge status="inactive" tone="destructive">
            <CircleX className="mr-1 h-4 w-4" />
            {translateText('generated.inline.0609_no_816c52fd')}
          </StatusBadge>
        ),
    },
    {
      accessorKey: 'firstName',
      header: translateText('generated.inline.0956_firstname_cf23ba48'),
    },
    {
      accessorKey: 'lastName',
      header: translateText('generated.inline.0957_lastname_639860fb'),
    },
    {
      id: 'connected-user',
      header: translateText('generated.inline.0951_connected_active_user_0aaf89ce'),
      cell: ({ row }) => renderConnectedUserCell(row.original),
    },
    ...(showRolesColumn
      ? [
          {
            id: 'roles',
            header: translateText('generated.inline.0689_roles_47dcc27d'),
            cell: ({ row }) => renderRolesCell(row.original, false),
          } satisfies ColumnDef<OfflineRosterRow>,
        ]
      : []),
    {
      id: 'reason',
      header: translateText('generated.inline.0952_reason_why_not_signed_up_3bd4bff9'),
      cell: ({ row }) => renderReasonCell(row.original),
    },
    ...(showProvenanceColumns
      ? [
          {
            id: 'part-group',
            header: translateText('generated.inline.0953_part_group_b6252576'),
            cell: ({ row }) => (
              <ProvenanceTag
                group={row.original.partGroup}
                fallbackLabel={row.original.partGroup?.name ?? undefined}
              />
            ),
          } satisfies ColumnDef<OfflineRosterRow>,
          {
            id: 'base-group',
            header: translateText('generated.inline.0954_base_group_6c9d0b40'),
            cell: ({ row }) => (
              <ProvenanceTag
                group={row.original.baseGroup}
                fallbackLabel={row.original.baseGroup?.name ?? undefined}
              />
            ),
          } satisfies ColumnDef<OfflineRosterRow>,
        ]
      : []),
    {
      id: 'actions',
      header: translateText('generated.inline.0093_actions_c3cd636a'),
      meta: {
        headerClassName: 'text-right',
        cellClassName: 'text-right',
      },
      cell: ({ row }) => renderRowActions(row.original),
    },
  ];

  const csvPreviewColumns: ColumnDef<DraftRosterEntry>[] = [
    {
      accessorKey: 'firstName',
      header: translateText('generated.inline.0956_firstname_cf23ba48'),
    },
    {
      accessorKey: 'lastName',
      header: translateText('generated.inline.0957_lastname_639860fb'),
    },
    {
      accessorKey: 'reasonNotSignedUp',
      header: translateText('generated.inline.0952_reason_why_not_signed_up_3bd4bff9'),
      cell: ({ row }) => row.original.reasonNotSignedUp || '-',
    },
  ];

  return (
    <>
      <Card className="border-border/70 from-background to-muted/20 bg-gradient-to-b">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {title} ({rows.length})
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {showManageButton ? (
            <Button type="button" onClick={() => setManageOpen(true)}>
              <UserRoundPlus className="mr-2 h-4 w-4" />
              {manageButtonLabel}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <DataTable
            columns={tableVariant === 'membership' ? membershipColumns : defaultColumns}
            data={sortedRows}
            getRowId={row => row.id}
            enablePagination={false}
            emptyTitle={title}
            emptyDescription={emptyStateLabel}
          />
        </CardContent>
      </Card>

      <Dialog open={manageOpen} onOpenChange={handleCloseManageDialog}>
        <ScrollableDialogContent className="max-h-[90vh] max-w-4xl">
          <DialogHeader>
            <DialogTitle>{manageDialogTitle}</DialogTitle>
            <DialogDescription>{manageDialogDescription}</DialogDescription>
          </DialogHeader>
          <Tabs
            value={manageTab}
            onValueChange={value => setManageTab(value as 'single' | 'csv')}
            className="space-y-4"
          >
            <TabsList>
              <TabsTrigger value="single">
                {translateText('generated.inline.0959_einzeluser_9d0b4724')}
              </TabsTrigger>
              <TabsTrigger value="csv">
                {translateText('generated.inline.0960_csv_upload_7aa7415d')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="single" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  id="offline-single-first-name"
                  label={translateText('generated.inline.0956_firstname_cf23ba48')}
                  value={singleDraft.firstName}
                  onValueChange={value =>
                    setSingleDraft(current => ({ ...current, firstName: value }))
                  }
                />
                <TextField
                  id="offline-single-last-name"
                  label={translateText('generated.inline.0957_lastname_639860fb')}
                  value={singleDraft.lastName}
                  onValueChange={value =>
                    setSingleDraft(current => ({ ...current, lastName: value }))
                  }
                />
              </div>
              <TextField
                id="offline-single-reason"
                label={translateText('generated.inline.0952_reason_why_not_signed_up_3bd4bff9')}
                value={singleDraft.reasonNotSignedUp}
                onValueChange={value =>
                  setSingleDraft(current => ({
                    ...current,
                    reasonNotSignedUp: value,
                  }))
                }
                multiline
                rows={4}
              />
            </TabsContent>
            <TabsContent value="csv" className="space-y-4">
              <div
                className={cn(
                  'border-muted-foreground/30 rounded-xl border border-dashed p-6 text-center transition-colors',
                  isDraggingCsv && 'border-primary bg-primary/5'
                )}
                onDragEnter={event => {
                  event.preventDefault();
                  setIsDraggingCsv(true);
                }}
                onDragOver={event => event.preventDefault()}
                onDragLeave={event => {
                  event.preventDefault();
                  setIsDraggingCsv(false);
                }}
                onDrop={event => void handleCsvDrop(event)}
              >
                <Upload className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
                <p className="font-medium">
                  {translateText('generated.inline.0961_upload_csv_0b77a04d')}
                </p>
                <p className="text-muted-foreground text-sm">
                  {translateText(
                    'generated.inline.0962_drag_and_drop_a_csv_with_the_columns_firstnam_8d747f0d'
                  )}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {translateText('generated.inline.0963_choose_file_eb7eb7a8')}
                </Button>
                <input
                  id={fileInputId}
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void readCsvFile(file);
                    }
                  }}
                />
              </div>

              {(csvFeedback.duplicates > 0 || csvFeedback.missingNames > 0) && (
                <div className="text-muted-foreground flex flex-wrap gap-3 text-sm">
                  {csvFeedback.duplicates > 0 ? (
                    <span>
                      {csvFeedback.duplicates}
                      {translateText('generated.inline.0964_duplicate_rows_were_skipped_3d5f6530')}
                    </span>
                  ) : null}
                  {csvFeedback.missingNames > 0 ? (
                    <span>
                      {csvFeedback.missingNames}
                      {translateText(
                        'generated.inline.0965_rows_without_first_and_last_name_were_skipped_2fc1a545'
                      )}
                    </span>
                  ) : null}
                </div>
              )}

              {csvPreviewRows.length > 0 ? (
                <FormFieldShell label={translateText('generated.inline.0520_preview_f1fbb2b4')}>
                  {() => (
                    <ScrollArea className="h-[40vh] rounded-xl border">
                      <DataTable
                        columns={csvPreviewColumns}
                        data={csvPreviewRows}
                        getRowId={(row, index) => `${row.firstName}-${row.lastName}-${index}`}
                        enablePagination={false}
                        className="space-y-0"
                      />
                    </ScrollArea>
                  )}
                </FormFieldShell>
              ) : null}
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleCloseManageDialog(false)}>
              {translateText('generated.inline.0331_abbrechen_07af7cb3')}
            </Button>
            <Button
              type="button"
              disabled={
                isSubmitting ||
                (manageTab === 'single'
                  ? !singleDraft.firstName.trim() || !singleDraft.lastName.trim()
                  : csvPreviewRows.length === 0)
              }
              onClick={() =>
                manageTab === 'csv' ? void handleImportCsv() : void handleCreateSingle()
              }
            >
              {translateText('generated.inline.0966_hinzufuegen_38099f83')}
            </Button>
          </DialogFooter>
        </ScrollableDialogContent>
      </Dialog>

      <Dialog
        open={connectRow != null}
        onOpenChange={open => {
          if (!open) {
            setConnectRow(null);
            setSelectedConnectedUser(null);
          }
        }}
      >
        <ScrollableDialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {translateText('generated.inline.0967_connect_active_user_3b32e5de')}
            </DialogTitle>
            <DialogDescription>
              {translateText(
                'generated.inline.0968_search_for_an_active_platform_user_who_should_4ddfcc2a'
              )}
            </DialogDescription>
          </DialogHeader>
          <FormFieldShell label={translateText('generated.inline.0955_active_user_7bce0daf')}>
            {() => (
              <TypeaheadSearch
                items={connectItems}
                value={selectedConnectedUser?.id}
                onChange={item => setSelectedConnectedUser(item)}
                placeholder={translateText('generated.inline.0969_search_active_users_87482496')}
              />
            )}
          </FormFieldShell>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConnectRow(null);
                setSelectedConnectedUser(null);
              }}
            >
              {translateText('generated.inline.0065_cancel_77dfd213')}
            </Button>
            <Button
              type="button"
              disabled={!selectedConnectedUser || isSubmitting}
              onClick={() => void handleConnect()}
            >
              {translateText('generated.inline.0970_verknuepfen_c7a633a7')}
            </Button>
          </DialogFooter>
        </ScrollableDialogContent>
      </Dialog>

      <Dialog
        open={editRow != null}
        onOpenChange={open => {
          if (!open) {
            setEditRow(null);
          }
        }}
      >
        <ScrollableDialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {translateText('generated.inline.0971_edit_offline_user_be53ee65')}
            </DialogTitle>
            <DialogDescription>
              {translateText(
                'generated.inline.0972_adjust_the_roster_entry_details_for_this_offl_7fe298c6'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              id="offline-edit-first-name"
              label={translateText('generated.inline.0956_firstname_cf23ba48')}
              value={editDraft.firstName}
              onValueChange={value => setEditDraft(current => ({ ...current, firstName: value }))}
            />
            <TextField
              id="offline-edit-last-name"
              label={translateText('generated.inline.0957_lastname_639860fb')}
              value={editDraft.lastName}
              onValueChange={value => setEditDraft(current => ({ ...current, lastName: value }))}
            />
          </div>
          <TextField
            id="offline-edit-reason"
            label={translateText('generated.inline.0952_reason_why_not_signed_up_3bd4bff9')}
            rows={4}
            value={editDraft.reasonNotSignedUp}
            onValueChange={value =>
              setEditDraft(current => ({ ...current, reasonNotSignedUp: value }))
            }
            multiline
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditRow(null)}>
              {translateText('generated.inline.0065_cancel_77dfd213')}
            </Button>
            <Button type="button" disabled={isSubmitting} onClick={() => void handleSaveEdit()}>
              {translateText('generated.inline.0269_save_efc007a3')}
            </Button>
          </DialogFooter>
        </ScrollableDialogContent>
      </Dialog>
    </>
  );
}
