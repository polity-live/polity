import type { ActionType, ResourceType } from '@/zero/rbac';

type PermissionChecker = (action: ActionType, resource: ResourceType) => boolean;

export function canJoinEventSpeakerList(can: PermissionChecker) {
  return (
    can('speak', 'events') ||
    can('manage_speakers', 'events') ||
    can('active_voting', 'events') ||
    can('passive_voting', 'events')
  );
}
