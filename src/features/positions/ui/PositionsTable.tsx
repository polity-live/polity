/**
 * Positions Table Component
 *
 * Displays and manages group positions with holders, elections, and history.
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Badge } from '@/features/shared/ui/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/features/shared/ui/ui/alert-dialog';
import { Briefcase, Edit, Trash2, UserPlus, History, Vote, Calendar, User } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';

import { useGroupRoles as useFacadeGroupRoles } from '@/zero/groups/useGroupState';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

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

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                {translateText('generated.inline.1065_incumbents_256492e4')}
              </CardTitle>
              <CardDescription>
                {translateText(
                  'generated.inline.1066_manage_role_holders_fill_vacancies_and_track__692d43c1'
                )}
              </CardDescription>
            </div>
            {canManage && addPositionButton ? addPositionButton : null}
          </div>
        </CardHeader>
        <CardContent>
          {positions && positions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{translateText('generated.inline.0091_role_c3f104d1')}</TableHead>
                    <TableHead>
                      {translateText('generated.inline.1067_current_incumbent_6ee2d999')}
                    </TableHead>
                    <TableHead>
                      {translateText('generated.inline.1068_term_info_e9e7244e')}
                    </TableHead>
                    <TableHead>
                      {translateText('generated.inline.0852_elections_7213288b')}
                    </TableHead>
                    {canManage && (
                      <TableHead className="text-right">
                        {translateText('generated.inline.0093_actions_c3cd636a')}
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map(position => {
                    const termEnd = getTermEndDate(position);
                    const isExpiring = isTermExpiring(position);
                    const isExpired = isTermExpired(position);
                    const isElectedRole = position.assignment_mode === 'elected';
                    const activeElections =
                      position.elections?.filter(
                        e => e.status === 'active' || e.status === 'pending'
                      ) || [];

                    return (
                      <TableRow key={position.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{position.title}</div>
                            {position.description && (
                              <div className="text-muted-foreground text-sm">
                                {position.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {position.currentHolder ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={position.currentHolder.imageURL || undefined} />
                                <AvatarFallback>
                                  {position.currentHolder.fullName?.[0] ||
                                    position.currentHolder.handle?.[0] ||
                                    'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="text-sm font-medium">
                                  {position.currentHolder.fullName || position.currentHolder.handle}
                                </div>
                                {position.currentHolder.handle && (
                                  <div className="text-muted-foreground text-xs">
                                    @{position.currentHolder.handle}
                                  </div>
                                )}
                                {position.currentHolder.source === 'membership' && (
                                  <div className="text-muted-foreground text-xs">
                                    {translateText(
                                      'generated.inline.1069_assigned_through_active_membership_4a4709b9'
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-muted-foreground flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <span className="text-sm">
                                {translateText('generated.inline.1070_vacant_1966f967')}
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3" />
                              <span>
                                {position.term ?? '—'}
                                {translateText('generated.inline.0135_year_4ff0b153')}
                                {Number(position.term ?? 0) > 1 ? 's' : ''}
                              </span>
                            </div>
                            {termEnd && (
                              <div className="flex flex-col gap-1">
                                <div className="text-muted-foreground text-xs">
                                  {translateText('generated.inline.1071_ends_06e9778f')}
                                  {format(termEnd, 'MMM d, yyyy')}
                                </div>
                                {isExpired && (
                                  <Badge variant="destructive" className="w-fit">
                                    {translateText('generated.inline.1072_expired_a689a999')}
                                  </Badge>
                                )}
                                {isExpiring && !isExpired && (
                                  <Badge
                                    variant="outline"
                                    className="w-fit border-orange-500 text-orange-500"
                                  >
                                    {translateText('generated.inline.1073_expiring_soon_50b61e0c')}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {activeElections.length > 0 ? (
                              <Badge variant="secondary" className="gap-1">
                                <Vote className="h-3 w-3" />
                                {activeElections.length}
                                {translateText('generated.inline.1074_active_a733b809')}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                {translateText(
                                  'generated.inline.1075_no_active_elections_c0f7abb8'
                                )}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
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
                                    title={translateText(
                                      'generated.inline.1076_remove_holder_af2745c3'
                                    )}
                                  >
                                    <UserPlus className="h-4 w-4 text-orange-500" />
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
                                      ? 'Use an election to fill elected roles'
                                      : 'Assign Holder'
                                  }
                                >
                                  <UserPlus className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onCreateElection(position.id)}
                                title={translateText(
                                  'generated.inline.0728_create_election_678ef240'
                                )}
                              >
                                <Vote className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onEdit(position)}
                                title={translateText(
                                  'generated.inline.1077_edit_position_90312b49'
                                )}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(position)}
                                title={translateText(
                                  'generated.inline.1078_delete_position_92ae3714'
                                )}
                              >
                                <Trash2 className="text-destructive h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <Briefcase className="text-muted-foreground/50 mx-auto h-12 w-12" />
              <p className="text-muted-foreground mt-4">
                {translateText(
                  'generated.inline.1079_no_roles_are_ready_for_incumbent_tracking_yet_96f38b80'
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Position Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {translateText('generated.inline.1080_delete_position_46102c79')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {translateText('generated.inline.1081_are_you_sure_you_want_to_delete_de36321b')}
              {selectedPosition?.title}
              {translateText('generated.inline.1082_this_action_cannot_be_undone_66ac3236')}
              {selectedPosition?.currentHolder && (
                <span className="mt-2 block font-semibold text-orange-600">
                  {translateText(
                    'generated.inline.1083_warning_this_position_currently_has_a_holder__e51c603a'
                  )}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {translateText('generated.inline.0065_cancel_77dfd213')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground"
            >
              {translateText('generated.inline.0537_delete_f6fdbe48')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Holder Confirmation */}
      <AlertDialog open={removeHolderConfirmOpen} onOpenChange={setRemoveHolderConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {translateText('generated.inline.1084_remove_current_holder_839c0b5a')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {translateText('generated.inline.1085_are_you_sure_you_want_to_remove_39db6fb2')}{' '}
              {selectedPosition?.currentHolder?.fullName || selectedPosition?.currentHolder?.handle}{' '}
              {translateText('generated.inline.1086_from_5cf0eba6')}
              {selectedPosition?.title}
              {translateText(
                'generated.inline.1087_this_will_mark_the_position_as_vacant_and_rec_f27ecae5'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {translateText('generated.inline.0065_cancel_77dfd213')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveHolderConfirm}>
              {translateText('generated.inline.1076_remove_holder_af2745c3')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
