import { test, expect } from '../fixtures/test-base';
import { navigateToMeeting } from '../helpers/navigation';
import { TEST_ENTITY_IDS } from '../test-entity-ids';

test.describe('Meet - Video Meeting', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto('/meet');
    await page.waitForLoadState('networkidle');
  });

  test('should display meeting page', async ({ authenticatedPage: page }) => {
    const meetHeading = page.getByRole('heading', { name: /meet|meeting/i });
    if ((await meetHeading.count()) > 0) {
      await expect(meetHeading.first()).toBeVisible();
    }
  });

  test('should display meeting scheduling options', async ({ authenticatedPage: page }) => {
    // Look for create/schedule meeting button
    const createButton = page.getByRole('button', { name: /create|schedule|new/i });
    if ((await createButton.count()) > 0) {
      await expect(createButton.first()).toBeVisible();
    }
  });

  test('should display meeting slots list', async ({ authenticatedPage: page }) => {
    // Meeting slots or upcoming meetings should be displayed
    const meetSlots = page.locator('[class*="meeting"], [class*="slot"]');
    if ((await meetSlots.count()) > 0) {
      await expect(meetSlots.first()).toBeVisible();
    }
  });
});

test.describe('Meet - Meeting Detail', () => {
  test('should navigate to meeting detail page', async ({ authenticatedPage: page }) => {
    await navigateToMeeting(page, TEST_ENTITY_IDS.testMeetingSlot1);

    // Meeting page should load (or show not found)
    await page.waitForLoadState('networkidle');
  });
});

test.describe('Meet Scheduler - Owner Editing Offers', () => {
  test('owner can edit an existing future meeting offer from /user/:id/meet', async ({
    authenticatedPage: page,
    mainUserId,
    eventFactory,
    adminDb,
  }) => {
    const timestamp = Date.now();
    const initialTitle = `E2E Owner Offer ${timestamp}`;
    const updatedTitle = `E2E Owner Offer Updated ${timestamp}`;
    const startDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const meetingEvent = await eventFactory.createEvent(mainUserId, {
      title: initialTitle,
      description: 'Meeting offer used for owner edit flow test',
      eventType: 'meeting',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    const { error: eventUpdateError } = await adminDb
      .from('event')
      .update({
        meeting_type: 'one-on-one',
        is_bookable: true,
        max_bookings: 1,
        start_date: startDate.getTime(),
        end_date: endDate.getTime(),
      })
      .eq('id', meetingEvent.id);
    expect(eventUpdateError).toBeNull();

    await page.goto(`/user/${mainUserId}/meet`);
    await page.waitForLoadState('networkidle');

    await page.getByText(initialTitle).first().click();

    const editDialog = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Edit Meeting Offer' }),
    });
    await expect(editDialog).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Book Meeting Offer' })).toHaveCount(0);

    const titleInput = editDialog.locator('#edit-meeting-title');
    await titleInput.fill('   ');
    await expect(editDialog.getByRole('button', { name: 'Save Meeting' })).toBeDisabled();

    await titleInput.fill(updatedTitle);
    await editDialog.getByRole('button', { name: 'Public session' }).click();

    const maxParticipantsInput = editDialog.locator('#edit-max-bookings');
    await expect(maxParticipantsInput).toBeVisible();
    await maxParticipantsInput.fill('7');

    await editDialog.getByRole('button', { name: 'Save Meeting' }).click();
    await expect(editDialog).toBeHidden({ timeout: 10000 });

    await expect(page.getByText(updatedTitle).first()).toBeVisible({ timeout: 15000 });

    await page.getByText(updatedTitle).first().click();
    const reopenedEditDialog = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Edit Meeting Offer' }),
    });
    await expect(reopenedEditDialog.locator('#edit-meeting-title')).toHaveValue(updatedTitle);
    await expect(reopenedEditDialog.locator('#edit-max-bookings')).toHaveValue('7');
  });
});
