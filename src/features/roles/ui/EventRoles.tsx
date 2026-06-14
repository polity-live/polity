import { AddRoleDialog } from '@/features/groups/ui/AddRoleDialog';
import { RoleDetailsTable } from '@/features/groups/ui/RoleDetailsTable';
import { RolesPermissionsTable } from '@/features/groups/ui/RolesPermissionsTable';
import { emptyRoleEditorForm } from '@/features/groups/logic/roleFormHelpers';
import { EVENT_ACTION_RIGHTS } from '@/zero/rbac/constants';
import { useEventRoleManagement } from '@/features/events/hooks/useEventRoleManagement';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export function EventRoles({ eventId }: { eventId: string }) {
  const {
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
  } = useEventRoleManagement(eventId);

  if (isLoading) {
    return null;
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
            isOpen={addRoleOpen}
            onOpenChange={open => {
              setAddRoleOpen(open);
              if (!open) {
                setNewRoleForm(emptyRoleEditorForm());
              }
            }}
            form={newRoleForm}
            onFormChange={patch => setNewRoleForm(current => ({ ...current, ...patch }))}
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
        isOpen={editRoleOpen}
        onOpenChange={open => {
          setEditRoleOpen(open);
        }}
        form={editRoleForm}
        onFormChange={patch => setEditRoleForm(current => ({ ...current, ...patch }))}
        onSubmit={() => void saveEditedRole()}
        scope="event"
        eventType={event?.event_type ?? null}
        title={editingRole?.name ? `Edit ${editingRole.name}` : 'Edit Event Role'}
        description={translateText(
          'generated.inline.1106_adjust_assignment_mode_visibility_defaults_an_5b1c8b7d'
        )}
        submitLabel={translateText('generated.inline.1107_save_role_2f46bd88')}
        trigger={null}
      />
    </>
  );
}
