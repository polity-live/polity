'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Badge, badgeVariants } from '@/features/shared/ui/ui/badge';
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
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import { ScrollArea } from '@/features/shared/ui/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { Textarea } from '@/features/shared/ui/ui/textarea';
import { TypeaheadSearch } from '@/features/shared/ui/typeahead';
import { toTypeaheadItems } from '@/features/shared/ui/typeahead/toTypeaheadItems';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { cn } from '@/features/shared/utils/utils';
import { getTableTagSurfaceClassName } from '@/features/shared/ui/ui/table-tag';
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
    <Link
      to="/user/$id"
      params={{ id: user.id }}
      className={cn(
        badgeVariants({ variant: 'outline' }),
        getTableTagSurfaceClassName('user'),
        'inline-flex h-auto items-center gap-2 rounded-full px-2 py-1 hover:opacity-90'
      )}
    >
      <Avatar className="h-5 w-5">
        <AvatarImage src={user.avatar ?? undefined} alt={displayName} />
        <AvatarFallback className="text-[10px]">
          {getInitials(user.first_name, user.last_name)}
        </AvatarFallback>
      </Avatar>
      <span>{displayName}</span>
    </Link>
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
    <Link
      to="/group/$id"
      params={{ id: group.id }}
      className={cn(
        badgeVariants({ variant: 'outline' }),
        getTableTagSurfaceClassName('group'),
        'hover:opacity-90'
      )}
    >
      {group.name || fallbackLabel || 'Group'}
    </Link>
  );
}

