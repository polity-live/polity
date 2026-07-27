import { featureThemeClassName } from '@/features/shared/theme';
/**
 * Positions Table Component
 *
 * Displays and manages group positions with holders, elections, and history.
 */

import { format } from 'date-fns';
import { Calendar, Edit, History, Trash2, User, UserPlus, Vote } from 'lucide-react';
import { useState } from 'react';

import { useGroupRoles as useFacadeGroupRoles } from '@/zero/groups/useGroupState';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { type ColumnDef } from '@/features/shared/ui/data-table';
import { CountBadge, StatusBadge } from '@/features/shared/ui/status';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';

type PositionRowBase = ReturnType<typeof useFacadeGroupRoles>['roles'][number];

type PositionRow = PositionRowBase & {
  currentHolder?: {
    id: string;
    fullName?: string | null;
    handle?: string | null;
    imageURL?: string | null;
    source?: 'membership' | 'incumbent' | null;
  } | null;
};

interface PositionsTableProps {
  positions: PositionRow[];
  canManage: boolean;
  onEdit: (position: PositionRow) => void;
  onDelete: (positionId: string) => void;
  onAssignHolder: (position: PositionRow) => void;
  onRemoveHolder: (positionId: string) => void;
  onViewHistory: (position: PositionRow) => void;
  onCreateElection: (positionId: string) => void;
  addPositionButton?: React.ReactNode;
}
import { PositionsTableView } from './PositionsTableView';
export function PositionsTable({
  positions,
  canManage,
  onEdit,
  onDelete,
  onAssignHolder,
  onRemoveHolder,
  onViewHistory,
  onCreateElection,
  addPositionButton,
}: PositionsTableProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [removeHolderConfirmOpen, setRemoveHolderConfirmOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<PositionRow | null>(null);

  const handleDeleteClick = (position: PositionRow) => {
    setSelectedPosition(position);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedPosition) {
      onDelete(selectedPosition.id);
    }
    setDeleteConfirmOpen(false);
    setSelectedPosition(null);
  };

  const handleRemoveHolderClick = (position: PositionRow) => {
    setSelectedPosition(position);
    setRemoveHolderConfirmOpen(true);
  };

  const handleRemoveHolderConfirm = () => {
    if (selectedPosition) {
      onRemoveHolder(selectedPosition.id);
    }
    setRemoveHolderConfirmOpen(false);
    setSelectedPosition(null);
  };

  const getTermEndDate = (position: PositionRow) => {
    if (!position.first_term_start || !position.term) return null;
    const start = new Date(position.first_term_start);
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + Number(position.term));
    return end;
  };

  const isTermExpiring = (position: PositionRow) => {
    const termEnd = getTermEndDate(position);
    if (!termEnd) return false;
    const now = new Date();
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    return termEnd <= sixMonthsFromNow && termEnd >= now;
  };

  const isTermExpired = (position: PositionRow) => {
    const termEnd = getTermEndDate(position);
    if (!termEnd) return false;
    return termEnd < new Date();
  };

  const actionColumns: ColumnDef<PositionRow>[] = canManage
    ? [
        {
          id: 'actions',
          header: translateText('generated.inline.0093_actions_c3cd636a'),
          meta: {
            headerClassName: 'text-right',
            cellClassName: 'text-right',
          },
          cell: ({ row }) => {
            const position = row.original;
            const isElectedRole = position.assignment_mode === 'elected';

            return (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewHistory(position)}
                  title={translateText('generated.inline.0726_view_history_8bc3b1ed')}
                >
                  <History className="h-4 w-4" />
                </Button>
                {position.currentHolder ? (
                  position.currentHolder.source === 'incumbent' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveHolderClick(position)}
                      title={translateText('generated.inline.1076_remove_holder_af2745c3')}
                    >
                      <UserPlus
                        className={featureThemeClassName('positionPositionsTableWarningIcon')}
                      />
                    </Button>
                  ) : null
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isElectedRole}
                    onClick={() => onAssignHolder(position)}
                    title={
                      isElectedRole
                        ? translateText('common.accessibility.useElectionForElectedRoles')
                        : translateText('common.accessibility.assignHolder')
                    }
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCreateElection(position.id)}
                  title={translateText('generated.inline.0728_create_election_678ef240')}
                >
                  <Vote className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(position)}
                  title={translateText('generated.inline.1077_edit_position_90312b49')}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteClick(position)}
                  title={translateText('generated.inline.1078_delete_position_92ae3714')}
                >
                  <Trash2 className="text-destructive h-4 w-4" />
                </Button>
              </div>
            );
          },
        },
      ]
    : [];

  const columns: ColumnDef<PositionRow>[] = [
    {
      id: 'role',
      header: translateText('generated.inline.0091_role_c3f104d1'),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.title}</div>
          {row.original.description ? (
            <div className="text-muted-foreground text-sm">{row.original.description}</div>
          ) : null}
        </div>
      ),
    },
    {
      id: 'holder',
      header: translateText('generated.inline.1067_current_incumbent_6ee2d999'),
      cell: ({ row }) => {
        const holder = row.original.currentHolder;

        if (!holder) {
          return (
            <div className="text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="text-sm">
                {translateText('generated.inline.1070_vacant_1966f967')}
              </span>
            </div>
          );
        }

        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={holder.imageURL || undefined} />
              <AvatarFallback>{holder.fullName?.[0] || holder.handle?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <div className="text-sm font-medium">{holder.fullName || holder.handle}</div>
              {holder.handle ? (
                <div className="text-muted-foreground text-xs">@{holder.handle}</div>
              ) : null}
              {holder.source === 'membership' ? (
                <div className="text-muted-foreground text-xs">
                  {translateText(
                    'generated.inline.1069_assigned_through_active_membership_4a4709b9'
                  )}
                </div>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      id: 'term',
      header: translateText('generated.inline.1068_term_info_e9e7244e'),
      cell: ({ row }) => {
        const position = row.original;
        const termEnd = getTermEndDate(position);
        const expired = isTermExpired(position);
        const expiring = isTermExpiring(position);

        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm">
              <Calendar className="h-3 w-3" />
              <span>
                {position.term ?? '-'}
                {translateText('generated.inline.0135_year_4ff0b153')}
                {Number(position.term ?? 0) > 1 ? 's' : ''}
              </span>
            </div>
            {termEnd ? (
              <div className="flex flex-col gap-1">
                <div className="text-muted-foreground text-xs">
                  {translateText('generated.inline.1071_ends_06e9778f')}
                  {format(termEnd, 'MMM d, yyyy')}
                </div>
                {expired ? (
                  <StatusBadge status="expired" tone="destructive" className="w-fit">
                    {translateText('generated.inline.1072_expired_a689a999')}
                  </StatusBadge>
                ) : null}
                {expiring && !expired ? (
                  <StatusBadge status="expiring" tone="warning" className="w-fit">
                    {translateText('generated.inline.1073_expiring_soon_50b61e0c')}
                  </StatusBadge>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'elections',
      header: translateText('generated.inline.0852_elections_7213288b'),
      cell: ({ row }) => {
        const activeElections =
          row.original.elections?.filter(
            election => election.status === 'active' || election.status === 'pending'
          ) || [];

        if (activeElections.length === 0) {
          return (
            <span className="text-muted-foreground text-sm">
              {translateText('generated.inline.1075_no_active_elections_c0f7abb8')}
            </span>
          );
        }

        return (
          <CountBadge
            count={activeElections.length}
            label={translateText('generated.inline.1074_active_a733b809')}
            tone="warning"
          />
        );
      },
    },
    ...actionColumns,
  ];
  return (
    <PositionsTableView
      positions={positions}
      canManage={canManage}
      onEdit={onEdit}
      onDelete={onDelete}
      onAssignHolder={onAssignHolder}
      onRemoveHolder={onRemoveHolder}
      onViewHistory={onViewHistory}
      onCreateElection={onCreateElection}
      addPositionButton={addPositionButton}
      deleteConfirmOpen={deleteConfirmOpen}
      setDeleteConfirmOpen={setDeleteConfirmOpen}
      removeHolderConfirmOpen={removeHolderConfirmOpen}
      setRemoveHolderConfirmOpen={setRemoveHolderConfirmOpen}
      selectedPosition={selectedPosition}
      setSelectedPosition={setSelectedPosition}
      handleDeleteClick={handleDeleteClick}
      handleDeleteConfirm={handleDeleteConfirm}
      handleRemoveHolderClick={handleRemoveHolderClick}
      handleRemoveHolderConfirm={handleRemoveHolderConfirm}
      getTermEndDate={getTermEndDate}
      isTermExpiring={isTermExpiring}
      isTermExpired={isTermExpired}
      actionColumns={actionColumns}
      columns={columns}
    />
  );
}
