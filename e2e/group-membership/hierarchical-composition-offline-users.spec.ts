// spec: e2e/test-plans/group-membership-test-plan.md

import { test, expect } from '../fixtures/test-base';
import { adminDelete, adminUpsert } from '../fixtures/admin-db';
import { gotoWithRetry } from '../helpers/navigation';

test.describe('Group Membership - Hierarchical Composition', () => {
  test('composition member total includes effective offline members', async ({
    authenticatedPage: adminPage,
    adminDb,
    groupFactory,
    mainUserId,
  }) => {
    const relationshipId = groupFactory.generateId();
    const offlineMemberId = groupFactory.generateId();
    const baseOfflineMembershipId = groupFactory.generateId();
    const parentOfflineMembershipId = groupFactory.generateId();
    const baseOfflineRoleLinkId = groupFactory.generateId();
    const parentOfflineRoleLinkId = groupFactory.generateId();
    const parentOwnerRoleLinkId = groupFactory.generateId();
    const now = new Date().toISOString();

    try {
      const parentGroup = await groupFactory.createGroup(mainUserId, {
        name: `Hierarchy Composition Parent ${Date.now()}`,
        groupType: 'hierarchical',
      });
      const baseGroup = await groupFactory.createGroup(mainUserId, {
        name: `Hierarchy Composition Base ${Date.now()}`,
      });

      await adminUpsert('group_relationship', {
        id: relationshipId,
        group_id: parentGroup.id,
        related_group_id: baseGroup.id,
        relationship_type: 'child',
        with_right: 'passiveVotingRight',
        status: 'active',
        initiator_group_id: parentGroup.id,
        created_at: now,
      });

      const { data: parentOwnerMembership, error: parentOwnerMembershipError } = await adminDb
        .from('group_membership')
        .select('id')
        .eq('group_id', parentGroup.id)
        .eq('user_id', mainUserId)
        .single();

      if (parentOwnerMembershipError || !parentOwnerMembership) {
        throw new Error(parentOwnerMembershipError?.message ?? 'Parent owner membership not found');
      }

      await adminUpsert('group_membership_role', {
        id: parentOwnerRoleLinkId,
        group_membership_id: parentOwnerMembership.id,
        role_id: parentGroup.memberRoleId,
        assigned_by_id: mainUserId,
        assigned_at: now,
        created_at: now,
      });

      await adminUpsert('group_offline_member', {
        id: offlineMemberId,
        group_id: baseGroup.id,
        first_name: 'Offline',
        last_name: 'Member',
        reason_not_signed_up: 'No platform account',
        connected_user_id: null,
        created_by_id: mainUserId,
        created_at: now,
        updated_at: now,
      });

      await adminUpsert('group_offline_membership', [
        {
          id: baseOfflineMembershipId,
          group_offline_member_id: offlineMemberId,
          group_id: baseGroup.id,
          status: 'active',
          visibility: 'public',
          source: 'direct',
          source_group_id: null,
          created_at: now,
        },
        {
          id: parentOfflineMembershipId,
          group_offline_member_id: offlineMemberId,
          group_id: parentGroup.id,
          status: 'active',
          visibility: 'public',
          source: 'derived',
          source_group_id: baseGroup.id,
          created_at: now,
        },
      ]);

      await adminUpsert('group_offline_membership_role', [
        {
          id: baseOfflineRoleLinkId,
          group_offline_membership_id: baseOfflineMembershipId,
          role_id: baseGroup.memberRoleId,
          assigned_by_id: mainUserId,
          assigned_at: now,
          created_at: now,
        },
        {
          id: parentOfflineRoleLinkId,
          group_offline_membership_id: parentOfflineMembershipId,
          role_id: parentGroup.memberRoleId,
          assigned_by_id: mainUserId,
          assigned_at: now,
          created_at: now,
        },
      ]);

      await gotoWithRetry(adminPage, `/group/${parentGroup.id}/memberships`);
      await expect(adminPage.getByText(/All users .* offline users\) \(2\)/i)).toBeVisible({
        timeout: 10000,
      });

      await gotoWithRetry(adminPage, `/group/${parentGroup.id}/memberships?tab=composition`);
      await expect(adminPage.getByRole('heading', { name: 'Composition' })).toBeVisible({
        timeout: 10000,
      });
      await expect(adminPage.getByText(/^Total: 2$/)).toBeVisible({ timeout: 10000 });
      await expect(adminPage.getByText('No non-member role assignments found.')).toBeVisible();
    } finally {
      await adminDelete('group_offline_membership_role', [
        baseOfflineRoleLinkId,
        parentOfflineRoleLinkId,
      ]);
      await adminDelete('group_membership_role', [parentOwnerRoleLinkId]);
      await adminDelete('group_offline_membership', [
        baseOfflineMembershipId,
        parentOfflineMembershipId,
      ]);
      await adminDelete('group_offline_member', [offlineMemberId]);
      await adminDelete('group_relationship', [relationshipId]);
    }
  });
});
