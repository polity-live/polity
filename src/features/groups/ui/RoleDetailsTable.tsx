import { Link } from '@tanstack/react-router';
import { format } from 'date-fns';
import { CalendarClock, History, PencilLine, Trash2, UserPlus, Users, Vote } from 'lucide-react';

import { getNextRoleElectionEvent } from '@/features/groups/logic/openAssignments';
import { formatRoleTermLabel } from '@/features/groups/logic/roleFormHelpers';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { DataTable, TableActionIconButton, type ColumnDef } from '@/features/shared/ui/data-table';
import { CountBadge, PhaseBadge, StatusBadge, VisibilityBadge } from '@/features/shared/ui/status';
import { EventSelectCard } from '@/features/shared/ui/typeahead';
import { RoleTag } from './RoleTag';

interface RoleRow {
  id: string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  visibility?: string | null;
  assignment_mode?: string | null;
  default_request_role?: boolean | null;
  default_invite_role?: boolean | null;
  scheduled_revote_date?: number | null;
  first_term_start?: number | null;
  is_recurring?: boolean | null;
  recurrence_rule?: string | null;
  recurrence_interval?: number | null;
  currentHolder?: { source?: string | null } | null;
  action_rights?: readonly { resource?: string | null; action?: string | null }[] | null;
  elections?:
    | readonly {
        status?: string | null;
        agenda_item?: {
          event?: {
            id?: string | null;
            title?: string | null;
            start_date?: number | null;
            group?: { id?: string | null; name?: string | null } | null;
          } | null;
        } | null;
      }[]
    | null;
}

interface RoleDetailsTableProps<TRole extends RoleRow> {
  roles: TRole[];
  onEdit: (role: TRole) => void;
  onDelete: (roleId: string) => void;
  onAssignHolder?: (role: TRole) => void;
  onViewHistory?: (role: TRole) => void;
  onCreateElection?: (roleId: string) => void;
  onOpenElectionAssignment?: (roleId: string) => void;
  addRoleButton?: React.ReactNode;
  scope?: 'group' | 'event';
}

