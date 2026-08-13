import { describe, expect, it } from 'vitest';
import { getEntityToneClasses, getSemanticToneClasses } from '@/features/shared/theme';
import {
  getAmendmentProcessInfoBadgeClassName,
  getAmendmentProcessStatusBadgeClassName,
  getRelationshipBadgeClassName,
} from '../badgeClassNames';

describe('badge class-name contracts', () => {
  it.each([
    ['approved', 'success'],
    ['accepted', 'success'],
    ['completed', 'success'],
    ['merged', 'success'],
    ['rejected', 'danger'],
    ['withdrawn', 'danger'],
    ['pending_event', 'warning'],
    ['scheduled', 'warning'],
    ['in_vote', 'info'],
    ['supported', 'info'],
    ['previous_decision_outstanding', 'warning'],
    ['forward_confirmed', 'accent'],
    ['unknown', 'neutral'],
    [null, 'neutral'],
  ] as const)('maps process status %s to %s', (status, tone) => {
    expect(getAmendmentProcessStatusBadgeClassName(status)).toBe(
      getSemanticToneClasses(tone).badge
    );
  });

  it.each([
    ['workflow', 'accent'],
    ['count', 'info'],
    ['step', 'neutral'],
    ['current', 'success'],
    ['task', 'accent'],
  ] as const)('maps process info %s to semantic %s', (info, tone) => {
    expect(getAmendmentProcessInfoBadgeClassName(info)).toBe(getSemanticToneClasses(tone).badge);
  });

  it('uses the group entity tone for group process info', () => {
    expect(getAmendmentProcessInfoBadgeClassName('group')).toBe(
      getEntityToneClasses('group').badge
    );
  });

  it.each([
    ['sibling', 'accent'],
    ['parent', 'success'],
    ['child', 'info'],
    ['unknown', 'neutral'],
  ] as const)('maps relationship %s to %s', (relationship, tone) => {
    expect(getRelationshipBadgeClassName(relationship)).toBe(getSemanticToneClasses(tone).badge);
  });
});
