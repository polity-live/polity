import { describe, expect, it, vi } from 'vitest';

import { assertValidSiblingConfiguration } from '../membership-helpers';

describe('assertValidSiblingConfiguration', () => {
  it('allows sibling groups to connect to other sibling groups', async () => {
    const tx = {
      run: vi.fn().mockResolvedValueOnce({
        id: 'connected-sibling',
        group_type: 'sibling',
      }),
    };

    await expect(
      assertValidSiblingConfiguration(tx as never, {
        groupId: 'group-1',
        groupType: 'sibling',
        connectedGroupId: 'connected-sibling',
        siblingMembershipMode: 'open',
      })
    ).resolves.toBeUndefined();
  });

  it('accepts elected sibling connections when the connected role belongs to a sibling group', async () => {
    const tx = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'connected-sibling',
          group_type: 'sibling',
        })
        .mockResolvedValueOnce({
          id: 'role-1',
          group_id: 'connected-sibling',
          scope: 'group',
          assignee_kind: 'member',
        }),
    };

    await expect(
      assertValidSiblingConfiguration(tx as never, {
        groupId: 'group-1',
        groupType: 'sibling',
        connectedGroupId: 'connected-sibling',
        siblingMembershipMode: 'elected',
        siblingRoleId: 'role-1',
      })
    ).resolves.toBeUndefined();
  });
});
