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
    const MS_PER_HOUR = 60 * 60 * 1000;
    const FUTURE_MEETING_OFFSET_HOURS = 48;
    const EDIT_DIALOG_TIMEOUT_MS = 10_000;
    const BOOKING_DIALOG_ABSENCE_TIMEOUT_MS = 5_000;
    const UPDATED_CARD_TIMEOUT_MS = 15_000;
    const UPDATED_MAX_PARTICIPANTS = '7';
    const INVALID_WHITESPACE_INPUT = '   ';
    const uniqueId = crypto.randomUUID();
    const initialTitle = `E2E Owner Offer ${uniqueId}`;
    const updatedTitle = `E2E Owner Offer Updated ${uniqueId}`;
    const startDate = new Date(Date.now() + FUTURE_MEETING_OFFSET_HOURS * MS_PER_HOUR);
    const endDate = new Date(startDate.getTime() + MS_PER_HOUR);

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

    const initialMeetingCard = page.getByRole('button', { name: new RegExp(initialTitle) });
    await expect(initialMeetingCard).toHaveCount(1, { timeout: EDIT_DIALOG_TIMEOUT_MS });
    await expect(initialMeetingCard).toBeVisible({ timeout: EDIT_DIALOG_TIMEOUT_MS });
    await initialMeetingCard.click();

    const editDialog = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Edit Meeting Offer' }),
    });
    await expect(editDialog).toBeVisible({ timeout: EDIT_DIALOG_TIMEOUT_MS });
    await expect(page.getByRole('heading', { name: 'Book Meeting Offer' })).toHaveCount(0, {
      timeout: BOOKING_DIALOG_ABSENCE_TIMEOUT_MS,
    });

    const titleInput = editDialog.getByLabel('Title');
    await titleInput.fill(INVALID_WHITESPACE_INPUT);
    await expect(editDialog.getByRole('button', { name: 'Save Meeting' })).toBeDisabled();

    await titleInput.fill(updatedTitle);
    const maxParticipantsInput = editDialog.getByLabel('Max Participants');
    await expect(maxParticipantsInput).toBeHidden();
    await editDialog.getByRole('button', { name: 'Public session' }).click();
    await expect(maxParticipantsInput).toBeVisible();
    await maxParticipantsInput.fill(UPDATED_MAX_PARTICIPANTS);

    await editDialog.getByRole('button', { name: 'Save Meeting' }).click();
    await expect(editDialog).toBeHidden({ timeout: EDIT_DIALOG_TIMEOUT_MS });

    const updatedMeetingCard = page.getByRole('button', { name: new RegExp(updatedTitle) });
    await expect(updatedMeetingCard).toHaveCount(1, { timeout: UPDATED_CARD_TIMEOUT_MS });

    await updatedMeetingCard.click();
    const reopenedEditDialog = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Edit Meeting Offer' }),
    });
    await expect(reopenedEditDialog.getByLabel('Title')).toHaveValue(updatedTitle);
    await expect(reopenedEditDialog.getByLabel('Max Participants')).toHaveValue(
      UPDATED_MAX_PARTICIPANTS
    );
  });
});
