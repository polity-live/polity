import { Link } from '@tanstack/react-router';
import { format } from 'date-fns';
import { CalendarClock, History, PencilLine, Trash2, UserPlus, Users, Vote } from 'lucide-react';
import { getNextRoleElectionEvent } from '@/features/groups/logic/openAssignments';
import { formatRoleTermLabel } from '@/features/groups/logic/roleFormHelpers';
import { EventSelectCard } from '@/features/shared/ui/ui/entity-select-cards';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { Badge } from '@/features/shared/ui/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import { TableTag } from '@/features/shared/ui/ui/table-tag';
import { cn } from '@/features/shared/utils/utils';
import { RoleTag } from './RoleTag';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

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
  addRoleButton,
  scope = 'group',
}: RoleDetailsTableProps<TRole>) {
  const showTermColumn = scope === 'group';
  const rightsEntityType = scope === 'event' ? 'event' : 'group';
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {translateText('generated.inline.0717_role_details_99faf6f7')}
            </CardTitle>
            <CardDescription>
              {scope === 'event'
                ? translateText(
                    'generated.inline.0106_review_event_role_visibility_assignment_mode__9d3e73c1'
                  )
                : translateText(
                    'generated.inline.0107_review_role_visibility_assignment_mode_defaul_332a8a56'
                  )}
            </CardDescription>
          </div>
          {addRoleButton}
        </div>
      </CardHeader>
      <CardContent>
        {roles.length > 0 ? (
          <div className="border-border/70 overflow-x-auto rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">
                    {translateText('generated.inline.0091_role_c3f104d1')}
                  </TableHead>
                  <TableHead>
                    {translateText('generated.inline.0718_visibility_7d9ff4f0')}
                  </TableHead>
                  <TableHead>
                    {translateText('generated.inline.0621_assignment_e55df441')}
                  </TableHead>
                  <TableHead>{translateText('generated.inline.0719_defaults_428819bf')}</TableHead>
                  {showTermColumn ? (
                    <TableHead>
                      {translateText('generated.inline.0720_term_revote_17ae9b60')}
                    </TableHead>
                  ) : null}
                  <TableHead className="min-w-[280px] text-right">
                    {translateText('generated.inline.0721_manage_bf58d17e')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map(role => {
                  const hasActiveElection =
                    role.elections?.some(
                      election => election.status === 'active' || election.status === 'pending'
                    ) ?? false;
                  const nextElectionEvent = showTermColumn
                    ? getNextRoleElectionEvent(
                        role as Parameters<typeof getNextRoleElectionEvent>[0]
                      )
                    : null;
                  const nextRevote = role.scheduled_revote_date
                    ? format(new Date(role.scheduled_revote_date), 'MMM d, yyyy')
                    : null;
                  const holderManagedFromMembership = role.currentHolder?.source === 'membership';

                  return (
                    <TableRow key={role.id}>
                      <TableCell>
                        <div className="space-y-2">
                          <RoleTag
                            roleId={role.id}
                            roleName={role.title || 'Untitled role'}
                            className="text-sm"
                          />
                          {role.description ? (
                            <p className="text-muted-foreground max-w-lg text-sm">
                              {role.description}
                            </p>
                          ) : null}
                          {nextElectionEvent?.id ? (
                            <div className="max-w-sm">
                              <Link
                                to="/event/$id"
                                params={{ id: nextElectionEvent.id }}
                                className="block"
                              >
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
                          <div className="flex flex-wrap gap-2">
                            <TableTag entityType={rightsEntityType}>
                              {role.action_rights?.length ?? 0}
                              {translateText('generated.inline.0016_rights_1407cb23')}
                            </TableTag>
                            {showTermColumn && nextRevote ? (
                              <Badge className="border-transparent bg-gradient-to-r from-rose-100 via-orange-100 to-amber-100 text-amber-950">
                                {translateText('generated.inline.0624_next_revote_ec9a98d0')}
                                {nextRevote}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            'border-transparent',
                            getVisibilityBadgeClass(role.visibility)
                          )}
                        >
                          {role.visibility === 'authenticated'
                            ? translateText('generated.inline.0108_signed_in_d796e4a0')
                            : role.visibility ||
                              translateText('generated.inline.0063_public_dc5eb704')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            className={cn(
                              'border-transparent',
                              getAssignmentBadgeClass(role.assignment_mode)
                            )}
                          >
                            {role.assignment_mode === 'elected'
                              ? translateText('generated.inline.0109_elected_27d35d1d')
                              : translateText('generated.inline.0110_assigned_e24e824b')}
                          </Badge>
                          {hasActiveElection ? (
                            <Badge className="border-transparent bg-gradient-to-r from-sky-100 via-cyan-100 to-blue-100 text-sky-950">
                              {translateText('generated.inline.0722_election_active_8b7e89cf')}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {role.default_request_role ? (
                            <Badge className="border-transparent bg-gradient-to-r from-emerald-100 via-teal-100 to-cyan-100 text-emerald-950">
                              {translateText('generated.inline.0723_request_default_2d700a70')}
                            </Badge>
                          ) : null}
                          {role.default_invite_role ? (
                            <Badge className="border-transparent bg-gradient-to-r from-sky-100 via-cyan-100 to-blue-100 text-sky-950">
                              {translateText('generated.inline.0724_invite_default_595a7be7')}
                            </Badge>
                          ) : null}
                          {!role.default_request_role && !role.default_invite_role ? (
                            <span className="text-muted-foreground text-sm">
                              {translateText('generated.inline.0725_no_default_0cd213a3')}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      {showTermColumn ? (
                        <TableCell>
                          <div className="space-y-2 text-sm">
                            <Badge className="border-transparent bg-gradient-to-r from-violet-100 via-fuchsia-100 to-pink-100 text-violet-950">
                              {formatRoleTermLabel(
                                role as Parameters<typeof formatRoleTermLabel>[0]
                              )}
                            </Badge>
                            <div className="text-muted-foreground flex items-center gap-2">
                              <CalendarClock className="h-3.5 w-3.5" />
                              <span>
                                {role.first_term_start
                                  ? `Starts ${format(new Date(role.first_term_start), 'MMM d, yyyy')}`
                                  : translateText('generated.inline.0111_no_start_date_52c8423e')}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                      ) : null}
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          {onViewHistory ? (
                            <Button variant="outline" size="sm" onClick={() => onViewHistory(role)}>
                              <History className="mr-2 h-4 w-4" />
                              {translateText('generated.inline.0726_view_history_8bc3b1ed')}
                            </Button>
                          ) : null}
                          {role.assignment_mode === 'assigned' ? (
                            onAssignHolder ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={holderManagedFromMembership}
                                onClick={() => onAssignHolder(role)}
                                title={
                                  holderManagedFromMembership
                                    ? 'This incumbent is currently derived from membership roles.'
                                    : 'Assign or replace the incumbent for this role.'
                                }
                              >
                                <UserPlus className="mr-2 h-4 w-4" />
                                {translateText('generated.inline.0727_assign_24449284')}
                              </Button>
                            ) : null
                          ) : onCreateElection ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onCreateElection(role.id)}
                            >
                              <Vote className="mr-2 h-4 w-4" />
                              {translateText('generated.inline.0728_create_election_678ef240')}
                            </Button>
                          ) : null}
                          <Button variant="outline" size="sm" onClick={() => onEdit(role)}>
                            <PencilLine className="mr-2 h-4 w-4" />
                            {translateText('generated.inline.0729_edit_5301648d')}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onDelete(role.id)}>
                            <Trash2 className="text-destructive mr-2 h-4 w-4" />
                            {translateText('generated.inline.0537_delete_f6fdbe48')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <Users className="text-muted-foreground/50 mx-auto h-12 w-12" />
            <p className="text-muted-foreground mt-4">
              {translateText(
                'generated.inline.0730_no_roles_are_ready_for_detailed_management_ye_9b3fe260'
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getAssignmentBadgeClass(mode: string | null | undefined) {
  return mode === 'elected'
    ? 'bg-gradient-to-r from-sky-100 via-cyan-100 to-blue-100 text-sky-950'
    : 'bg-gradient-to-r from-amber-100 via-orange-100 to-rose-100 text-amber-950';
}

function getVisibilityBadgeClass(visibility: string | null | undefined) {
  if (visibility === 'private') {
    return 'bg-gradient-to-r from-slate-200 via-stone-200 to-zinc-200 text-slate-900';
  }

  if (visibility === 'authenticated') {
    return 'bg-gradient-to-r from-emerald-100 via-teal-100 to-cyan-100 text-emerald-950';
  }

  return 'bg-gradient-to-r from-lime-100 via-emerald-100 to-green-100 text-emerald-950';
}
