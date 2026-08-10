import { describe, expect, it } from 'vitest';

import { getFirstTutorialEventStart } from '../tutorialCalendarDate';

describe('getFirstTutorialEventStart', () => {
  it('selects the earliest sandbox event independently of query order', () => {
    expect(
      getFirstTutorialEventStart([
        { tutorial_run_id: 'run-1', start_date: 300 } as any,
        { tutorial_run_id: null, start_date: 100 } as any,
        { tutorial_run_id: 'run-1', start_date: 200 } as any,
      ])
    ).toBe(200);
  });

  it('returns null without a tutorial event', () => {
    expect(
      getFirstTutorialEventStart([{ tutorial_run_id: null, start_date: 100 } as any])
    ).toBeNull();
  });
});