export function RoleDetailsTable<TRole extends RoleRow>({
  roles,
  onEdit,
  onDelete,
  onAssignHolder,
  onViewHistory,
  onCreateElection,
  onOpenElectionAssignment,
  addRoleButton,
  scope = 'group',
}: RoleDetailsTableProps<TRole>) {
  const showTermColumn = scope === 'group';
  const termColumns: ColumnDef<TRole>[] = showTermColumn
    ? [
        {
          id: 'term',
          header: translateText('generated.inline.0720_term_revote_17ae9b60'),
          cell: ({ row }) => {
            const role = row.original;
            const nextRevote = role.scheduled_revote_date
              ? format(new Date(role.scheduled_revote_date), 'MMM d, yyyy')
              : null;

            return (
              <div className="space-y-2 text-sm">
                <PhaseBadge value="term" tone="accent">
                  {formatRoleTermLabel(role as Parameters<typeof formatRoleTermLabel>[0])}
                </PhaseBadge>
                {nextRevote ? (
                  <PhaseBadge value="scheduled" tone="warning">
                    {translateText('generated.inline.0624_next_revote_ec9a98d0')}
                    {nextRevote}
                  </PhaseBadge>
                ) : null}
                <div className="text-muted-foreground flex items-center gap-2">
                  <CalendarClock className="h-3.5 w-3.5" />
                  <span>
                    {role.first_term_start
                      ? `Starts ${format(new Date(role.first_term_start), 'MMM d, yyyy')}`
                      : translateText('generated.inline.0111_no_start_date_52c8423e')}
                  </span>
                </div>
              </div>
            );
          },
        },
      ]
    : [];

  const columns: ColumnDef<TRole>[] = [
    {
      id: 'role',
      header: translateText('generated.inline.0091_role_c3f104d1'),
      meta: {
        className: 'min-w-[220px]',
      },
      cell: ({ row }) => {
        const role = row.original;
        const nextElectionEvent = showTermColumn
          ? getNextRoleElectionEvent(role as Parameters<typeof getNextRoleElectionEvent>[0])
          : null;

        return (
          <div className="space-y-2">
            <RoleTag
              roleId={role.id}
              roleName={role.title || 'Untitled role'}
              className="text-sm"
            />
            {role.description ? (
              <p className="text-muted-foreground max-w-lg text-sm">{role.description}</p>
            ) : null}
            {nextElectionEvent?.id ? (
              <div className="max-w-sm">
                <Link to="/event/$id" params={{ id: nextElectionEvent.id }} className="block">
                  <EventSelectCard
                    event={{
                      title: nextElectionEvent.title,
                      startDate: nextElectionEvent.start_date,
                      group: nextElectionEvent.group,
                    }}
                  />
                </Link>
              </div>
            ) : null}
            <CountBadge
              count={role.action_rights?.length ?? 0}
              label={translateText('generated.inline.0016_rights_1407cb23')}
            />
          </div>
        );
      },
    },
    {
      id: 'visibility',
      header: translateText('generated.inline.0718_visibility_7d9ff4f0'),
      cell: ({ row }) => (
        <VisibilityBadge value={row.original.visibility}>
          {row.original.visibility === 'authenticated'
            ? translateText('generated.inline.0108_signed_in_d796e4a0')
            : row.original.visibility || translateText('generated.inline.0063_public_dc5eb704')}
        </VisibilityBadge>
      ),
    },
    {
      id: 'assignment',
      header: translateText('generated.inline.0621_assignment_e55df441'),
      cell: ({ row }) => {
        const role = row.original;
        const hasActiveElection =
          role.elections?.some(
            election => election.status === 'active' || election.status === 'pending'
          ) ?? false;

        return (
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              status={role.assignment_mode}
              tone={role.assignment_mode === 'elected' ? 'info' : 'warning'}
            >
              {role.assignment_mode === 'elected'
                ? translateText('generated.inline.0109_elected_27d35d1d')
                : translateText('generated.inline.0110_assigned_e24e824b')}
            </StatusBadge>
            {hasActiveElection ? (
              <StatusBadge status="active">
                {translateText('generated.inline.0722_election_active_8b7e89cf')}
              </StatusBadge>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'defaults',
      header: translateText('generated.inline.0719_defaults_428819bf'),
      cell: ({ row }) => {
        const role = row.original;

        return (
          <div className="flex flex-wrap gap-2">
            {role.default_request_role ? (
              <StatusBadge status="active">
                {translateText('generated.inline.0723_request_default_2d700a70')}
              </StatusBadge>
            ) : null}
            {role.default_invite_role ? (
              <StatusBadge status="invited" tone="info">
                {translateText('generated.inline.0724_invite_default_595a7be7')}
              </StatusBadge>
            ) : null}
            {!role.default_request_role && !role.default_invite_role ? (
              <span className="text-muted-foreground text-sm">
                {translateText('generated.inline.0725_no_default_0cd213a3')}
              </span>
            ) : null}
          </div>
        );
      },
    },
    ...termColumns,
    {
      id: 'manage',
      header: translateText('generated.inline.0721_manage_bf58d17e'),
      meta: {
        className: 'min-w-[280px]',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
      },
      cell: ({ row }) => {
        const role = row.original;
        const holderManagedFromMembership = role.currentHolder?.source === 'membership';
        const viewHistoryLabel = translateText('generated.inline.0726_view_history_8bc3b1ed');
        const assignLabel = translateText('generated.inline.0727_assign_24449284');
        const createElectionLabel = translateText('generated.inline.0728_create_election_678ef240');
        const editLabel = translateText('generated.inline.0729_edit_5301648d');
        const deleteLabel = translateText('generated.inline.0537_delete_f6fdbe48');
        const electionAction = scope === 'group' ? onOpenElectionAssignment : onCreateElection;

        return (
          <div className="flex flex-wrap justify-end gap-2">
            {onViewHistory ? (
              <TableActionIconButton
                label={viewHistoryLabel}
                icon={<History className="h-4 w-4" />}
                variant="outline"
                onClick={() => onViewHistory(role)}
              />
            ) : null}
            {role.assignment_mode === 'assigned' ? (
              onAssignHolder ? (
                <TableActionIconButton
                  label={assignLabel}
                  icon={<UserPlus className="h-4 w-4" />}
                  variant="outline"
                  disabled={holderManagedFromMembership}
                  onClick={() => onAssignHolder(role)}
                  tooltip={
                    holderManagedFromMembership
                      ? 'This incumbent is currently derived from membership roles.'
                      : assignLabel
                  }
                />
              ) : null
            ) : electionAction ? (
              <TableActionIconButton
                label={createElectionLabel}
                icon={<Vote className="h-4 w-4" />}
                variant="outline"
                onClick={() => electionAction(role.id)}
              />
            ) : null}
            <TableActionIconButton
              label={editLabel}
              icon={<PencilLine className="h-4 w-4" />}
              variant="outline"
              onClick={() => onEdit(role)}
            />
            <TableActionIconButton
              label={deleteLabel}
              icon={<Trash2 className="h-4 w-4" />}
              destructive
              onClick={() => onDelete(role.id)}
            />
          </div>
        );
      },
    },
  ];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-4 px-3 sm:px-4">
        <div className="space-y-1.5">
          <h2 className="flex items-center gap-2 text-base leading-none font-semibold">
            <Users className="h-5 w-5" />
            {translateText('generated.inline.0717_role_details_99faf6f7')}
          </h2>
          <p className="text-muted-foreground text-sm">
            {scope === 'event'
              ? translateText(
                  'generated.inline.0106_review_event_role_visibility_assignment_mode__9d3e73c1'
                )
              : translateText(
                  'generated.inline.0107_review_role_visibility_assignment_mode_defaul_332a8a56'
                )}
          </p>
        </div>
        {addRoleButton}
      </div>
      <DataTable
        columns={columns}
        data={roles}
        getRowId={role => role.id}
        enablePagination={false}
        emptyTitle={translateText(
          'generated.inline.0730_no_roles_are_ready_for_detailed_management_ye_9b3fe260'
        )}
      />
    </section>
  );
}
