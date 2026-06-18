// spec: e2e/test-plans/event-participation-test-plan.md

import { test, expect } from '../fixtures/test-base';
import { gotoWithRetry } from '../helpers/navigation';

test.describe('Event Participation - Invite Only Events', () => {
  test('shows a disabled request action with invite-only info to a non-invited user', async ({
    authenticatedPage: page,
    eventFactory,
    userFactory,
  }) => {
    const owner = await userFactory.createUser();
    const event = await eventFactory.createEvent(owner.id, {
      title: `Invite Only Event ${Date.now()}`,
      eventType: 'on_invite',
    });

    await gotoWithRetry(page, `/event/${event.id}`);

    await expect(page.getByText(/by invitation/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^subscribe$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /request to participate/i })).toBeDisabled();
    const inviteOnlyInfo = page.getByLabel(
      /request to participate: this event is by invitation only/i
    );
    await expect(inviteOnlyInfo).toBeVisible();
    await inviteOnlyInfo.hover();
    await expect(page.getByText(/^this event is by invitation only$/i)).toBeVisible();
  });

  test('shows accept action to an invited user', async ({
    authenticatedPage: page,
    eventFactory,
    userFactory,
    mainUserId,
  }) => {
    const owner = await userFactory.createUser();
    const event = await eventFactory.createEvent(owner.id, {
      title: `Invite Only Invitation ${Date.now()}`,
      eventType: 'on_invite',
    });
    await eventFactory.addParticipant(event.id, mainUserId, event.participantRoleId, 'invited');

    await gotoWithRetry(page, `/event/${event.id}`);

    await expect(page.getByText(/by invitation/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /accept invitation/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /request to participate/i })).toHaveCount(0);
  });
});
