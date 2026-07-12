import { test, expect } from '../fixtures/test';
import { cartesianProduct, matrixLimit, scenarioLabel } from '../fixtures/matrix';
import {
  applyOptionalVideoUrl,
  fillMinimalEvent,
  gotoEvent,
  layouts,
  visibilityValues,
} from './helpers';
import { submitSmokeAndExpectCreated } from './smoke-expectations';

const scenarios = cartesianProduct(
  {
    layout: layouts,
    eventType: ['delegate_assembly', 'general_assembly', 'open', 'meeting', 'on_invite'],
    group: ['empty', 'valid'],
    meetingFormat: ['one-on-one', 'public-meeting'],
    delegateAllocation: ['ratio', 'total'],
    delegateElectionMode: ['single', 'list'],
    timeRange: ['empty', 'valid', 'invalid'],
    recurrence: ['none', 'daily', 'weekly', 'monthly', 'yearly', 'four-yearly'],
    attendance: ['online', 'hybrid', 'offline'],
    deadlines: ['absent', 'present'],
    capacity: ['absent', 'present'],
    media: ['absent', 'video'],
    visibility: visibilityValues,
    genderQuota: ['off', 'on'],
    voteOrder: ['text_position', 'changed_character_count', 'cr_number'],
  },
  {
    max: matrixLimit(72),
    name: scenarioLabel,
    filter: scenario => scenario.eventType !== 'delegate_assembly' || scenario.group === 'valid',
  }
);

test.describe('create/event', () => {
  test('accepts a title video URL', async ({ createFlowPage, e2eRun, seed }) => {
    await gotoEvent(createFlowPage, seed, 'one_page', { eventType: 'open', time: 'valid' });
    await expect(applyOptionalVideoUrl(createFlowPage.page, 'media', e2eRun.prefix)).resolves.toBe(
      true
    );
  });

  test('creates a minimal open event @smoke', async ({ createFlowPage, e2eRun, seed }) => {
    await gotoEvent(createFlowPage, seed, 'one_page', { eventType: 'open', time: 'valid' });
    await fillMinimalEvent(createFlowPage, e2eRun.prefix);
    await submitSmokeAndExpectCreated(createFlowPage, {
      kind: 'event',
      prefix: e2eRun.prefix,
    });
  });

  for (const scenario of scenarios) {
    test(`matrix ${scenario.name} @create-full`, async ({ createFlowPage, e2eRun, seed }) => {
      await gotoEvent(createFlowPage, seed, scenario.data.layout as 'one_page' | 'carousel', {
        eventType: scenario.data.eventType as string,
        withGroup: scenario.data.group === 'valid',
        time: scenario.data.timeRange as 'empty' | 'valid' | 'invalid',
      });

      await createFlowPage.form.fillText('title', `${e2eRun.prefix} Matrix Event`, {
        optional: true,
      });
      await createFlowPage.form.chooseOption('event-type', scenario.data.eventType as string, {
        optional: true,
      });
      await createFlowPage.form.chooseOption(
        'meeting-settings',
        scenario.data.meetingFormat as string,
        {
          optional: true,
        }
      );
      await createFlowPage.form.chooseOption(
        'delegate-allocation',
        scenario.data.delegateAllocation as string,
        {
          optional: true,
        }
      );
      await createFlowPage.form.chooseOption('time-series', scenario.data.recurrence as string, {
        optional: true,
      });
      await createFlowPage.form.chooseOption('location', scenario.data.attendance as string, {
        optional: true,
      });
      await createFlowPage.form.chooseOption('settings', scenario.data.voteOrder as string, {
        optional: true,
      });
      if (scenario.data.media === 'video') {
        await applyOptionalVideoUrl(createFlowPage.page, 'media', e2eRun.prefix);
      }

      if (
        scenario.data.layout === 'one_page' &&
        (scenario.data.timeRange === 'empty' || scenario.data.timeRange === 'invalid')
      ) {
        await createFlowPage.form.expectSubmitDisabled();
      } else {
        await expect(createFlowPage.page.locator('[data-create-flow="event"]')).toBeVisible();
      }
    });
  }
});