export function OfflineRosterCard({
  title,
  description,
  rows,
  connectedUserCandidates = [],
  showManageButton = false,
  showProvenanceColumns = false,
  manageButtonLabel = 'Manage non signed up users',
  manageDialogTitle,
  manageDialogDescription,
  emptyStateLabel = 'No offline or hybrid users have been added yet.',
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
          {sortedRows.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">{emptyStateLabel}</p>
          ) : (
            <div className="border-border/70 overflow-x-auto rounded-2xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Active user</TableHead>
                    <TableHead>Firstname</TableHead>
                    <TableHead>Lastname</TableHead>
                    <TableHead>Connected Active User</TableHead>
                    {showRolesColumn ? <TableHead>Roles</TableHead> : null}
                    <TableHead>Reason why not signed up</TableHead>
                    {showProvenanceColumns ? <TableHead>Part group</TableHead> : null}
                    {showProvenanceColumns ? <TableHead>Base group</TableHead> : null}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map(row => {
                    const nextChannel =
                      row.participationChannel === 'offline' ? 'online' : 'offline';

                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          {row.isActiveUser ? (
                            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                              <CircleCheck className="mr-1 h-4 w-4" />
                              Yes
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <CircleX className="mr-1 h-4 w-4" />
                              No
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{row.firstName}</TableCell>
                        <TableCell>{row.lastName}</TableCell>
                        <TableCell>
                          {row.connectedUser ? (
                            <ConnectedUserChip user={row.connectedUser} />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        {showRolesColumn ? (
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              {row.roles && row.roles.length > 0 ? (
                                row.roles.map(role => (
                                  <Badge key={`${row.id}-${role.id}`} variant="outline">
                                    {role.name || 'Role'}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <div className="space-y-2">
                            <span>{row.reasonNotSignedUp || '-'}</span>
                            {row.attendanceStatus ? (
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary">
                                  {row.attendanceStatus === 'confirmed'
                                    ? 'Participation confirmed'
                                    : 'Participation listed'}
                                </Badge>
                                {row.participationChannel ? (
                                  <Badge variant="outline">
                                    {row.participationChannel === 'offline'
                                      ? 'Offline channel'
                                      : 'Online channel'}
                                  </Badge>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        {showProvenanceColumns ? (
                          <TableCell>
                            <ProvenanceTag
                              group={row.partGroup}
                              fallbackLabel={row.partGroup?.name ?? undefined}
                            />
                          </TableCell>
                        ) : null}
                        {showProvenanceColumns ? (
                          <TableCell>
                            <ProvenanceTag
                              group={row.baseGroup}
                              fallbackLabel={row.baseGroup?.name ?? undefined}
                            />
                          </TableCell>
                        ) : null}
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            {row.canViewRights ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => onOpenRightsDialog?.(row)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                Rights
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
                                Manage Roles
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
                                Confirm
                              </Button>
                            ) : null}
                            {row.canWithdrawParticipation ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void handleSetParticipationStatus(row, 'listed')}
                              >
                                Withdraw confirmation
                              </Button>
                            ) : null}
                            {row.canToggleChannel ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void handleToggleChannel(row, nextChannel)}
                              >
                                {nextChannel === 'offline' ? 'Set Offline' : 'Set Online'}
                              </Button>
                            ) : null}
                            {row.canConnect ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setConnectRow(row)}
                              >
                                <Link2 className="mr-2 h-4 w-4" />
                                Connect
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
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => void handleDelete(row)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={manageOpen} onOpenChange={handleCloseManageDialog}>
        <DialogContent className="max-h-[90vh] max-w-4xl">
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
              <TabsTrigger value="single">Einzeluser</TabsTrigger>
              <TabsTrigger value="csv">Csv upload</TabsTrigger>
            </TabsList>
            <TabsContent value="single" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="offline-single-first-name">Firstname</Label>
                  <Input
                    id="offline-single-first-name"
                    value={singleDraft.firstName}
                    onChange={event =>
                      setSingleDraft(current => ({ ...current, firstName: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="offline-single-last-name">Lastname</Label>
                  <Input
                    id="offline-single-last-name"
                    value={singleDraft.lastName}
                    onChange={event =>
                      setSingleDraft(current => ({ ...current, lastName: event.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="offline-single-reason">Reason why not signed up</Label>
                <Textarea
                  id="offline-single-reason"
                  value={singleDraft.reasonNotSignedUp}
                  onChange={event =>
                    setSingleDraft(current => ({
                      ...current,
                      reasonNotSignedUp: event.target.value,
                    }))
                  }
                  rows={4}
                />
              </div>
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
                <p className="font-medium">Upload CSV</p>
                <p className="text-muted-foreground text-sm">
                  Drag and drop a CSV with the columns Firstname, Lastname, Reason why not signed
                  up.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose file
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
                    <span>{csvFeedback.duplicates} duplicate rows were skipped.</span>
                  ) : null}
                  {csvFeedback.missingNames > 0 ? (
                    <span>
                      {csvFeedback.missingNames} rows without first and last name were skipped.
                    </span>
                  ) : null}
                </div>
              )}

              {csvPreviewRows.length > 0 ? (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <ScrollArea className="h-[40vh] rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Firstname</TableHead>
                          <TableHead>Lastname</TableHead>
                          <TableHead>Reason why not signed up</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvPreviewRows.map((row, index) => (
                          <TableRow key={`${row.firstName}-${row.lastName}-${index}`}>
                            <TableCell>{row.firstName}</TableCell>
                            <TableCell>{row.lastName}</TableCell>
                            <TableCell>{row.reasonNotSignedUp || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleCloseManageDialog(false)}>
              Abbrechen
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
              Hinzufuegen
            </Button>
          </DialogFooter>
        </DialogContent>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Connect active user</DialogTitle>
            <DialogDescription>
              Search for an active platform user who should be connected to this offline roster
              entry.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Active user</Label>
            <TypeaheadSearch
              items={connectItems}
              value={selectedConnectedUser?.id}
              onChange={item => setSelectedConnectedUser(item)}
              placeholder="Search active users..."
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConnectRow(null);
                setSelectedConnectedUser(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selectedConnectedUser || isSubmitting}
              onClick={() => void handleConnect()}
            >
              Verknuepfen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editRow != null}
        onOpenChange={open => {
          if (!open) {
            setEditRow(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit offline user</DialogTitle>
            <DialogDescription>
              Adjust the roster entry details for this offline user.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="offline-edit-first-name">Firstname</Label>
              <Input
                id="offline-edit-first-name"
                value={editDraft.firstName}
                onChange={event =>
                  setEditDraft(current => ({ ...current, firstName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offline-edit-last-name">Lastname</Label>
              <Input
                id="offline-edit-last-name"
                value={editDraft.lastName}
                onChange={event =>
                  setEditDraft(current => ({ ...current, lastName: event.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="offline-edit-reason">Reason why not signed up</Label>
            <Textarea
              id="offline-edit-reason"
              rows={4}
              value={editDraft.reasonNotSignedUp}
              onChange={event =>
                setEditDraft(current => ({ ...current, reasonNotSignedUp: event.target.value }))
              }
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={isSubmitting} onClick={() => void handleSaveEdit()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
