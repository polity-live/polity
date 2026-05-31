import { AddRoleDialog } from '@/features/groups/ui/AddRoleDialog';
import { RoleDetailsTable } from '@/features/groups/ui/RoleDetailsTable';
import { RolesPermissionsTable } from '@/features/groups/ui/RolesPermissionsTable';
import { emptyRoleEditorForm } from '@/features/groups/logic/roleFormHelpers';
import { EVENT_ACTION_RIGHTS } from '@/zero/rbac/constants';
import { useEventRoleManagement } from '@/features/events/hooks/useEventRoleManagement';

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
            title="Add Event Role"
            description="Create an event role with the same defaults and permissions workflow you use for group roles."
            submitLabel="Create Role"
          />
        }
        scope="event"
      />

      <RolesPermissionsTable
        roles={[...accessRoles]}
        actionRights={EVENT_ACTION_RIGHTS}
        title="Event Permissions"
        description="Manage event-specific permissions by role. Drag columns to reorder — left is least privileged, right is most privileged."
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
        description="Adjust assignment mode, visibility, defaults, and participant permissions for this event role."
        submitLabel="Save Role"
        trigger={null}
      />
    </>
  );
}
