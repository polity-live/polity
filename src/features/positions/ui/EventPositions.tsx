import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { DataTable, type ColumnDef } from '@/features/shared/ui/data-table';
import { ChoiceField, ValidatedField } from '@/features/shared/ui/form';
import { CountBadge, StatusBadge } from '@/features/shared/ui/status';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import { DangerConfirmDialog, ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { Trash2, UserCheck, Plus, Edit2 } from 'lucide-react';
import { useState } from 'react';
import { useEventRoles } from '../hooks/useEventPositions';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export function EventPositions({ eventId }: { eventId: string }) {
  const { event, roles, dialogs, form, actions } = useEventRoles(eventId);
  const [pendingDeleteRoleId, setPendingDeleteRoleId] = useState<string | null>(null);

  const renderRoleFormFields = (idPrefix: string) => (
    <div className="space-y-4 py-4">
      <ValidatedField
        label={translateText('generated.inline.1038_role_title_b96976bb')}
        placeholder={translateText(
          'generated.inline.1039_e_g_session_chair_counting_committee_3f5b97dd'
        )}
        value={form.title}
        onValueChange={form.setTitle}
        required
      />

      <ValidatedField
        label={translateText('generated.inline.0130_description_optional_f1da5c02')}
        placeholder={translateText(
          'generated.inline.1040_describe_the_responsibilities_of_this_role_13d141c1'
        )}
        value={form.description}
        onValueChange={form.setDescription}
        multiline
        rows={3}
      />

      <ValidatedField
        label={translateText('generated.inline.1041_number_of_holders_994d4b41')}
        description={translateText(
          'generated.inline.1042_how_many_participants_can_hold_this_position_4ca1e969'
        )}
        type="number"
        min="1"
        placeholder="1"
        value={form.capacity}
        onValueChange={form.setCapacity}
      />

      <ChoiceField
        id={`${idPrefix}-create-election`}
        checked={form.createElection}
        onCheckedChange={form.setCreateElection}
        label={translateText(
          'generated.inline.1043_create_election_agenda_item_at_the_beginning__0526faed'
        )}
      />
    </div>
  );

  const pendingDeleteRole = roles.find(role => role.id === pendingDeleteRoleId) ?? null;

  type EventRoleRow = (typeof roles)[number];

  const roleColumns: ColumnDef<EventRoleRow>[] = [
    {
      accessorKey: 'title',
      header: translateText('generated.inline.0091_role_c3f104d1'),
      cell: ({ row }) => {
        const role = row.original;

        return (
          <div>
            <div className="font-medium">{role.title}</div>
            {role.description ? (
              <div className="text-muted-foreground line-clamp-1 text-sm">{role.description}</div>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'capacity',
      header: translateText('generated.inline.1050_capacity_45bd908d'),
      cell: ({ row }) => {
        const filledSlots = (row.original.holders || []).length;
        const totalSlots = 1;

        return <CountBadge count={`${filledSlots} / ${totalSlots}`} tone="outline" />;
      },
    },
    {
      id: 'holders',
      header: translateText('generated.inline.1051_current_holders_71f3c4c3'),
      cell: ({ row }) => {
        const holders = row.original.holders || [];

        if (holders.length === 0) {
          return (
            <span className="text-muted-foreground text-sm">
              {translateText('generated.inline.1053_no_holders_yet_40094d22')}
            </span>
          );
        }

        return (
          <div className="flex -space-x-2">
            {holders.slice(0, 3).map(holder => (
              <Avatar key={holder.id} className="border-background h-8 w-8 border-2">
                <AvatarImage
                  src={holder.user?.avatar ?? undefined}
                  alt={
                    [holder.user?.first_name, holder.user?.last_name].filter(Boolean).join(' ') ||
                    undefined
                  }
                />
                <AvatarFallback>
                  {holder.user?.first_name?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
            ))}
            {holders.length > 3 ? (
              <CountBadge
                count={`+${holders.length - 3}`}
                tone="neutral"
                className="border-background h-8 border-2"
              />
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'election',
      header: translateText('generated.inline.1052_election_217da2dc'),
      cell: () => {
        const hasElection = false;

        return hasElection ? (
          <StatusBadge status="election" tone="info">
            <UserCheck className="mr-1 h-3 w-3" />
            {translateText('generated.inline.1052_election_217da2dc')}
          </StatusBadge>
        ) : (
          <span className="text-muted-foreground text-sm">
            {translateText('generated.inline.1054_manual_4e836fdc')}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: translateText('generated.inline.0093_actions_c3cd636a'),
      meta: {
        headerClassName: 'text-right',
        cellClassName: 'text-right',
      },
      cell: ({ row }) => {
        const role = row.original;

        return (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => actions.openEdit(role)}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPendingDeleteRoleId(role.id)}>
              <Trash2 className="text-destructive h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">
          {translateText('generated.inline.1034_manage_event_roles_50c33e07')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {event?.title || translateText('generated.inline.0023_event_ad8919ac')}
          {translateText(
            'generated.inline.1035_create_and_manage_scoped_roles_for_this_event_591495d1'
          )}
        </p>
      </div>

      {/* Add Role Button */}
      <div className="mb-6 flex justify-end">
        <Dialog open={dialogs.add.open} onOpenChange={dialogs.add.setOpen}>
          <DialogTrigger asChild>
            <Button onClick={form.reset}>
              <Plus className="mr-2 h-4 w-4" />
              {translateText('generated.inline.0125_add_role_82d0afcc')}
            </Button>
          </DialogTrigger>
          <ScrollableDialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {translateText('generated.inline.1036_create_new_role_a195fa09')}
              </DialogTitle>
              <DialogDescription>
                {translateText(
                  'generated.inline.1037_create_a_scoped_role_for_this_event_e_g_sessi_073b1c46'
                )}
              </DialogDescription>
            </DialogHeader>

            {renderRoleFormFields('create')}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => dialogs.add.setOpen(false)}>
                {translateText('generated.inline.0065_cancel_77dfd213')}
              </Button>
              <Button type="button" onClick={actions.add}>
                {translateText('generated.inline.0132_create_role_5bea05a8')}
              </Button>
            </DialogFooter>
          </ScrollableDialogContent>
        </Dialog>
      </div>

      {/* Edit Role Dialog */}
      <Dialog open={dialogs.edit.open} onOpenChange={dialogs.edit.setOpen}>
        <ScrollableDialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{translateText('generated.inline.1044_edit_role_b075b676')}</DialogTitle>
            <DialogDescription>
              {translateText('generated.inline.1045_update_the_role_details_f8b0defc')}
            </DialogDescription>
          </DialogHeader>

          {renderRoleFormFields('edit')}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => dialogs.edit.setOpen(false)}>
              {translateText('generated.inline.0065_cancel_77dfd213')}
            </Button>
            <Button type="button" onClick={actions.edit}>
              {translateText('generated.inline.1046_save_changes_fa2984b3')}
            </Button>
          </DialogFooter>
        </ScrollableDialogContent>
      </Dialog>

      {/* Roles List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            {translateText('generated.inline.1047_event_roles_f6f34fc1')}
            {roles.length})
          </CardTitle>
          <CardDescription>
            {translateText(
              'generated.inline.1048_roles_for_this_event_with_their_holders_and_e_dbd572b9'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={roleColumns}
            data={roles}
            getRowId={role => role.id}
            enablePagination={false}
            emptyTitle={translateText('generated.inline.1047_event_roles_f6f34fc1')}
            emptyDescription={translateText(
              'generated.inline.1049_no_roles_created_yet_click_add_role_to_create_359b779d'
            )}
          />
        </CardContent>
      </Card>

      <DangerConfirmDialog
        open={Boolean(pendingDeleteRoleId)}
        onOpenChange={open => {
          if (!open) {
            setPendingDeleteRoleId(null);
          }
        }}
        title={translateText('generated.inline.1055_delete_role_af587987')}
        description={
          <>
            {translateText('generated.inline.1056_are_you_sure_you_want_to_delete_727effd6')}
            {pendingDeleteRole?.title}
            {translateText('generated.inline.1057_this_action_cannot_be_undone_03284dff')}
          </>
        }
        cancelLabel={translateText('generated.inline.0065_cancel_77dfd213')}
        confirmLabel={translateText('generated.inline.0537_delete_f6fdbe48')}
        onConfirm={() => {
          if (pendingDeleteRoleId) {
            actions.delete(pendingDeleteRoleId);
          }
          setPendingDeleteRoleId(null);
        }}
      />
    </div>
  );
}
