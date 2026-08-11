import { describe, expect, it } from 'vitest';

import {
  AMENDMENT_TARGET_EVENT_CLOSED_MESSAGE,
  assertAmendmentTargetEventOpen,
  isAmendmentTargetEventOpen,
} from '../amendmentTargetEventEligibility';

describe('amendmentTargetEventEligibility', () => {
  const now = 1_000;

  it('allows events without an amendment deadline', () => {
    expect(isAmendmentTargetEventOpen({}, now)).toBe(true);
    expect(isAmendmentTargetEventOpen({ amendment_deadline: null }, now)).toBe(true);
  });

  it('allows events while their amendment deadline is still in the future', () => {
    expect(isAmendmentTargetEventOpen({ amendment_deadline: now + 1 }, now)).toBe(true);
  });

  it('blocks events at or after their amendment deadline', () => {
    expect(isAmendmentTargetEventOpen({ amendment_deadline: now }, now)).toBe(false);
    expect(isAmendmentTargetEventOpen({ amendment_deadline: now - 1 }, now)).toBe(false);
  });

  it('throws a stable message for closed target events', () => {
    expect(() => assertAmendmentTargetEventOpen({ amendment_deadline: now }, now)).toThrow(
      AMENDMENT_TARGET_EVENT_CLOSED_MESSAGE
    );
  });
});
