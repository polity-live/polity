import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { DataTable } from '@/features/shared/ui/data-table';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import { DangerConfirmDialog, ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { UserCheck, Plus } from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
export interface EventPositionsViewProps {
  eventId: any;
  event: any;
  roles: any;
  dialogs: any;
  form: any;
  actions: any;
  pendingDeleteRoleId: any;
  setPendingDeleteRoleId: any;
  renderRoleFormFields: any;
  pendingDeleteRole: any;
  roleColumns: any;
}

export function EventPositionsView({
  event,
  roles,
  dialogs,
  form,
  actions,
  pendingDeleteRoleId,
  setPendingDeleteRoleId,
  renderRoleFormFields,
  pendingDeleteRole,
  roleColumns,
}: EventPositionsViewProps) {
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
            getRowId={(role: any) => role.id}
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
