import { expect, test } from '../fixtures/test';
import { db } from '../fixtures/db';
import { waitForAppReady } from '../fixtures/readiness';
import { deterministicE2EUuid } from '../fixtures/run';

async function selectUserInDialog(page: Parameters<typeof waitForAppReady>[0], label: string) {
  const dialog = page.getByRole('dialog');
  const input = dialog.getByRole('textbox', { name: /^Search/i });
  await expect(input).toBeVisible();
  await input.fill(label);
  const result = dialog.locator('[data-typeahead-result]').filter({ hasText: label });
  await expect(result).toHaveCount(1, { timeout: 30_000 });
  await result.click();
  return dialog;
}

test.describe('critical invitations and requests', () => {
  test('invites a group member and persists the notification @pr @critical', async ({
    page,
    seed,
  }) => {
    const sql = db();
    const inviteeName = `${seed.groupName.replace(' Base Group', '')} Fixture User`;
    await sql`
      delete from public.group_membership
      where group_id = ${seed.groupId}::uuid and user_id = ${seed.extraUserId}::uuid;

      update public.role
      set assignment_mode = 'assigned', default_invite_role = true
      where id = ${seed.roleId}::uuid;
    `;

    await page.goto(`/group/${seed.groupId}/memberships`);
    await waitForAppReady(page);
    await page.locator('[data-action-id="groups.invitations.open.members-dialog"]').click();
    const dialog = await selectUserInDialog(page, inviteeName);
    const submit = dialog.locator('[data-action-id="groups.invitations.dialog.submit"]');
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect
      .poll(async () => {
        const rows = await sql`
          select status from public.group_membership
          where group_id = ${seed.groupId}::uuid and user_id = ${seed.extraUserId}::uuid
        `;
        return rows[0]?.status ?? null;
      })
      .toBe('invited');
    await expect
      .poll(async () => {
        const rows = await sql`
          select type from public.notification
          where recipient_id = ${seed.extraUserId}::uuid
            and related_group_id = ${seed.groupId}::uuid
          order by created_at desc limit 1
        `;
        return rows[0]?.type ?? null;
      })
      .toBe('membership_invite');
  });

  test('invites an event participant and persists the notification @pr @critical', async ({
    page,
    seed,
  }) => {
    const sql = db();
    const inviteeName = `${seed.groupName.replace(' Base Group', '')} Fixture User`;
    await sql`
      update public.event set event_type = 'open', updated_at = now()
      where id = ${seed.eventId}::uuid;
    `;

    await page.goto(`/event/${seed.eventId}/participants`);
    await waitForAppReady(page);
    await page.locator('[data-action-id="groups.invitations.open.members-dialog"]').click();
    const dialog = await selectUserInDialog(page, inviteeName);
    const submit = dialog.locator('[data-action-id="groups.invitations.dialog.submit"]');
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect
      .poll(async () => {
        const rows = await sql`
          select status from public.event_participant
          where event_id = ${seed.eventId}::uuid and user_id = ${seed.extraUserId}::uuid
        `;
        return rows[0]?.status ?? null;
      })
      .toBe('invited');
    await expect
      .poll(async () => {
        const rows = await sql`
          select type from public.notification
          where recipient_id = ${seed.extraUserId}::uuid
            and related_event_id = ${seed.eventId}::uuid
          order by created_at desc limit 1
        `;
        return rows[0]?.type ?? null;
      })
      .toBe('participation_invite');
  });

  test('invites an amendment collaborator and persists the notification @pr @critical', async ({
    e2eRun,
    page,
    seed,
  }) => {
    const sql = db();
    const roleId = deterministicE2EUuid(`${e2eRun.prefix}:collaborator-role`);
    const inviteeName = `${e2eRun.prefix} Fixture User`;
    await sql`
      insert into public.role (
        id, name, description, scope, amendment_id, assignment_mode, visibility,
        is_recurring, default_request_role, default_invite_role, assignee_kind,
        sort_order, created_at
      ) values (
        ${roleId}::uuid, 'Collaborator', 'Collaborator', 'amendment',
        ${seed.amendmentId}::uuid, 'assigned', 'public', false, false, true,
        'member', 0, now()
      );
    `;

    await page.goto(`/amendment/${seed.amendmentId}/collaborators`);
    await waitForAppReady(page);
    await page.locator('[data-action-id="amendments.collaborators.open.invite-dialog"]').click();
    const dialog = await selectUserInDialog(page, inviteeName);
    const submit = dialog.locator('[data-action-id="amendments.collaborators.submit.invite"]');
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect
      .poll(async () => {
        const rows = await sql`
          select status from public.amendment_collaborator
          where amendment_id = ${seed.amendmentId}::uuid and user_id = ${seed.extraUserId}::uuid
        `;
        return rows[0]?.status ?? null;
      })
      .toBe('invited');
    await expect
      .poll(async () => {
        const rows = await sql`
          select type from public.notification
          where recipient_id = ${seed.extraUserId}::uuid
            and related_amendment_id = ${seed.amendmentId}::uuid
          order by created_at desc limit 1
        `;
        return rows[0]?.type ?? null;
      })
      .toBe('collaboration_invite');
  });
});
