import { Button } from '@/features/shared/ui/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { type ColumnDef } from '@/features/shared/ui/data-table';
import { ChoiceField, ValidatedField } from '@/features/shared/ui/form';
import { CountBadge, StatusBadge } from '@/features/shared/ui/status';
import { Trash2, UserCheck, Edit2 } from 'lucide-react';
import { useState } from 'react';
import { useEventRoles } from '../hooks/useEventPositions';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { EventPositionsView } from './EventPositionsView';
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
    <EventPositionsView
      eventId={eventId}
      event={event}
      roles={roles}
      dialogs={dialogs}
      form={form}
      actions={actions}
      pendingDeleteRoleId={pendingDeleteRoleId}
      setPendingDeleteRoleId={setPendingDeleteRoleId}
      renderRoleFormFields={renderRoleFormFields}
      pendingDeleteRole={pendingDeleteRole}
      roleColumns={roleColumns}
    />
  );
}
