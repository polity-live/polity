import { describe, expect, it } from 'vitest';

import { APP_TUTORIAL_EXPECTED_INPUTS_BY_LANGUAGE, getAppTutorialExpectedInputs } from '../catalog';

describe('A07 tutorial catalog accessor', () => {
  it('returns the exact expected-input catalog for both supported languages', () => {
    expect(getAppTutorialExpectedInputs('de')).toBe(APP_TUTORIAL_EXPECTED_INPUTS_BY_LANGUAGE.de);
    expect(getAppTutorialExpectedInputs('en')).toBe(APP_TUTORIAL_EXPECTED_INPUTS_BY_LANGUAGE.en);
  });
});
