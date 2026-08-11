import { AddRoleDialog } from '@/features/groups/ui/AddRoleDialog';
import { RoleDetailsTable } from '@/features/groups/ui/RoleDetailsTable';
import { RolesPermissionsTable } from '@/features/groups/ui/RolesPermissionsTable';
import { emptyRoleEditorForm } from '@/features/groups/logic/roleFormHelpers';
import { EVENT_ACTION_RIGHTS } from '@/zero/rbac/constants';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { SectionSkeleton } from '@/features/shared/ui/feedback';
export interface EventRolesViewProps {
  eventId: any;
  event: any;
  roles: any;
  accessRoles: any;
  isLoading: any;
  addRoleOpen: any;
  setAddRoleOpen: any;
  newRoleForm: any;
  setNewRoleForm: any;
  editRoleOpen: any;
  setEditRoleOpen: any;
  editRoleForm: any;
  setEditRoleForm: any;
  editingRole: any;
  addRole: any;
  openEditRole: any;
  saveEditedRole: any;
  removeRole: any;
  togglePermission: any;
  reorderRoles: any;
  createElectionForRole: any;
  getPermissionDisabledReason: any;
}

export function EventRolesView({
  event,
  roles,
  accessRoles,
  isLoading,
  addRoleOpen,
  setAddRoleOpen,
  newRoleForm,
  setNewRoleForm,
  editRoleOpen,
  setEditRoleOpen,
  editRoleForm,
  setEditRoleForm,
  editingRole,
  addRole,
  openEditRole,
  saveEditedRole,
  removeRole,
  togglePermission,
  reorderRoles,
  createElectionForRole,
  getPermissionDisabledReason,
}: EventRolesViewProps) {
  if (isLoading) {
    return <SectionSkeleton rows={4} />;
  }

  return (
    <>
      <RoleDetailsTable
        roles={roles}
        onEdit={openEditRole}
        onDelete={roleId => void removeRole({ id: roleId })}
        onCreateElection={roleId => void createElectionForRole(roleId)}
        addRoleButton={
          <AddRoleDialog
            data-action-id="roles.event-role.add.submit"
            isOpen={addRoleOpen}
            onOpenChange={open => {
              setAddRoleOpen(open);
              if (!open) {
                setNewRoleForm(emptyRoleEditorForm());
              }
            }}
            form={newRoleForm}
            onFormChange={patch => setNewRoleForm((current: any) => ({ ...current, ...patch }))}
            onSubmit={() => void addRole()}
            scope="event"
            eventType={event?.event_type ?? null}
            title={translateText('generated.inline.1102_add_event_role_f0d02170')}
            description={translateText(
              'generated.inline.1103_create_an_event_role_with_the_same_defaults_a_d1110ed5'
            )}
            submitLabel={translateText('generated.inline.0132_create_role_5bea05a8')}
          />
        }
        scope="event"
      />

      <RolesPermissionsTable
        roles={[...accessRoles]}
        actionRights={EVENT_ACTION_RIGHTS}
        title={translateText('generated.inline.1104_event_permissions_4796a43a')}
        description={translateText(
          'generated.inline.1105_manage_event_specific_permissions_by_role_dra_26291034'
        )}
        onTogglePermission={(roleId, resource, action, currentlyHas) =>
          void togglePermission(roleId, resource, action, currentlyHas)
        }
        onReorderRoles={orderedRoleIds => void reorderRoles(orderedRoleIds)}
        isPermissionDisabled={getPermissionDisabledReason}
      />

      <AddRoleDialog
        data-action-id="roles.event-role.edit.submit"
        isOpen={editRoleOpen}
        onOpenChange={open => {
          setEditRoleOpen(open);
        }}
        form={editRoleForm}
        onFormChange={patch => setEditRoleForm((current: any) => ({ ...current, ...patch }))}
        onSubmit={() => void saveEditedRole()}
        scope="event"
        eventType={event?.event_type ?? null}
        title={translateText('common.accessibility.edit', {
          entity: editingRole?.name || translateText('common.entities.role'),
        })}
        description={translateText(
          'generated.inline.1106_adjust_assignment_mode_visibility_defaults_an_5b1c8b7d'
        )}
        submitLabel={translateText('generated.inline.1107_save_role_2f46bd88')}
        trigger={null}
      />
    </>
  );
}
