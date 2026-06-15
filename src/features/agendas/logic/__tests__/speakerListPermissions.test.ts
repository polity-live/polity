import { describe, expect, it } from 'vitest';
import type { ActionType, ResourceType } from '@/zero/rbac';
import { canJoinEventSpeakerList } from '../speakerListPermissions';

function createCan(allowedActions: ActionType[]) {
  return (action: ActionType, resource: ResourceType) =>
    resource === 'events' && allowedActions.includes(action);
}

describe('canJoinEventSpeakerList', () => {
  it.each(['speak', 'manage_speakers', 'active_voting', 'passive_voting'] as const)(
    'allows users with %s',
    action => {
      expect(canJoinEventSpeakerList(createCan([action]))).toBe(true);
    }
  );

  it('rejects users without speaker-list permissions', () => {
    expect(canJoinEventSpeakerList(createCan(['view']))).toBe(false);
  });
});
