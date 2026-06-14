import { featureThemeClassName } from '@/features/shared/theme';
/**
 * Positions Table Component
 *
 * Displays and manages group positions with holders, elections, and history.
 */

import { Briefcase } from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { ConfirmDialog, DangerConfirmDialog } from '@/features/shared/ui/dialog';
import { DataTable } from '@/features/shared/ui/data-table';
import {
  Panel,
  PanelContent,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from '@/features/shared/ui/layout';
export interface PositionsTableViewProps {
  positions: any;
  canManage: any;
  onEdit: any;
  onDelete: any;
  onAssignHolder: any;
  onRemoveHolder: any;
  onViewHistory: any;
  onCreateElection: any;
  addPositionButton: any;
  deleteConfirmOpen: any;
  setDeleteConfirmOpen: any;
  removeHolderConfirmOpen: any;
  setRemoveHolderConfirmOpen: any;
  selectedPosition: any;
  setSelectedPosition: any;
  handleDeleteClick: any;
  handleDeleteConfirm: any;
  handleRemoveHolderClick: any;
  handleRemoveHolderConfirm: any;
  getTermEndDate: any;
  isTermExpiring: any;
  isTermExpired: any;
  actionColumns: any;
  columns: any;
}

export function PositionsTableView({
  positions,
  canManage,
  addPositionButton,
  deleteConfirmOpen,
  setDeleteConfirmOpen,
  removeHolderConfirmOpen,
  setRemoveHolderConfirmOpen,
  selectedPosition,
  handleDeleteConfirm,
  handleRemoveHolderConfirm,
  columns,
}: PositionsTableViewProps) {
  return (
    <>
      <Panel>
        <PanelHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <PanelTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                {translateText('generated.inline.1065_incumbents_256492e4')}
              </PanelTitle>
              <PanelDescription>
                {translateText(
                  'generated.inline.1066_manage_role_holders_fill_vacancies_and_track__692d43c1'
                )}
              </PanelDescription>
            </div>
            {canManage && addPositionButton ? addPositionButton : null}
          </div>
        </PanelHeader>
        <PanelContent>
          <DataTable
            columns={columns}
            data={positions}
            getRowId={(position: any) => position.id}
            enablePagination={false}
            emptyTitle={translateText(
              'generated.inline.1079_no_roles_are_ready_for_incumbent_tracking_yet_96f38b80'
            )}
          />
        </PanelContent>
      </Panel>

      <DangerConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={translateText('generated.inline.1080_delete_position_46102c79')}
        description={
          <>
            {translateText('generated.inline.1081_are_you_sure_you_want_to_delete_de36321b')}
            {selectedPosition?.title}
            {translateText('generated.inline.1082_this_action_cannot_be_undone_66ac3236')}
            {selectedPosition?.currentHolder ? (
              <span className={featureThemeClassName('positionPositionsTableWarningText')}>
                {translateText(
                  'generated.inline.1083_warning_this_position_currently_has_a_holder__e51c603a'
                )}
              </span>
            ) : null}
          </>
        }
        cancelLabel={translateText('generated.inline.0065_cancel_77dfd213')}
        confirmLabel={translateText('generated.inline.0537_delete_f6fdbe48')}
        onConfirm={handleDeleteConfirm}
      />

      <ConfirmDialog
        open={removeHolderConfirmOpen}
        onOpenChange={setRemoveHolderConfirmOpen}
        title={translateText('generated.inline.1084_remove_current_holder_839c0b5a')}
        description={
          <>
            {translateText('generated.inline.1085_are_you_sure_you_want_to_remove_39db6fb2')}{' '}
            {selectedPosition?.currentHolder?.fullName || selectedPosition?.currentHolder?.handle}{' '}
            {translateText('generated.inline.1086_from_5cf0eba6')}
            {selectedPosition?.title}
            {translateText(
              'generated.inline.1087_this_will_mark_the_position_as_vacant_and_rec_f27ecae5'
            )}
          </>
        }
        cancelLabel={translateText('generated.inline.0065_cancel_77dfd213')}
        confirmLabel={translateText('generated.inline.1076_remove_holder_af2745c3')}
        onConfirm={handleRemoveHolderConfirm}
      />
    </>
  );
}
