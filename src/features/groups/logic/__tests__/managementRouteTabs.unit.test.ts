import { describe, expect, it } from 'vitest';

import { collaboratorsSearchSchema } from '@/routes/_authed/amendment/$id/collaborators';
import { participantsSearchSchema } from '@/routes/_authed/event/$id/participants';
import { groupMembershipsSearchSchema } from '@/routes/_authed/group/$id/memberships';
import { membershipsSearchSchema } from '@/routes/_authed/user/$id/memberships';

describe('management route tabs', () => {
  it('accepts deep links for each management page', () => {
    expect(groupMembershipsSearchSchema.parse({ tab: 'openAssignments' }).tab).toBe(
      'openAssignments'
    );
    expect(participantsSearchSchema.parse({ tab: 'composition' }).tab).toBe('composition');
    expect(collaboratorsSearchSchema.parse({ tab: 'roles' }).tab).toBe('roles');
    expect(membershipsSearchSchema.parse({ tab: 'blogs' }).tab).toBe('blogs');
  });

  it('falls back safely for unknown tabs', () => {
    expect(groupMembershipsSearchSchema.parse({ tab: 'unknown' }).tab).toBe('membershipsByUser');
    expect(participantsSearchSchema.parse({ tab: 'unknown' }).tab).toBe('membershipsByUser');
    expect(collaboratorsSearchSchema.parse({ tab: 'unknown' }).tab).toBe('membershipsByUser');
    expect(membershipsSearchSchema.parse({ tab: 'unknown' }).tab).toBe('all');
  });
});
