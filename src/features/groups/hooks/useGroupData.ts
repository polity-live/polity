/**
 * Group Data Hooks
 * Re-exported from facade layer for backward compatibility.
 */
export { useGroupById as useGroupData } from '@/zero/groups/useGroupState';
export {
  useGroupMemberships,
  useGroupGuestAccesses,
  useGroupAccessRoles,
  useUserSearch,
} from '@/zero/groups/useGroupState';
