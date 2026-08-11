import { test } from '../fixtures/test';
import { fillMinimalAgendaItem, gotoAgendaItem } from './helpers';
import { submitSmokeAndExpectCreated } from './smoke-expectations';

test.describe('create/agenda-item', () => {
  test('creates a minimal agenda item @pr @critical', async ({ createFlowPage, e2eRun, seed }) => {
    await gotoAgendaItem(createFlowPage, seed);
    await fillMinimalAgendaItem(createFlowPage, e2eRun.prefix);
    await submitSmokeAndExpectCreated(createFlowPage, {
      kind: 'agendaItem',
      prefix: e2eRun.prefix,
      seed,
    });
  });
});
