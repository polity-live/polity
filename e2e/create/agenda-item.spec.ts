import { test, expect } from '../fixtures/test';
import { cartesianProduct, matrixLimit, scenarioLabel } from '../fixtures/matrix';
import { fillMinimalAgendaItem, gotoAgendaItem, layouts } from './helpers';
import { submitSmokeAndExpectCreated } from './smoke-expectations';

const scenarios = cartesianProduct(
  {
    layout: layouts,
    type: ['discussion', 'speech', 'accreditation', 'election', 'vote'],
    event: ['empty', 'valid'],
    order: ['default', 'custom'],
    duration: ['absent', 'present'],
    majority: ['simple', 'absolute', 'two_thirds'],
    ballotVisibility: ['secret', 'named'],
    electionMode: ['single', 'list'],
    seatCount: ['default', 'custom'],
    amendmentLink: ['absent', 'present'],
    roleLink: ['absent', 'present'],
    assignmentPrefill: ['none', 'delegate', 'role-renewal'],
  },
  {
    max: matrixLimit(64),
    name: scenarioLabel,
    filter: scenario => scenario.type === 'election' || scenario.electionMode === 'single',
  }
);

test.describe('create/agenda-item', () => {
  test('creates a minimal agenda item @smoke', async ({ createFlowPage, e2eRun, seed }) => {
    await gotoAgendaItem(createFlowPage, seed);
    await fillMinimalAgendaItem(createFlowPage, e2eRun.prefix);
    await submitSmokeAndExpectCreated(createFlowPage, {
      kind: 'agendaItem',
      prefix: e2eRun.prefix,
      seed,
    });
  });

  for (const scenario of scenarios) {
    test(`matrix ${scenario.name} @create-full`, async ({ createFlowPage, e2eRun, seed }) => {
      await gotoAgendaItem(
        createFlowPage,
        seed,
        scenario.data.layout as 'one_page' | 'carousel',
        scenario.data.type as string,
        scenario.data.event === 'valid'
      );

      await createFlowPage.form.fillText('title', `${e2eRun.prefix} Matrix Agenda Item`, {
        optional: true,
      });
      await createFlowPage.form.chooseOption('type-selector', scenario.data.type as string, {
        optional: true,
      });

      if (scenario.data.order === 'custom') {
        await createFlowPage.form.fillText('order', '2', { optional: true });
      }
      if (scenario.data.duration === 'present') {
        await createFlowPage.form.fillText('duration', '15', { optional: true });
      }
      await createFlowPage.form.chooseOption('majority-type', scenario.data.majority as string, {
        optional: true,
      });
      await createFlowPage.form.chooseOption(
        'ballot-visibility',
        scenario.data.ballotVisibility as string,
        { optional: true }
      );
      await createFlowPage.form.chooseOption(
        'election-mode',
        scenario.data.electionMode as string,
        {
          optional: true,
        }
      );
      if (scenario.data.seatCount === 'custom') {
        await createFlowPage.form.fillText('seat-count', '3', { optional: true });
      }

      if (scenario.data.layout === 'one_page' && scenario.data.event === 'empty') {
        await createFlowPage.form.expectSubmitDisabled();
      } else {
        await expect(createFlowPage.page.locator('[data-create-flow="agenda_item"]')).toBeVisible();
      }
    });
  }
});
