import { describe, expect, it } from 'vitest';

import {
  ballotSubmit,
  buttonTap,
  cardHover,
  choiceSelect,
  civicMotionVariants,
  listItem,
  motionTimings,
  pageEnter,
  scrollReveal,
  staggerContainer,
  successSettle,
} from '..';
import { getMotionPreset } from '@/features/shared/theme';

describe('civic motion presets', () => {
  it('exports stable variant keys for app choreography', () => {
    expect(civicMotionVariants.pageEnter).toBe(pageEnter);
    expect(civicMotionVariants.staggerContainer).toBe(staggerContainer);
    expect(civicMotionVariants.listItem).toBe(listItem);
    expect(civicMotionVariants.cardHover).toBe(cardHover);
    expect(civicMotionVariants.buttonTap).toBe(buttonTap);
    expect(civicMotionVariants.scrollReveal).toBe(scrollReveal);
    expect(civicMotionVariants.successSettle).toBe(successSettle);
    expect(civicMotionVariants.choiceSelect).toBe(choiceSelect);
    expect(civicMotionVariants.ballotSubmit).toBe(ballotSubmit);
  });

  it('keeps durations inside the Civic interaction budget', () => {
    expect(motionTimings.fast).toBeLessThanOrEqual(0.12);
    expect(motionTimings.success).toBeLessThanOrEqual(0.5);
    expect(pageEnter.animate).toHaveProperty('transition');
    expect(successSettle.animate).toHaveProperty('transition');
  });

  it('connects CSS-first presets through the theme helper', () => {
    expect(getMotionPreset('spotlight')).toBe('civic-motion-spotlight');
    expect(getMotionPreset('selectable')).toBe('civic-motion-selectable');
    expect(getMotionPreset('successSettle')).toBe('civic-success-settle');
    expect(getMotionPreset('ballotSubmit')).toBe('civic-ballot-submit');
  });
});
