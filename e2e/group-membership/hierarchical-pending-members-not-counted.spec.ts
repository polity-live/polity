// spec: e2e/test-plans/group-membership-test-plan.md

import { test, expect, loginAsFactoryUser } from '../fixtures/test-base';
import { adminDelete, adminUpsert } from '../fixtures/admin-db';
import { gotoWithRetry } from '../helpers/navigation';

test.describe('Group Membership - Hierarchical Pending Members', () => {
  test('requested base-group memberships only appear in hierarchy after acceptance', async ({
    authenticatedPage: adminPage,
    browser,
    adminDb,
    groupFactory,
    userFactory,
    mainUserId,
  }) => {
    const relationshipId = groupFactory.generateId();
    const now = new Date().toISOString();
    let requesterContext: Awaited<ReturnType<typeof browser.newContext>> | null = null;

    try {
      const parentGroup = await groupFactory.createGroup(mainUserId, {
        name: `Hierarchy Parent ${Date.now()}`,
        groupType: 'hierarchical',
      });
      const baseGroup = await groupFactory.createGroup(mainUserId, {
        name: `Hierarchy Base ${Date.now()}`,
      });
      const invitedUser = await userFactory.createUser();
      const requester = await userFactory.createUserWithAuth();

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

      await groupFactory.addMember(baseGroup.id, invitedUser.id, baseGroup.memberRoleId, {
        status: 'invited',
      });

      requesterContext = await browser.newContext();
      const requesterPage = await requesterContext.newPage();

      await loginAsFactoryUser(requesterPage, requester.email);
      await requesterPage.goto(`/group/${baseGroup.id}`);
      await requesterPage.waitForLoadState('domcontentloaded');

      await requesterPage.getByRole('button', { name: /request to join/i }).click();
      await expect(
        requesterPage.getByRole('button', { name: /request pending|pending/i })
      ).toBeVisible({ timeout: 15000 });

      await expect
        .poll(async () => {
          const { data, error } = await adminDb
            .from('group_membership')
            .select('id')
            .eq('group_id', parentGroup.id)
            .eq('user_id', requester.id)
            .eq('source', 'derived');

          if (error) {
            throw new Error(error.message);
          }

          return data?.length ?? 0;
        })
        .toBe(0);

      await expect
        .poll(async () => {
          const { data, error } = await adminDb
            .from('group')
            .select('member_count')
            .eq('id', parentGroup.id)
            .single();

          if (error) {
            throw new Error(error.message);
          }

          return data.member_count;
        })
        .toBe(1);

      await gotoWithRetry(adminPage, `/group/${parentGroup.id}/memberships`);
      await expect(adminPage.getByText(/^Active Members \(1\)$/)).toBeVisible({ timeout: 10000 });

      await gotoWithRetry(adminPage, `/group/${baseGroup.id}/memberships`);
      const requestRow = adminPage.locator('tr').filter({ hasText: requester.name }).first();
      await expect(requestRow).toBeVisible({ timeout: 10000 });
      await requestRow.getByRole('button', { name: /accept/i }).click();

      await expect
        .poll(async () => {
          const { data, error } = await adminDb
            .from('group_membership')
            .select('id')
            .eq('group_id', parentGroup.id)
            .eq('user_id', requester.id)
            .eq('source', 'derived');

          if (error) {
            throw new Error(error.message);
          }

          return data?.length ?? 0;
        })
        .toBe(1);

      await expect
        .poll(async () => {
          const { data, error } = await adminDb
            .from('group')
            .select('member_count')
            .eq('id', parentGroup.id)
            .single();

          if (error) {
            throw new Error(error.message);
          }

          return data.member_count;
        })
        .toBe(2);

      await gotoWithRetry(adminPage, `/group/${parentGroup.id}/memberships`);
      await expect(adminPage.getByText(/^Active Members \(2\)$/)).toBeVisible({ timeout: 10000 });
      await expect(adminPage.getByText(requester.name)).toBeVisible({ timeout: 10000 });
    } finally {
      await requesterContext?.close();
      await adminDelete('group_relationship', [relationshipId]);
    }
  });
});
