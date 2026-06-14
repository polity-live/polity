import { useEventRoleManagement } from '@/features/events/hooks/useEventRoleManagement';
import { EventRolesView } from './EventRolesView';
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
  return (
    <EventRolesView
      eventId={eventId}
      event={event}
      roles={roles}
      accessRoles={accessRoles}
      isLoading={isLoading}
      addRoleOpen={addRoleOpen}
      setAddRoleOpen={setAddRoleOpen}
      newRoleForm={newRoleForm}
      setNewRoleForm={setNewRoleForm}
      editRoleOpen={editRoleOpen}
      setEditRoleOpen={setEditRoleOpen}
      editRoleForm={editRoleForm}
      setEditRoleForm={setEditRoleForm}
      editingRole={editingRole}
      addRole={addRole}
      openEditRole={openEditRole}
      saveEditedRole={saveEditedRole}
      removeRole={removeRole}
      togglePermission={togglePermission}
      reorderRoles={reorderRoles}
      createElectionForRole={createElectionForRole}
      getPermissionDisabledReason={getPermissionDisabledReason}
    />
  );
}
